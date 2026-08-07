import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Event {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived' | 'pending_approval' | 'rejected' | 'ongoing' | 'completed' | 'cancelled';
  organizer_id: string;
  category_id?: string;
  starts_at?: string;
  ends_at?: string;
  is_featured?: boolean;
  is_hidden?: boolean;
  deleted_at?: string | null;
  description?: string;
  short_description?: string | null;
  venue?: string | null;
  venue_address?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  is_free?: boolean;
  registration_required?: boolean;
  registration_type?: 'free' | 'paid';
  registration_platform?: 'lpu_events' | 'external_link';
  approval_status?: 'pending' | 'approved' | 'rejected';
  submitted_for_approval_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  registration_mode?: 'individual' | 'team';
  team_min_size?: number | null;
  team_max_size?: number | null;
  team_pricing?: 'fixed' | 'per_member' | null;
  max_tickets?: number | null;
  terms_and_conditions?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  cover_image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TicketTierInput {
    name: string;
    description?: string | null;
    price: number;
    total_tickets: number;
}

export interface CreateEventWithInventoryInput extends Partial<Event> {
    ticket_tiers?: TicketTierInput[];
}

export class EventService extends BaseService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        super();
        this.supabase = supabaseClient;
    }

    async getEvent(id: string): Promise<ServiceResult<Event>> {
        const { data, error } = await this.supabase
            .from("events")
            .select("*")
            .eq("id", id)
            .is("deleted_at", null)
            .single();
        return this.handleResult(data, error);
    }

    /**
     * CANONICAL creation path (Domain 2 lock).
     * Creates the event AND initializes its inventory atomically-in-sequence:
     * every ticket tier -> ticket_types + event_inventory (available=total, 0/0).
     * If no tiers supplied, a single default tier is derived from max_tickets so
     * the publish_event RPC inventory gate can always be satisfied.
     * On any failure after the event insert, the event row is soft-deleted to
     * avoid leaving inventory-less events behind.
     */
    async createEvent(input: CreateEventWithInventoryInput): Promise<ServiceResult<Event>> {
        const { ticket_tiers, ...eventData } = input;

        const { data: event, error: eventError } = await this.supabase
            .from("events")
            .insert(eventData)
            .select()
            .single();

        if (eventError || !event) {
            return this.handleResult<Event>(null, eventError);
        }

        // Determine tiers: supplied, else default from max_tickets.
        let tiers: TicketTierInput[] = Array.isArray(ticket_tiers) ? ticket_tiers : [];
        if (tiers.length === 0) {
            const fallbackCapacity = (eventData.max_tickets ?? 100);
            tiers = [{
                name: 'General Admission',
                description: null,
                price: eventData.is_free ? 0 : 0,
                total_tickets: fallbackCapacity,
            }];
        }

        for (const tier of tiers) {
            // ticket_types
            const { data: ticketType, error: ttError } = await this.supabase
                .from("ticket_types")
                .insert({
                    event_id: event.id,
                    name: tier.name,
                    description: tier.description ?? null,
                    price: tier.price,
                })
                .select()
                .single();

            if (ttError || !ticketType) {
                await this.rollbackEvent(event.id);
                return this.handleResult<Event>(null, ttError ?? new Error('Failed to create ticket type'));
            }

            // event_inventory (source of truth for booking)
            const { error: invError } = await this.supabase
                .from("event_inventory")
                .insert({
                    event_id: event.id,
                    ticket_type_id: ticketType.id,
                    total_tickets: tier.total_tickets,
                    available_tickets: tier.total_tickets,
                    reserved_tickets: 0,
                    sold_tickets: 0,
                });

            if (invError) {
                await this.rollbackEvent(event.id);
                return this.handleResult<Event>(null, invError);
            }
        }

        // Sync event.max_tickets to summed capacity for consistency.
        const totalCapacity = tiers.reduce((sum, t) => sum + t.total_tickets, 0);
        await this.supabase
            .from("events")
            .update({ max_tickets: Math.min(totalCapacity, eventData.max_tickets ?? totalCapacity) })
            .eq("id", event.id);

        return this.handleResult(event, null);
    }

    private async rollbackEvent(id: string): Promise<void> {
        await this.supabase
            .from("events")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);
    }

    /**
     * Generic update. May NEVER set status='published' — publish goes through
     * publish_event RPC only (see publishEvent). Callers attempting to publish
     * here are rejected.
     */
    async updateEvent(id: string, updates: Partial<Event>): Promise<ServiceResult<Event>> {
        if (updates && (updates as any).status === 'published') {
            return this.handleResult<Event>(
                null,
                new Error("status='published' cannot be set via updateEvent; use publishEvent (publish_event RPC)")
            );
        }
        const { data, error } = await this.supabase
            .from("events")
            .update(updates)
            .eq("id", id)
            .is("deleted_at", null)
            .select()
            .single();
        return this.handleResult(data, error);
    }

    /**
     * SOFT DELETE only (Domain 2 lock). Sets deleted_at; row is retained and
     * excluded by all read filters. Never a hard DELETE.
     */
    async deleteEvent(id: string): Promise<ServiceResult<void>> {
        const { error } = await this.supabase
            .from("events")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id)
            .is("deleted_at", null);
        return this.handleResult(null, error);
    }

    /**
     * CANONICAL publish path (Domain 2 lock). The ONLY way an event reaches
     * status='published'. Delegates to the publish_event_v2 RPC which enforces
     * automatic approval logic based on registration configuration.
     */
    async publishEvent(id: string, organizerUserId: string): Promise<ServiceResult<Event>> {
        const { data, error } = await this.supabase
            .rpc("publish_event_v2", {
                p_event_id: id,
                p_organizer_user_id: organizerUserId
            });
        return this.handleResult(data, error);
    }

    /**
     * Get pending paid event requests for Super Admin approval
     */
    async getPendingPaidEventRequests(): Promise<ServiceResult<any[]>> {
        const { data, error } = await this.supabase
            .from("pending_paid_event_requests")
            .select("*")
            .order("submitted_for_approval_at", { ascending: false });
        return this.handleResult(data, error);
    }

    /**
     * Process event approval/rejection by Super Admin
     */
    async processEventApproval(
        eventId: string, 
        adminUserId: string, 
        action: 'approve' | 'reject', 
        rejectionReason?: string
    ): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .rpc("process_event_approval", {
                p_event_id: eventId,
                p_admin_user_id: adminUserId,
                p_action: action,
                p_rejection_reason: rejectionReason
            });
        return this.handleResult(data, error);
    }

    async getDrafts(organizerId: string): Promise<ServiceResult<Event[]>> {
        const { data, error } = await this.supabase
            .from("events")
            .select("*")
            .eq("organizer_id", organizerId)
            .eq("status", "draft")
            .is("deleted_at", null);
        return this.handleResult(data, error);
    }

    /**
     * CANONICAL cancel path.
     * Delegates to cancel_event RPC which validates ownership, state, and
     * paid-booking constraints. Writes outbox event for dependency engine.
     */
    async cancelEvent(
        id: string,
        userId: string,
        cancelReason?: string
    ): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .rpc("cancel_event", {
                p_event_id: id,
                p_user_id: userId,
                p_cancel_reason: cancelReason ?? null,
            });
        return this.handleResult(data, error);
    }

    /**
     * CANONICAL complete path.
     * Transitions published/ongoing → completed.
     * Delegates to complete_event RPC. Writes outbox event.
     */
    async completeEvent(
        id: string,
        userId: string
    ): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .rpc("complete_event", {
                p_event_id: id,
                p_user_id: userId,
            });
        return this.handleResult(data, error);
    }

    /**
     * CANONICAL archive path (admin only).
     * Transitions completed/cancelled → archived.
     * Delegates to archive_event RPC. Writes outbox event.
     */
    async archiveEvent(
        id: string,
        userId: string
    ): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .rpc("archive_event", {
                p_event_id: id,
                p_user_id: userId,
            });
        return this.handleResult(data, error);
    }

    /**
     * Get rejected events for an organizer.
     * Organizers can view and re-submit their rejected events.
     */
    async getRejectedEvents(organizerId: string): Promise<ServiceResult<Event[]>> {
        const { data, error } = await this.supabase
            .from("events")
            .select("*")
            .eq("organizer_id", organizerId)
            .eq("status", "rejected")
            .is("deleted_at", null)
            .order("updated_at", { ascending: false });
        return this.handleResult(data, error);
    }
}
