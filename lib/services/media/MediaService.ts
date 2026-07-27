import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";

export class MediaService extends BaseService {
    private supabase: any;

    constructor(supabaseClient: any) {
        super();
        this.supabase = supabaseClient;
    }

    async getMediaMetadata(mediaId: string): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .from("media_metadata")
            .select("*")
            .eq("id", mediaId)
            .single();
        return this.handleResult(data, error);
    }

    async generateMediaUrl(storagePath: string): Promise<ServiceResult<string>> {
        const { data, error } = await this.supabase.storage
            .from("event-media")
            .createSignedUrl(storagePath, 3600);
        return this.handleResult(data?.signedUrl || null, error);
    }

    async updateMetadata(mediaId: string, metadata: any): Promise<ServiceResult<any>> {
        const { data, error } = await this.supabase
            .from("media_metadata")
            .update(metadata)
            .eq("id", mediaId)
            .select()
            .single();
        return this.handleResult(data, error);
    }
}