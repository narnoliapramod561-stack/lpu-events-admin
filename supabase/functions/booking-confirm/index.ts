import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

import { authenticate, createServiceClient } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import * as response from '../_shared/response.ts';
import { handleUnexpectedError } from '../_shared/errors.ts';
import { parseJsonBody, validateOrRespond } from '../_shared/validation.ts';
import type { Schema } from '../_shared/validation.ts';

const BOOKING_CONFIRM_SCHEMA: Schema = {
  order_id: { type: 'string', required: true, minLength: 1, maxLength: 255 },
  payment_id: { type: 'string', required: true, minLength: 1, maxLength: 255 },
  signature: { type: 'string', required: true, minLength: 1, maxLength: 512 },
};

Deno.serve(async (req: Request): Promise<Response> => {
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

    const invalid = validateOrRespond(bodyResult, BOOKING_CONFIRM_SCHEMA);
    if (invalid) return invalid;

    const orderId = String(bodyResult.order_id);
    const paymentId = String(bodyResult.payment_id);
    const signature = String(bodyResult.signature);

    const serviceClient = createServiceClient();
    const { data: payment, error: paymentError } = await serviceClient
      .from('payments')
      .select('id, user_id, status')
      .eq('razorpay_order_id', orderId)
      .maybeSingle();

    if (paymentError || !payment) {
      return response.notFound('PAYMENT_NOT_FOUND', 'Payment not found for the given order ID.');
    }

    if (payment.user_id !== authResult.userId) {
      return response.forbidden('You can only confirm your own payment.');
    }

    const { data: result, error: rpcError } = await serviceClient.rpc('confirm_payment', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_signature: signature,
    });

    if (rpcError) {
      return response.error('PAYMENT_CONFIRM_FAILED', 'Unable to confirm the payment right now.', 500);
    }

    if (result?.error) {
      return response.error(String(result.error), result.message || 'Unable to confirm the payment right now.', 400);
    }

    return response.success('Booking confirmed successfully', result);
  } catch (err) {
    return handleUnexpectedError(err);
  }
});
