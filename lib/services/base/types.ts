export interface ServiceResult<T> {
    data: T | null;
    error: string | null;
    success: boolean;
}

export interface BaseServiceOptions {
    supabaseClient?: any;
}