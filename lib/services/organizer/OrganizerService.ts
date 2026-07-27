import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";

export class OrganizerService extends BaseService {
    private supabase: any;

    constructor(supabaseClient: any) {
        super();
        this.supabase = supabaseClient;
    }

    async getOrganizerProfile(organizerId: string): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .from("organizers")
            .select("*")
            .eq("id", organizerId)
            .single();
        return this.handleResult(data, error);
    }

    async checkOrganizerAccess(organizerId: string, eventId: string): Promise<ServiceResult<boolean>> {
        const { data, error } = await this.supabase
            .from("events")
            .select("id")
            .eq("id", eventId)
            .eq("organizer_id", organizerId)
            .single();

        if (error) return this.handleResult(false, error);
        return this.handleResult(!!data, null);
    }
}