import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export class EventService extends BaseService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        super();
        this.supabase = supabaseClient;
    }

    async getEvent(id: string): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .from("events")
            .select("*")
            .eq("id", id)
            .is("deleted_at", null)
            .single();
        return this.handleResult(data, error);
    }

    async createEvent(eventData: Record<string, unknown>): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .from("events")
            .insert(eventData)
            .select()
            .single();
        return this.handleResult(data, error);
    }

    async updateEvent(id: string, updates: Record<string, unknown>): Promise<ServiceResult<any>> {
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

    async publishEvent(id: string, organizerUserId: string): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .rpc("publish_event", { 
                p_event_id: id,
                p_organizer_user_id: organizerUserId 
            });
        return this.handleResult(data, error);
    }

    async getDrafts(organizerId: string): Promise<ServiceResult<any[]>> {
        const { data, error } = await this.supabase
            .from("events")
            .select("*")
            .eq("organizer_id", organizerId)
            .eq("status", "draft")
            .is("deleted_at", null);
        return this.handleResult(data, error);
    }
}
