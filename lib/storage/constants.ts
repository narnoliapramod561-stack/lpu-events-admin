/**
 * Storage Infrastructure Constants
 * 
 * Defines canonical storage configuration, media types, limits, and conventions
 * for Cloudflare R2 integration across all LPU Events applications.
 * 
 * @module storage/constants
 */

/**
 * Allowed MIME types for event media uploads
 */
export const ALLOWED_MIME_TYPES = {
    IMAGES: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
    ] as const,
    DOCUMENTS: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ] as const,
} as const;

/**
 * Maximum file sizes in bytes
 */
export const MAX_FILE_SIZES = {
    IMAGE: 10 * 1024 * 1024, // 10MB
    DOCUMENT: 50 * 1024 * 1024, // 50MB
    POSTER: 5 * 1024 * 1024, // 5MB (optimized poster images)
} as const;

/**
 * Image dimension constraints
 */
export const IMAGE_CONSTRAINTS = {
    POSTER: {
        MIN_WIDTH: 800,
        MIN_HEIGHT: 600,
        MAX_WIDTH: 4096,
        MAX_HEIGHT: 4096,
        ASPECT_RATIO_MIN: 0.5, // width/height
        ASPECT_RATIO_MAX: 2.0,
    },
    GALLERY: {
        MIN_WIDTH: 400,
        MIN_HEIGHT: 300,
        MAX_WIDTH: 4096,
        MAX_HEIGHT: 4096,
    },
} as const;

/**
 * Storage bucket names (from environment)
 */
export const STORAGE_BUCKETS = {
    EVENT_IMAGES: 'event-images',
    BACKUPS: 'backups',
    ARCHIVE: 'archive',
} as const;

/**
 * Media directory structure within buckets
 * 
 * Structure:
 * events/
 *   posters/
 *     {event-id}/
 *       {timestamp}-{hash}.webp
 *   gallery/
 *     {event-id}/
 *       {timestamp}-{hash}.webp
 *   documents/
 *     {event-id}/
 *       {timestamp}-{hash}.pdf
 */
export const MEDIA_PATHS = {
    EVENTS: 'events',
    POSTERS: 'events/posters',
    GALLERY: 'events/gallery',
    DOCUMENTS: 'events/documents',
} as const;

/**
 * Upload rate limits
 */
export const UPLOAD_LIMITS = {
    PER_HOUR: 20,
    PER_DAY: 100,
    CONCURRENT: 3,
} as const;

/**
 * File extension mappings
 */
export const FILE_EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
} as const;

/**
 * CDN configuration
 */
export const CDN_CONFIG = {
    CACHE_TTL: 31536000, // 1 year in seconds
    PUBLIC_URL_PREFIX: 'https://cdn.lpuevents.com',
} as const;

/**
 * Storage regions (Cloudflare R2 auto-distributes globally)
 */
export const STORAGE_REGIONS = {
    PRIMARY: 'auto',
    FALLBACK: 'auto',
} as const;

/**
 * Upload validation settings
 */
export const VALIDATION_CONFIG = {
    ENABLE_VIRUS_SCAN: true,
    ENABLE_CONTENT_VERIFICATION: true,
    ENABLE_DUPLICATE_DETECTION: true,
    MAX_FILENAME_LENGTH: 255,
    ALLOWED_FILENAME_PATTERN: /^[a-zA-Z0-9_\-. ]+$/,
} as const;

/**
 * Temporary upload expiration (for unused signed URLs)
 */
export const TEMP_UPLOAD_EXPIRY = {
    SIGNED_URL_TTL: 3600, // 1 hour in seconds
    CLEANUP_AFTER: 86400, // 24 hours in seconds
} as const;

/**
 * Media type identifiers
 */
export enum MediaType {
    POSTER = 'poster',
    GALLERY = 'gallery',
    DOCUMENT = 'document',
}

/**
 * Upload status
 */
export enum UploadStatus {
    PENDING = 'pending',
    UPLOADING = 'uploading',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

/**
 * Access control settings
 */
export const ACCESS_CONTROL = {
    PUBLIC_ASSETS: ['poster', 'gallery'],
    PRIVATE_ASSETS: ['document'],
    CORS_ALLOWED_ORIGINS: ['*'], // Configure per environment
    CORS_ALLOWED_METHODS: ['GET', 'HEAD'],
} as const;
