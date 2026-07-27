import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";

export class EventService extends BaseService {
    private supabase: any;

    constructor(supabaseClient: any) {
        super();
        this.supabase = supabaseClient;
    }

    async getEvent(id: string): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .from("events")
            .select("*")
            .eq("id", id)
            .single();
        return this.handleResult(data, error);
    }

    async createEvent(eventData: any): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .from("events")
            .insert(eventData)
            .select()
            .single();
        return this.handleResult(data, error);
    }

    async updateEvent(id: string, updates: any): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .from("events")
            .update(updates)
            .eq("id", id)
            .select()
            .single();
        return this.handleResult(data, error);
    }

    async deleteEvent(id: string): Promise<ServiceResult<void>> {
        const { error } = await this.supabase
            .from("events")
            .delete()
            .eq("id", id);
        return this.handleResult(null, error);
    }

    async publishEvent(id: string, organizerUserId: string): Promise<ServiceResult<any>> {
        // Integration with P4-T02 Lifecycle Engine
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
            .eq("status", "draft");
        return this.handleResult(data, error);
    }
}