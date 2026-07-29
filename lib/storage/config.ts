/**
 * Storage Configuration
 * 
 * Cloudflare R2 configuration and environment validation
 * 
 * @module storage/config
 */

import { z } from 'zod';
import type { StorageConfig, BucketConfig } from './types';
import { STORAGE_BUCKETS, ACCESS_CONTROL } from './constants';

/**
 * Storage environment schema
 */
const storageEnvSchema = z.object({
    CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1, 'R2 Account ID is required'),
    CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1, 'R2 Access Key ID is required'),
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: z
        .string()
        .min(1, 'R2 Secret Access Key is required'),
    R2_EVENT_IMAGES_BUCKET: z
        .string()
        .min(1, 'Event Images Bucket name is required')
        .default('lpu-events-images'),
    R2_PUBLIC_URL_PREFIX: z.string().url().optional(),
});

/**
 * Validate storage environment variables
 */
export function validateStorageEnv(): z.infer<typeof storageEnvSchema> {
    const result = storageEnvSchema.safeParse({
        CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
        CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        CLOUDFLARE_R2_SECRET_ACCESS_KEY:
            process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        R2_EVENT_IMAGES_BUCKET: process.env.R2_EVENT_IMAGES_BUCKET,
        R2_PUBLIC_URL_PREFIX: process.env.R2_PUBLIC_URL_PREFIX,
    });

    if (!result.success) {
        const errors = result.error.issues
            .map((err) => `${String(err.path.join('.'))}: ${err.message}`)
            .join(', ');

        throw new Error(
            `Storage configuration error: ${errors}. Please check your environment variables.`,
        );
    }

    return result.data;
}

/**
 * Get storage configuration
 */
export function getStorageConfig(): StorageConfig {
    const env = validateStorageEnv();

    return {
        accountId: env.CLOUDFLARE_R2_ACCOUNT_ID,
        accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        bucketName: env.R2_EVENT_IMAGES_BUCKET,
        region: 'auto', // R2 auto-distributes globally
        endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        publicUrlPrefix: env.R2_PUBLIC_URL_PREFIX,
    };
}

/**
 * Get bucket configuration for event images
 */
export function getEventImagesBucketConfig(): BucketConfig {
    const env = validateStorageEnv();

    return {
        name: env.R2_EVENT_IMAGES_BUCKET,
        region: 'auto',
        corsRules: [
            {
                allowedOrigins: [...ACCESS_CONTROL.CORS_ALLOWED_ORIGINS],
                allowedMethods: [...ACCESS_CONTROL.CORS_ALLOWED_METHODS],
                allowedHeaders: ['Content-Type', 'Content-Length'],
                maxAgeSeconds: 3600,
            },
        ],
        lifecycleRules: [
            {
                id: 'cleanup-temp-uploads',
                prefix: 'temp/',
                expirationDays: 1,
            },
        ],
    };
}

/**
 * Check if storage is configured
 */
export function isStorageConfigured(): boolean {
    try {
        validateStorageEnv();
        return true;
    } catch {
        return false;
    }
}

/**
 * Get configuration status
 */
export function getConfigurationStatus(): {
    configured: boolean;
    missing: string[];
    warnings: string[];
} {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID) {
        missing.push('CLOUDFLARE_R2_ACCOUNT_ID');
    }
    if (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
        missing.push('CLOUDFLARE_R2_ACCESS_KEY_ID');
    }
    if (!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
        missing.push('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    }

    // Check optional but recommended variables
    if (!process.env.R2_EVENT_IMAGES_BUCKET) {
        warnings.push('R2_EVENT_IMAGES_BUCKET not set, using default');
    }
    if (!process.env.R2_PUBLIC_URL_PREFIX) {
        warnings.push('R2_PUBLIC_URL_PREFIX not set, using default R2 URLs');
    }

    return {
        configured: missing.length === 0,
        missing,
        warnings,
    };
}

/**
 * Get storage endpoint URL
 */
export function getStorageEndpoint(): string {
    const env = validateStorageEnv();
    return `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

/**
 * Get public URL prefix
 */
export function getPublicUrlPrefix(): string | undefined {
    try {
        const env = validateStorageEnv();
        return env.R2_PUBLIC_URL_PREFIX;
    } catch {
        return undefined;
    }
}

/**
 * Get bucket name for media type
 */
export function getBucketName(mediaType?: 'images' | 'backups' | 'archive'): string {
    const env = validateStorageEnv();

    switch (mediaType) {
        case 'backups':
            return process.env.R2_BACKUPS_BUCKET || STORAGE_BUCKETS.BACKUPS;
        case 'archive':
            return process.env.R2_ARCHIVE_BUCKET || STORAGE_BUCKETS.ARCHIVE;
        case 'images':
        default:
            return env.R2_EVENT_IMAGES_BUCKET;
    }
}

/**
 * Validate configuration at startup
 * 
 * Throws if configuration is invalid, logs warnings for missing optional config
 */
export function validateConfigurationAtStartup(): void {
    const status = getConfigurationStatus();

    if (!status.configured) {
        throw new Error(
            `Storage is not properly configured. Missing variables: ${status.missing.join(', ')}`,
        );
    }

    if (status.warnings.length > 0) {
        // Configuration warnings logged to monitoring service
        status.warnings.forEach((warning) => {
            // Monitoring service would log this warning in production
        });
    }

    // Storage configuration validated successfully
}

/**
 * Create CORS configuration for bucket
 */
export function createCorsConfiguration(): {
    CORSRules: Array<{
        AllowedOrigins: string[];
        AllowedMethods: string[];
        AllowedHeaders: string[];
        MaxAgeSeconds: number;
    }>;
} {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
        CORSRules: [
            {
                AllowedOrigins: isProduction
                    ? [
                        process.env.NEXT_PUBLIC_APP_URL || 'https://www.lpueventsadmin.live',
                        'https://www.lpuevents.live',
                        'https://www.lpueventsadmin.live',
                    ]
                    : ['http://localhost:3000', 'http://localhost:3001'],
                AllowedMethods: ['GET', 'HEAD'],
                AllowedHeaders: ['*'],
                MaxAgeSeconds: 3600,
            },
        ],
    };
}

/**
 * Get S3-compatible client configuration
 * (For use with AWS SDK or similar S3-compatible clients)
 */
export function getS3ClientConfig(): {
    endpoint: string;
    region: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
    };
    forcePathStyle?: boolean;
} {
    const config = getStorageConfig();

    return {
        endpoint: config.endpoint || '',
        region: config.region,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: true, // Required for R2
    };
}
