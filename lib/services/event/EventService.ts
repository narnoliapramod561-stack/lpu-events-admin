import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Event {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived' | 'pending_approval';
  organizer_id: string;
  category_id?: string;
  starts_at?: string;
  ends_at?: string;
  is_featured?: boolean;
  is_hidden?: boolean;
  deleted_at?: string | null;
    // Additional event fields used across the app
    description?: string;
    short_description?: string | null;
    venue?: string | null;
    venue_address?: string | null;
    registration_opens_at?: string | null;
    registration_closes_at?: string | null;
    is_free?: boolean;
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

    async createEvent(eventData: Partial<Event>): Promise<ServiceResult<Event>> {
        const { data, error } = await this.supabase
            .from("events")
            .insert(eventData)
            .select()
            .single();
        return this.handleResult(data, error);
    }

    async updateEvent(id: string, updates: Partial<Event>): Promise<ServiceResult<Event>> {
        const { data, error } = await this.supabase
            .from("events")
            .update(updates)
            .eq("id", id)
            .is("deleted_at", null)
            .select()
            .single();
        return this.handleResult(data, error);
    }

    async deleteEvent(id: string): Promise<ServiceResult<void>> {
        const { error } = await this.supabase
            .from("events")
            .delete()
            .eq("id", id)
            .is("deleted_at", null);
        return this.handleResult(null, error);
    }

    async publishEvent(id: string, organizerUserId: string): Promise<ServiceResult<Event>> {
        const { data, error } = await this.supabase
            .rpc("publish_event", { 
                p_event_id: id,
                p_organizer_user_id: organizerUserId 
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
}
