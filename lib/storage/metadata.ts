/**
 * Storage Metadata Helpers
 * 
 * Utilities for creating and managing file metadata
 * 
 * @module storage/metadata
 */

import { MediaType } from './constants';
import type { FileMetadata } from './types';
import {
    generateStorageKey,
    sanitizeFilename,
    getFileExtension,
    generatePublicUrl,
    calculateChecksum,
} from './utils';

/**
 * Create file metadata from upload information
 */
export function createFileMetadata(params: {
    originalName: string;
    mimeType: string;
    size: number;
    eventId: string;
    mediaType: MediaType;
    userId: string;
    bucketName: string;
    publicUrlPrefix?: string;
    dimensions?: { width: number; height: number };
    checksum?: string;
}): FileMetadata {
    const {
        originalName,
        mimeType,
        size,
        eventId,
        mediaType,
        userId,
        bucketName,
        publicUrlPrefix,
        dimensions,
        checksum,
    } = params;

    // Sanitize filename
    const sanitizedName = sanitizeFilename(originalName);

    // Generate storage key
    const storageKey = generateStorageKey({
        eventId,
        mediaType,
        filename: sanitizedName,
        userId,
    });

    // Generate public URL
    const publicUrl = generatePublicUrl(storageKey, bucketName, publicUrlPrefix);

    // Extract extension
    const extension = getFileExtension(sanitizedName);

    const metadata: FileMetadata = {
        originalName,
        sanitizedName,
        storageKey,
        mimeType,
        size,
        extension,
        uploadedAt: new Date(),
        uploadedBy: userId,
        eventId,
        mediaType,
        publicUrl,
        checksum,
        dimensions,
    };

    return metadata;
}

/**
 * Update file metadata
 */
export function updateFileMetadata(
    existing: FileMetadata,
    updates: Partial<FileMetadata>,
): FileMetadata {
    return {
        ...existing,
        ...updates,
    };
}

/**
 * Serialize metadata to JSON
 */
export function serializeMetadata(metadata: FileMetadata): string {
    return JSON.stringify(
        {
            ...metadata,
            uploadedAt: metadata.uploadedAt.toISOString(),
        },
        null,
        2,
    );
}

/**
 * Deserialize metadata from JSON
 */
export function deserializeMetadata(json: string): FileMetadata {
    const parsed = JSON.parse(json);

    return {
        ...parsed,
        uploadedAt: new Date(parsed.uploadedAt),
    };
}

/**
 * Extract metadata from file object (browser)
 */
export async function extractFileMetadata(
    file: File,
    mediaType: MediaType,
): Promise<{
    name: string;
    mimeType: string;
    size: number;
    dimensions?: { width: number; height: number };
}> {
    const metadata = {
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dimensions: undefined as { width: number; height: number } | undefined,
    };

    // Extract dimensions for images
    if (file.type.startsWith('image/') && mediaType !== MediaType.DOCUMENT) {
        try {
            metadata.dimensions = await getImageDimensions(file);
        } catch (error) {
            // Dimensions extraction failed, continue without them
            // Error logged in production via error tracking service
        }
    }

    return metadata;
}

/**
 * Get image dimensions from file
 */
export function getImageDimensions(
    file: File,
): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            resolve({
                width: img.width,
                height: img.height,
            });
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        // Create object URL for the file
        const url = URL.createObjectURL(file);
        img.src = url;

        // Clean up object URL after image loads
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({
                width: img.width,
                height: img.height,
            });
        };
    });
}

/**
 * Create metadata summary for logging
 */
export function createMetadataSummary(metadata: FileMetadata): string {
    return [
        `File: ${metadata.originalName}`,
        `Type: ${metadata.mimeType}`,
        `Size: ${formatBytes(metadata.size)}`,
        `Storage Key: ${metadata.storageKey}`,
        `Event: ${metadata.eventId}`,
        metadata.dimensions
            ? `Dimensions: ${metadata.dimensions.width}x${metadata.dimensions.height}`
            : null,
        `Uploaded: ${metadata.uploadedAt.toISOString()}`,
        `By: ${metadata.uploadedBy}`,
    ]
        .filter(Boolean)
        .join(' | ');
}

/**
 * Validate metadata completeness
 */
export function validateMetadata(metadata: Partial<FileMetadata>): {
    valid: boolean;
    missing: string[];
} {
    const required: (keyof FileMetadata)[] = [
        'originalName',
        'sanitizedName',
        'storageKey',
        'mimeType',
        'size',
        'extension',
        'uploadedAt',
        'uploadedBy',
        'mediaType',
    ];

    const missing = required.filter((key) => !metadata[key]);

    return {
        valid: missing.length === 0,
        missing,
    };
}

/**
 * Compare two metadata objects
 */
export function compareMetadata(
    a: FileMetadata,
    b: FileMetadata,
): {
    identical: boolean;
    differences: string[];
} {
    const differences: string[] = [];

    const keys: (keyof FileMetadata)[] = [
        'originalName',
        'sanitizedName',
        'storageKey',
        'mimeType',
        'size',
        'extension',
        'mediaType',
        'checksum',
    ];

    for (const key of keys) {
        if (a[key] !== b[key]) {
            differences.push(
                `${key}: ${JSON.stringify(a[key])} vs ${JSON.stringify(b[key])}`,
            );
        }
    }

    return {
        identical: differences.length === 0,
        differences,
    };
}

/**
 * Create metadata for database storage
 */
export function createDatabaseMetadata(metadata: FileMetadata): Record<string, unknown> {
    return {
        original_name: metadata.originalName,
        sanitized_name: metadata.sanitizedName,
        storage_key: metadata.storageKey,
        mime_type: metadata.mimeType,
        size: metadata.size,
        extension: metadata.extension,
        uploaded_at: metadata.uploadedAt.toISOString(),
        uploaded_by: metadata.uploadedBy,
        event_id: metadata.eventId,
        media_type: metadata.mediaType,
        public_url: metadata.publicUrl,
        checksum: metadata.checksum,
        width: metadata.dimensions?.width,
        height: metadata.dimensions?.height,
    };
}

/**
 * Parse metadata from database record
 */
export function parseDatabaseMetadata(record: Record<string, unknown>): FileMetadata {
    return {
        originalName: String(record.original_name || record.originalName || ''),
        sanitizedName: String(record.sanitized_name || record.sanitizedName || ''),
        storageKey: String(record.storage_key || record.storageKey || ''),
        mimeType: String(record.mime_type || record.mimeType || ''),
        size: Number(record.size || 0),
        extension: String(record.extension || ''),
        uploadedAt: new Date(
            String(record.uploaded_at || record.uploadedAt || new Date()),
        ),
        uploadedBy: String(record.uploaded_by || record.uploadedBy || ''),
        eventId: String(record.event_id || record.eventId || ''),
        mediaType: String(record.media_type || record.mediaType || '') as MediaType,
        publicUrl: record.public_url
            ? String(record.public_url)
            : record.publicUrl
                ? String(record.publicUrl)
                : undefined,
        checksum: record.checksum ? String(record.checksum) : undefined,
        dimensions:
            record.width && record.height
                ? {
                    width: Number(record.width),
                    height: Number(record.height),
                }
                : undefined,
    };
}

/**
 * Helper: Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
