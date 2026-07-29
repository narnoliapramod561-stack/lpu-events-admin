import { ServiceResult } from "./types";

export abstract class BaseService {
    protected handleResult<T>(data: T | null, error: unknown): ServiceResult<T> {
        if (error) {
            // Service error handled gracefully
            // Error message returned to caller
            let message = "An unexpected error occurred";
            if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
                message = (error as any).message;
            }
            return {
                data: null,
                error: message,
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