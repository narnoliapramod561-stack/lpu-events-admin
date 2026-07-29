import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { withSentry } from '../_shared/sentry.ts';

import { authenticate, createServiceClient } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import * as response from '../_shared/response.ts';
import { handleUnexpectedError } from '../_shared/errors.ts';
import { parseJsonBody, validateOrRespond } from '../_shared/validation.ts';
import type { Schema } from '../_shared/validation.ts';

const BOOKING_INITIATE_SCHEMA: Schema = {
  reservation_id: { type: 'uuid', required: true },
};

function getRazorpayKeyId(): string {
  const key = Deno.env.get('RAZORPAY_KEY_ID');
  if (!key) throw new Error('RAZORPAY_KEY_ID is not set');
  return key;
}

function getRazorpayKeySecret(): string {
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET is not set');
  return secret;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function createRazorpayOrder(amountPaise: number, currency: string, receipt: string) {
  const authHeader = btoa(`${getRazorpayKeyId()}:${getRazorpayKeySecret()}`);
  const body = {
    amount: amountPaise,
    currency,
    receipt,
    payment_capture: 1,
  };

  const result = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await result.json().catch(() => null);
  if (!result.ok) {
    throw new Error(data?.error?.description || data?.error?.message || 'Failed to create Razorpay order.');
  }

  return data as { id: string; amount: number; currency: string };
}

Deno.serve(withSentry('booking-initiate', async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'POST') {
    return response.methodNotAllowed(['POST']);
  }

  try {
    const authResult = await authenticate(req);
    if (authResult instanceof Response) return authResult;

    const bodyResult = await parseJsonBody(req);
    if (bodyResult instanceof Response) return bodyResult;

    const invalid = validateOrRespond(bodyResult, BOOKING_INITIATE_SCHEMA);
    if (invalid) return invalid;

    const reservationId = String(bodyResult.reservation_id);
    const serviceClient = createServiceClient();
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') || '' },
        },
      }
    );

    const { data: reservation, error: reservationError } = await serviceClient
      .from('reservations')
      .select(
        'id, user_id, event_id, ticket_type_id, status, expires_at, quantity, ticket_types(id, name, price), events(id, title, venue)'
      )
      .eq('id', reservationId)
      .eq('user_id', authResult.userId)
      .maybeSingle();

    if (reservationError || !reservation) {
      return response.notFound('RESERVATION_NOT_FOUND', 'Reservation not found or does not belong to the requesting user.');
    }

    const rawTicketType = (reservation as unknown as Record<string, unknown>)?.ticket_types;
    const rawEvent = (reservation as unknown as Record<string, unknown>)?.events;

    const ticketType = typeof rawTicketType === 'object' && rawTicketType !== null ? rawTicketType as Record<string, unknown> : undefined;
    const event = typeof rawEvent === 'object' && rawEvent !== null ? rawEvent as Record<string, unknown> : undefined;

    const amount = asNumber(ticketType?.price);

    if (amount <= 0) {
      const { data: freeResult, error: freeError } = await userClient.rpc('confirm_reservation', {
        p_reservation_id: reservationId,
        p_user_id: authResult.userId,
      });

      if (freeError) {
        return response.error('FREE_BOOKING_FAILED', 'Unable to confirm the free booking right now.', 500);
      }

      if (freeResult?.error) {
        return response.error(String(freeResult.error), freeResult.message || 'Unable to confirm the free booking right now.', 400);
      }

      return response.success('Booking confirmed successfully', {
        bookingType: 'free',
        event: event
          ? { id: event.id, title: event.title, venue: event.venue }
          : null,
        ticket: freeResult,
      });
    }

    const originalExpiresAt = reservation.expires_at;
    let reservationExtended = false;

    if (reservation.status === 'held') {
      const { error: extendError } = await userClient.rpc('extend_reservation', {
        p_reservation_id: reservationId,
        p_user_id: authResult.userId,
      });

      if (extendError) {
        return response.error('RESERVATION_EXTENSION_FAILED', 'Unable to extend the reservation hold.', 500);
      }

      reservationExtended = true;
    }

    let order;
    try {
      order = await createRazorpayOrder(Math.round(amount * 100), 'INR', `reservation_${reservationId}`);
    } catch (orderError) {
      if (reservationExtended) {
        await serviceClient
          .from('reservations')
          .update({ status: 'held', expires_at: originalExpiresAt, updated_at: new Date().toISOString() })
          .eq('id', reservationId)
          .eq('user_id', authResult.userId);
      }

      throw orderError;
    }

    const { data: registration, error: registrationError } = await serviceClient
      .from('registrations')
      .insert({
        reservation_id: reservationId,
        user_id: authResult.userId,
        event_id: reservation.event_id,
        ticket_type_id: reservation.ticket_type_id,
        registration_mode: 'individual',
        quantity: reservation.quantity || 1,
        total_amount: amount,
        status: 'reserved',
        confirmed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (registrationError || !registration) {
      await serviceClient
        .from('reservations')
        .update({ status: 'held', expires_at: originalExpiresAt, updated_at: new Date().toISOString() })
        .eq('id', reservationId)
        .eq('user_id', authResult.userId);
      return response.error('REGISTRATION_CREATE_FAILED', 'Unable to prepare the booking right now.', 500);
    }

    const { data: payment, error: paymentError } = await serviceClient
      .from('payments')
      .insert({
        registration_id: registration.id,
        user_id: authResult.userId,
        razorpay_order_id: order.id,
        status: 'initiated',
        amount,
        currency: 'INR',
        metadata: {
          reservation_id: reservationId,
          event_id: reservation.event_id,
          ticket_type_id: reservation.ticket_type_id,
        },
      })
      .select('id')
      .single();

    if (paymentError || !payment) {
      await serviceClient.from('registrations').delete().eq('id', registration.id);
      await serviceClient
        .from('reservations')
        .update({ status: 'held', expires_at: originalExpiresAt, updated_at: new Date().toISOString() })
        .eq('id', reservationId)
        .eq('user_id', authResult.userId);
      return response.error('PAYMENT_INIT_FAILED', 'Unable to start the payment flow right now.', 500);
    }

    return response.success('Checkout created successfully', {
      bookingType: 'paid',
      checkout: {
        key_id: getRazorpayKeyId(),
        order_id: order.id,
        payment_id: payment.id,
        amount: order.amount,
        currency: order.currency,
        reservation_id: reservationId,
        event: event ? { id: event.id, title: event.title, venue: event.venue } : null,
      },
    });
  } catch (err) {
    return handleUnexpectedError(err);
  }
}));
