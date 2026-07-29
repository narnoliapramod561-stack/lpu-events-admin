import { SupabaseClient } from "@supabase/supabase-js";
import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";
import { Event } from "../event/EventService";
import { Payment } from "../booking/BookingService";

export interface OrganizerProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'student' | 'organizer' | 'super_admin' | 'admin';
  registration_number: string | null;
  department: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizerEventsParams {
  status?: 'draft' | 'pending_approval' | 'published' | 'ongoing' | 'completed' | 'cancelled' | 'archived';
  is_featured?: boolean;
  page?: number;
  limit?: number;
}

export class OrganizerService extends BaseService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    super();
    this.supabase = supabaseClient;
  }

  /**
   * Get the current user's profile
   */
  async getProfile(userId: string): Promise<ServiceResult<OrganizerProfile>> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        phone,
        avatar_url,
        role,
        registration_number,
        department,
        metadata,
        is_active,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Update the current user's profile
   */
  async updateProfile(
    userId: string,
    updates: {
      full_name?: string | null;
      phone?: string | null;
      registration_number?: string | null;
      department?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): Promise<ServiceResult<OrganizerProfile>> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(`
        id,
        email,
        full_name,
        phone,
        avatar_url,
        role,
        registration_number,
        department,
        metadata,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    return this.handleResult(data, error);
  }

  /**
   * Check if an organizer has access to an event
   */
  async checkOrganizerAccess(organizerId: string, eventId: string): Promise<ServiceResult<boolean>> {
    const { data, error } = await this.supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('organizer_id', organizerId)
      .single();

    if (error) return this.handleResult(false, error);
    return this.handleResult(!!data, null);
  }

  /**
   * Get events owned by an organizer
   */
  async getOrganizerEvents(
    organizerId: string,
    params?: OrganizerEventsParams
  ): Promise<ServiceResult<{
    events: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>> {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const offset = (page - 1) * limit;
    const status = params?.status;
    const isFeatured = params?.is_featured;

    let query = this.supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('organizer_id', organizerId);

    if (status) {
      query = query.eq('status', status);
    }

    if (isFeatured !== undefined) {
      query = query.eq('is_featured', isFeatured);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return {
        data: null,
        error: error.message || 'An unexpected error occurred',
        success: false,
      };
    }

    return this.handleResult(
      {
        events: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
      null
    );
  }

  /**
   * Get organizer statistics
   */
  async getOrganizerStats(organizerId: string): Promise<ServiceResult<{
    total_events: number;
    active_events: number;
    total_bookings: number;
    pending_approvals: number;
    revenue: number;
  }>> {
    // Get total events
    const { data: events, error: eventsError } = await this.supabase
      .from('events')
      .select('status, id', { count: 'exact' })
      .eq('organizer_id', organizerId);

    if (eventsError) {
      return {
        data: null,
        error: eventsError.message || 'An unexpected error occurred',
        success: false,
      };
    }

    // Get active events (ongoing and published)
    const activeEvents = (events || []).filter(
      (e: { status: string }) => e.status === 'ongoing' || e.status === 'published'
    ).length;

    // Get total bookings
    const { data: bookings, error: bookingsError } = await this.supabase
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('organizer_id', organizerId);

    if (bookingsError) {
      return {
        data: null,
        error: bookingsError.message || 'An unexpected error occurred',
        success: false,
      };
    }

    // Get pending organizer applications
    const { data: applications, error: appsError } = await this.supabase
      .from('organizer_applications')
      .select('id', { count: 'exact' })
      .eq('user_id', organizerId)
      .eq('status', 'pending');

    if (appsError) {
      return {
        data: null,
        error: appsError.message || 'An unexpected error occurred',
        success: false,
      };
    }

    // Get total revenue (from completed bookings)
    const { data: payments, error: paymentsError } = await this.supabase
      .from('payments')
      .select('amount', { count: 'exact' })
      .eq('organizer_id', organizerId)
      .eq('status', 'captured');

    if (paymentsError) {
      return {
        data: null,
        error: paymentsError.message || 'An unexpected error occurred',
        success: false,
      };
    }

    const totalRevenue = (payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

    return this.handleResult(
      {
        total_events: events?.length || 0,
        active_events: activeEvents,
        total_bookings: bookings?.length || 0,
        pending_approvals: applications?.length || 0,
        revenue: totalRevenue,
      },
      null
    );
  }

  /**
   * Check if a user is an organizer
   */
  async isOrganizer(userId: string): Promise<ServiceResult<boolean>> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return this.handleResult(false, error);
    }

    return this.handleResult(data.role === 'organizer', null);
  }

  /**
   * Check if a user is an admin or super admin
   */
  async isAdmin(userId: string): Promise<ServiceResult<boolean>> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return this.handleResult(false, error);
    }

    return this.handleResult(
      data.role === 'admin' || data.role === 'super_admin',
      null
    );
  }
}