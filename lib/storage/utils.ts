/**
 * Storage Path and Naming Utilities
 * 
 * Utilities for generating storage keys, sanitizing filenames, and managing paths
 * 
 * @module storage/utils
 */

import { MEDIA_PATHS, MediaType, FILE_EXTENSIONS } from './constants';
import type { StorageKeyOptions, StoragePathInfo } from './types';

/**
 * Generate a secure, unique storage key for a file
 * 
 * Format: {media-path}/{event-id}/{timestamp}-{random-hash}{extension}
 * Example: events/posters/abc123/1234567890-a1b2c3d4.jpg
 */
export function generateStorageKey(options: StorageKeyOptions): string {
    const { eventId, mediaType, filename } = options;

    // Get base path for media type
    const basePath = getMediaPath(mediaType);

    // Sanitize filename
    const sanitized = sanitizeFilename(filename);

    // Extract extension
    const extension = getFileExtension(sanitized);

    // Generate unique identifier
    const timestamp = Date.now();
    const randomHash = generateRandomHash(8);

    // Construct storage key
    const storageKey = `${basePath}/${eventId}/${timestamp}-${randomHash}${extension}`;

    return storageKey;
}

/**
 * Sanitize filename to remove dangerous characters
 */
export function sanitizeFilename(filename: string): string {
    // Remove path separators
    let sanitized = filename.replace(/[/\\]/g, '');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Replace spaces with hyphens
    sanitized = sanitized.replace(/\s+/g, '-');

    // Remove multiple consecutive hyphens
    sanitized = sanitized.replace(/-+/g, '-');

    // Remove leading/trailing hyphens and dots
    sanitized = sanitized.replace(/^[.-]+|[.-]+$/g, '');

    // Only keep alphanumeric, hyphens, underscores, and dots
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');

    // Ensure filename is not empty
    if (!sanitized) {
        sanitized = 'unnamed';
    }

    // Truncate to reasonable length (255 chars max)
    if (sanitized.length > 255) {
        const ext = getFileExtension(sanitized);
        const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
        sanitized = nameWithoutExt.substring(0, 255 - ext.length) + ext;
    }

    return sanitized;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
}

/**
 * Get extension for MIME type
 */
export function getExtensionForMimeType(mimeType: string): string {
    return FILE_EXTENSIONS[mimeType as keyof typeof FILE_EXTENSIONS] || '';
}

/**
 * Get media path for media type
 */
export function getMediaPath(mediaType: MediaType): string {
    switch (mediaType) {
        case MediaType.POSTER:
            return MEDIA_PATHS.POSTERS;
        case MediaType.GALLERY:
            return MEDIA_PATHS.GALLERY;
        case MediaType.DOCUMENT:
            return MEDIA_PATHS.DOCUMENTS;
        default:
            return MEDIA_PATHS.EVENTS;
    }
}

/**
 * Parse storage key into components
 */
export function parseStorageKey(storageKey: string): StoragePathInfo | null {
    const parts = storageKey.split('/');

    if (parts.length < 3) {
        return null;
    }

    // Extract components
    // Format: events/{type}/{event-id}/{filename}
    const bucket = 'event-images'; // Default bucket
    const prefix = parts.slice(0, -2).join('/');
    const key = storageKey;
    const fullPath = storageKey;

    return {
        bucket,
        prefix,
        key,
        fullPath,
    };
}

/**
 * Generate random hash
 */
export function generateRandomHash(length: number = 16): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    // Use crypto if available (browser/Node.js 19+)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const values = new Uint8Array(length);
        crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            result += chars[values[i] % chars.length];
        }
    } else {
        // Fallback for older environments
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
    }

    return result;
}

/**
 * Generate public URL for storage key
 */
export function generatePublicUrl(
    storageKey: string,
    bucketName: string,
    publicUrlPrefix?: string,
): string {
    if (publicUrlPrefix) {
        return `${publicUrlPrefix}/${storageKey}`;
    }

    // Default Cloudflare R2 public URL format
    return `https://pub-${bucketName}.r2.dev/${storageKey}`;
}

/**
 * Extract event ID from storage key
 */
export function extractEventIdFromKey(storageKey: string): string | null {
    const parts = storageKey.split('/');

    // Format: events/{type}/{event-id}/{filename}
    if (parts.length >= 3) {
        return parts[2];
    }

    return null;
}

/**
 * Extract media type from storage key
 */
export function extractMediaTypeFromKey(storageKey: string): MediaType | null {
    if (storageKey.startsWith(MEDIA_PATHS.POSTERS)) {
        return MediaType.POSTER;
    }
    if (storageKey.startsWith(MEDIA_PATHS.GALLERY)) {
        return MediaType.GALLERY;
    }
    if (storageKey.startsWith(MEDIA_PATHS.DOCUMENTS)) {
        return MediaType.DOCUMENT;
    }
    return null;
}

/**
 * Generate temporary filename for processing
 */
export function generateTempFilename(originalFilename: string): string {
    const sanitized = sanitizeFilename(originalFilename);
    const timestamp = Date.now();
    const hash = generateRandomHash(8);
    const extension = getFileExtension(sanitized);

    return `temp-${timestamp}-${hash}${extension}`;
}

/**
 * Check if storage key is valid format
 */
export function isValidStorageKey(storageKey: string): boolean {
    // Must start with valid media path
    const validPaths = [
        MEDIA_PATHS.POSTERS,
        MEDIA_PATHS.GALLERY,
        MEDIA_PATHS.DOCUMENTS,
    ];

    const startsWithValidPath = validPaths.some((path) =>
        storageKey.startsWith(path),
    );

    if (!startsWithValidPath) {
        return false;
    }

    // Must have at least 4 parts: media/type/event-id/filename
    const parts = storageKey.split('/');
    if (parts.length < 4) {
        return false;
    }

    // Event ID should be UUID format (basic check)
    const eventId = parts[2];
    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(eventId)) {
        return false;
    }

    return true;
}

/**
 * Get filename from storage key
 */
export function getFilenameFromKey(storageKey: string): string {
    const parts = storageKey.split('/');
    return parts[parts.length - 1] || '';
}

/**
 * Build storage key for specific file
 */
export function buildStorageKey(
    mediaType: MediaType,
    eventId: string,
    filename: string,
): string {
    const basePath = getMediaPath(mediaType);
    const sanitized = sanitizeFilename(filename);
    return `${basePath}/${eventId}/${sanitized}`;
}

/**
 * Calculate checksum (simple hash for demonstration)
 * In production, use proper SHA-256
 */
export function calculateChecksum(data: string | Buffer): string {
    // Simple hash implementation
    // In production, use crypto.createHash('sha256')
    let hash = 0;
    const str = typeof data === 'string' ? data : data.toString('base64');

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Normalize path separators
 */
export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Join path segments safely
 */
export function joinPath(...segments: string[]): string {
    return segments
        .filter((s) => s.length > 0)
        .join('/')
        .replace(/\/+/g, '/');
}
