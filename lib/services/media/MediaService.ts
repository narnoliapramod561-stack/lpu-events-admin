import { SupabaseClient } from "@supabase/supabase-js";
import { BaseService } from "../base/BaseService";
import { ServiceResult } from "../base/types";

export interface MediaMetadata {
    id: string;
    storage_path: string;
    uploader_id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    width: number | null;
    height: number | null;
    duration: number | null;
    description: string | null;
    tags: string[] | null;
    created_at: string;
    updated_at: string;
}

export class MediaService extends BaseService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        super();
        this.supabase = supabaseClient;
    }

    async getMediaMetadata(mediaId: string): Promise<ServiceResult<MediaMetadata>> {
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

    async updateMetadata(mediaId: string, metadata: Partial<MediaMetadata>): Promise<ServiceResult<MediaMetadata>> {
        const { data, error } = await this.supabase
            .from("media_metadata")
            .update(metadata)
            .eq("id", mediaId)
            .select()
            .single();
        return this.handleResult(data, error);
    }
}