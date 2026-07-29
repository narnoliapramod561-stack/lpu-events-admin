import { SupabaseClient } from "@supabase/supabase-js";
import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";
import { z } from "zod";

/**
 * BookingService - Handles all booking-related operations
 *
 * Operations:
 * - List registrations (with filtering)
 * - Get single registration details
 * - Create new registration (booking)
 * - Cancel registration
 * - Get ticket data
 * - Get event inventory
 * - Handle reservations
 * - Handle payments
 */

// Types for booking operations

export interface Registration {
  id: string;
  reservation_id?: string | null;
  user_id: string;
  event_id: string;
  ticket_type_id: string;
  registration_mode: 'individual' | 'team';
  team_name: string | null;
  quantity: number;
  total_amount: number;
  status: 'confirmed' | 'cancelled' | 'attended';
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationMember {
  id: string;
  registration_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  registration_number: string | null;
  role_in_team: string | null;
  created_at: string;
}

export interface EventInventory {
  id: string;
  event_id: string;
  ticket_type_id: string | null;
  total_tickets: number;
  available_tickets: number;
  reserved_tickets: number;
  sold_tickets: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  registration_id: string;
  event_id: string;
  user_id: string;
  ticket_number: string;
  qr_token: string;
  status: 'valid' | 'used' | 'cancelled' | 'expired';
  manual_override: boolean;
  override_reason: string | null;
  issued_at: string;
  used_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  registration_id: string;
  user_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  status: 'initiated' | 'processing' | 'captured' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  metadata: Record<string, unknown> | null;
  initiated_at: string | null;
  captured_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  event_id: string;
  ticket_type_id: string;
  status: 'held' | 'payment_pending' | 'confirmed' | 'expired' | 'cancelled';
  quantity: number;
  held_at: string;
  expires_at: string;
  extended_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingListParams {
  event_id?: string;
  user_id?: string;
  status?: 'confirmed' | 'cancelled' | 'attended';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface BookingListResult {
  registrations: Registration[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class BookingService extends BaseService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    super();
    this.supabase = supabaseClient;
  }

  // ============================================================
  // REGISTRATION OPERATIONS
  // ============================================================

  /**
   * Get a single registration by ID
   */
  async getRegistrationById(registrationId: string): Promise<ServiceResult<Registration>> {
    const { data, error } = await this.supabase
      .from('registrations')
      .select(`
        id,
        reservation_id,
        user_id,
        event_id,
        ticket_type_id,
        registration_mode,
        team_name,
        quantity,
        total_amount,
        status,
        confirmed_at,
        cancelled_at,
        cancellation_reason,
        created_at,
        updated_at,
        events!registrations_event_id_fkey (
          id,
          title,
          slug,
          status
        ),
        ticket_types!registrations_ticket_type_id_fkey (
          id,
          name,
          price
        )
      `)
      .eq('id', registrationId)
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Get registrations for a specific event
   */
  async getRegistrationsByEvent(
    eventId: string,
    params: { page?: number; limit?: number; status?: string } = {}
  ): Promise<ServiceResult<BookingListResult>> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    const status = params.status;

    let query = this.supabase
      .from('registrations')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error: error.message || 'An unexpected error occurred', success: false };
    }

    return this.handleResult({
      registrations: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    }, null);
  }

  /**
   * Get registrations for a specific user
   */
  async getRegistrationsByUser(
    userId: string,
    params: { page?: number; limit?: number; status?: string } = {}
  ): Promise<ServiceResult<BookingListResult>> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    const status = params.status;

    let query = this.supabase
      .from('registrations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error: error.message || 'An unexpected error occurred', success: false };
    }

    return this.handleResult({
      registrations: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    }, null);
  }

  /**
   * Get all registrations with filtering
   */
  async getAllRegistrations(params: BookingListParams = {}): Promise<ServiceResult<BookingListResult>> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('registrations')
      .select('*', { count: 'exact' });

    if (params.event_id) {
      query = query.eq('event_id', params.event_id);
    }

