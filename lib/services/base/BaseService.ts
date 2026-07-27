import { ServiceResult } from "./types";

export abstract class BaseService {
    protected handleResult<T>(data: T | null, error: any): ServiceResult<T> {
        if (error) {
            console.error(`[Service Error]: ${error.message || error}`);
            return {
                data: null,
                error: error.message || "An unexpected error occurred",
                success: false,
            };
        }
        return {
            data,
            error: null,
            success: true,
        };
    }
}