    if (params.user_id) {
      query = query.eq('user_id', params.user_id);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }

    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error: error.message || 'An unexpected error occurred', success: false };
    }

    return this.handleResult({
      registrations: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    }, null);
  }

  /**
   * Create a new registration (booking)
   */
  async createRegistration(data: {
    reservation_id?: string;
    user_id: string;
    event_id: string;
    ticket_type_id: string;
    registration_mode: 'individual' | 'team';
    team_name: string | null;
    quantity: number;
    total_amount: number;
  }): Promise<ServiceResult<Registration>> {
    const { data: result, error } = await this.supabase
      .from('registrations')
      .insert({
        reservation_id: data.reservation_id || null,
        user_id: data.user_id,
        event_id: data.event_id,
        ticket_type_id: data.ticket_type_id,
        registration_mode: data.registration_mode,
        team_name: data.team_name,
        quantity: data.quantity,
        total_amount: data.total_amount,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    return this.handleResult(result, error);
  }

  /**
   * Update a registration (cancel)
   */
  async updateRegistration(
    registrationId: string,
    updates: {
      status?: 'cancelled';
      cancellation_reason?: string;
    }
  ): Promise<ServiceResult<Registration>> {
    const updateData: Partial<Registration> = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (updates.status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('registrations')
      .update(updateData)
      .eq('id', registrationId)
      .select()
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Cancel a registration
   */
  async cancelRegistration(
    registrationId: string,
    cancellationReason: string
  ): Promise<ServiceResult<Registration>> {
    const updateData = {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancellationReason,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('registrations')
      .update(updateData)
      .eq('id', registrationId)
      .select()
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Get registration by reservation ID
   */
  async getRegistrationByReservationId(reservationId: string): Promise<ServiceResult<Registration>> {
    const { data, error } = await this.supabase
      .from('registrations')
      .select(`
        *,
        events!registrations_event_id_fkey (
          id,
          title,
          slug,
          status
        ),
        ticket_types!registrations_ticket_type_id_fkey (
          id,
          name,
          price
        )
      `)
      .eq('reservation_id', reservationId)
      .single();

    return this.handleResult(data, error);
  }

  // ============================================================
  // TICKET OPERATIONS
  // ============================================================

  /**
   * Get ticket by ticket number
   */
  async getTicketByTicketNumber(ticketNumber: string): Promise<ServiceResult<Ticket>> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select(`
        *,
        registrations!tickets_registration_id_fkey (
          id,
          event_id,
          user_id,
          quantity,
          status
        ),
        events!tickets_event_id_fkey (
          id,
          title,
          starts_at,
          ends_at
        )
      `)
      .eq('ticket_number', ticketNumber)
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Get tickets for a registration
   */
  async getTicketsByRegistration(registrationId: string): Promise<ServiceResult<Ticket[]>> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('registration_id', registrationId)
      .order('created_at', { ascending: false });

    return this.handleResult(data || [], error);
  }

  /**
   * Get tickets for a user
   */
  async getTicketsByUser(userId: string): Promise<ServiceResult<Ticket[]>> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select(`
        *,
        registrations!tickets_registration_id_fkey (
          event_id,
          events!registrations_event_id_fkey (
            id,
            title,
            starts_at
          )
        )
      `)
      .eq('user_id', userId)
      .order('issued_at', { ascending: false });

    return this.handleResult(data || [], error);
  }

  // ============================================================
  // EVENT INVENTORY OPERATIONS
  // ============================================================

  /**
   * Get event inventory
   */
  async getEventInventory(eventId: string, ticketTypeId?: string): Promise<ServiceResult<EventInventory>> {
    const { data, error } = await this.supabase
      .from('event_inventory')
      .select('*')
      .eq('event_id', eventId)
      .eq('ticket_type_id', ticketTypeId || '')
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Get all inventory for an event
   */
  async getEventInventoryByEvent(eventId: string): Promise<ServiceResult<EventInventory[]>> {
    const { data, error } = await this.supabase
      .from('event_inventory')
      .select('*')
      .eq('event_id', eventId)
      .order('ticket_type_id', { ascending: true });

    return this.handleResult(data || [], error);
  }

  // ============================================================
  // RESERVATION OPERATIONS
  // ============================================================

  /**
   * Create a reservation (temporary hold)
   */
  async createReservation(data: {
    user_id: string;
    event_id: string;
    ticket_type_id: string;
    quantity: number;
  }): Promise<ServiceResult<Reservation>> {
    const heldAt = new Date();
    const expiresAt = new Date(heldAt.getTime() + 2 * 60 * 1000); // 2 minutes

    const { data: result, error } = await this.supabase
      .from('reservations')
      .insert({
        user_id: data.user_id,
        event_id: data.event_id,
        ticket_type_id: data.ticket_type_id,
        status: 'held',
        quantity: data.quantity,
        held_at: heldAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        created_at: heldAt.toISOString(),
        updated_at: heldAt.toISOString()
      })
      .select()
      .single();

    return this.handleResult(result, error);
  }

  /**
   * Get reservation by ID
   */
  async getReservationById(reservationId: string): Promise<ServiceResult<Reservation>> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Get active reservations for a user
   */
  async getActiveReservationsByUser(userId: string): Promise<ServiceResult<Reservation[]>> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['held', 'payment_pending'])
      .gte('expires_at', new Date().toISOString())
      .order('held_at', { ascending: false });

    return this.handleResult(data || [], error);
  }

  /**
   * Extend a reservation (Stage 2)
   */
  async extendReservation(reservationId: string): Promise<ServiceResult<Reservation>> {
    const { data: currentReservation, error: fetchError } = await this.getReservationById(reservationId);

    if (fetchError || !currentReservation) {
      return {
        data: null,
        error: fetchError || 'Reservation not found',
        success: false,
      };
    }

    const extendedAt = new Date();
    const currentExpiry = new Date(currentReservation.expires_at);
    const newExpiresAt = new Date(
      currentExpiry.getTime() + 5 * 60 * 1000
    ); // +5 minutes

    const { data, error } = await this.supabase
      .from('reservations')
      .update({
        status: 'payment_pending',
        extended_at: extendedAt.toISOString(),
        expires_at: newExpiresAt.toISOString(),
        updated_at: extendedAt.toISOString()
      })
      .eq('id', reservationId)
      .select()
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Confirm a reservation and create registration
   */
  async confirmReservation(
    reservationId: string,
    userId: string,
    totalAmount: number
  ): Promise<ServiceResult<Registration>> {
    const confirmedAt = new Date();

    // 1. Update reservation status
    const { error: updateError } = await this.supabase
      .from('reservations')
      .update({
        status: 'confirmed',
        confirmed_at: confirmedAt.toISOString(),
        updated_at: confirmedAt.toISOString()
      })
      .eq('id', reservationId);

    if (updateError) {
      return {
        data: null,
        error: updateError.message || 'An unexpected error occurred',
        success: false,
      };
    }

    // 2. Create registration
    const { data: registration, error: registrationError } = await this.supabase
      .from('registrations')
      .insert({
        reservation_id: reservationId,
        user_id: userId,
        event_id: null, // Will be set when reservation is linked to event
        ticket_type_id: null, // Will be set when reservation is linked to event
        registration_mode: 'individual',
        team_name: null,
        quantity: 1,
        total_amount: totalAmount,
        status: 'confirmed',
        confirmed_at: confirmedAt.toISOString(),
        created_at: confirmedAt.toISOString(),
        updated_at: confirmedAt.toISOString()
      })
      .select()
      .single();

    return this.handleResult(registration, registrationError);
  }

  // ============================================================
  // PAYMENT OPERATIONS
  // ============================================================

  /**
   * Create a payment record
   */
  async createPayment(data: {
    registration_id: string;
    user_id: string;
    amount: number;
    razorpay_order_id: string;
    currency?: string;
  }): Promise<ServiceResult<Payment>> {
    const now = new Date();

    const { data: result, error } = await this.supabase
      .from('payments')
      .insert({
        registration_id: data.registration_id,
        user_id: data.user_id,
        razorpay_order_id: data.razorpay_order_id,
        amount: data.amount,
        currency: data.currency || 'INR',
        status: 'initiated',
        initiated_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select()
      .single();

    return this.handleResult(result, error);
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: 'processing' | 'captured' | 'failed' | 'refunded',
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<ServiceResult<Payment>> {
    const updateData: Partial<Payment> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'processing' && razorpayPaymentId) {
      updateData.razorpay_payment_id = razorpayPaymentId;
    }

    if (status === 'captured') {
      updateData.captured_at = new Date().toISOString();
    }

    if (status === 'failed') {
      updateData.failed_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Get payment by registration ID
   */
  async getPaymentByRegistrationId(registrationId: string): Promise<ServiceResult<Payment>> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('registration_id', registrationId)
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Get all payments for a user
   */
  async getPaymentsByUser(userId: string): Promise<ServiceResult<Payment[]>> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return this.handleResult(data || [], error);
  }

  // ============================================================
  // HELPER OPERATIONS
  // ============================================================

  /**
   * Check if user has any active reservation for an event
   */
  async hasActiveReservation(userId: string, eventId: string): Promise<ServiceResult<boolean>> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .in('status', ['held', 'payment_pending'])
      .gte('expires_at', new Date().toISOString())
      .limit(1);

    if (error) return this.handleResult(false, error);
    return this.handleResult((data && data.length > 0) || false, null);
  }

  /**
   * Check if user has a confirmed registration for an event
   */
  async hasConfirmedRegistration(userId: string, eventId: string): Promise<ServiceResult<boolean>> {
    const { data, error } = await this.supabase
      .from('registrations')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .eq('status', 'confirmed')
      .limit(1);

    if (error) return this.handleResult(false, error);
    return this.handleResult((data && data.length > 0) || false, null);
  }

  /**
   * Get total sold tickets for an event
   */
  async getTotalSoldTickets(eventId: string): Promise<ServiceResult<number>> {
    const { data, error } = await this.supabase
      .from('event_inventory')
      .select('sold_tickets')
      .eq('event_id', eventId)
      .single();

    if (error) return this.handleResult(0, error);
    return this.handleResult(data?.sold_tickets || 0, null);
  }

  /**
   * Get available tickets for an event
   */
  async getAvailableTickets(eventId: string, ticketTypeId?: string): Promise<ServiceResult<number>> {
    const { data, error } = await this.supabase
      .from('event_inventory')
      .select('available_tickets')
      .eq('event_id', eventId)
      .eq('ticket_type_id', ticketTypeId || '')
      .single();

    if (error) return this.handleResult(0, error);
    return this.handleResult(data?.available_tickets || 0, null);
  }

  /**
   * Verify if registration is eligible for cancellation
   */
  async canCancelRegistration(registrationId: string): Promise<ServiceResult<boolean>> {
    const { data, error } = await this.getRegistrationById(registrationId);

    if (error || !data) {
      return this.handleResult(false, error);
    }

    // Only confirmed registrations can be cancelled
    if (data.status !== 'confirmed') {
      return this.handleResult(false, null);
    }

    return this.handleResult(true, null);
  }

  /**
   * Verify if user can book event
   */
  async canBookEvent(
    userId: string,
    eventId: string,
    quantity: number
  ): Promise<ServiceResult<boolean>> {
    // Check if user already has active reservation
    const hasActive = await this.hasActiveReservation(userId, eventId);
    if (!hasActive.data) return this.handleResult(false, null);

    // Check if user already has confirmed registration
    const hasConfirmed = await this.hasConfirmedRegistration(userId, eventId);
    if (!hasConfirmed.data) return this.handleResult(false, null);

    // Check capacity
    const totalSold = await this.getTotalSoldTickets(eventId);
    const available = await this.getAvailableTickets(eventId);
    const totalCapacity = (totalSold.data || 0) + (available.data || 0);

    if ((totalSold.data || 0) + quantity > totalCapacity) {
      return this.handleResult(false, null);
    }

    return this.handleResult(true, null);
  }
}
