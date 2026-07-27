/**
 * Storage Infrastructure Type Definitions
 * 
 * Type definitions for storage operations, metadata, and configurations
 * 
 * @module storage/types
 */

import { MediaType, UploadStatus } from './constants';

/**
 * Storage configuration
 */
export interface StorageConfig {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    region: string;
    endpoint?: string;
    publicUrlPrefix?: string;
}

/**
 * File metadata
 */
export interface FileMetadata {
    /** Original filename */
    originalName: string;

    /** Sanitized filename */
    sanitizedName: string;

    /** Storage key (full path in bucket) */
    storageKey: string;

    /** MIME type */
    mimeType: string;

    /** File size in bytes */
    size: number;

    /** File extension */
    extension: string;

    /** Upload timestamp */
    uploadedAt: Date;

    /** Uploader user ID */
    uploadedBy: string;

    /** Associated event ID */
    eventId?: string;

    /** Media type */
    mediaType: MediaType;

    /** Public URL */
    publicUrl?: string;

    /** Checksum (SHA-256) */
    checksum?: string;

    /** Image dimensions (if applicable) */
    dimensions?: {
        width: number;
        height: number;
    };
}

/**
 * Upload validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
    field: string;
    message: string;
    code: ValidationErrorCode;
}

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
    INVALID_MIME_TYPE = 'INVALID_MIME_TYPE',
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    INVALID_FILENAME = 'INVALID_FILENAME',
    INVALID_DIMENSIONS = 'INVALID_DIMENSIONS',
    PATH_TRAVERSAL = 'PATH_TRAVERSAL',
    MISSING_REQUIRED = 'MISSING_REQUIRED',
    INVALID_EVENT_ID = 'INVALID_EVENT_ID',
}

/**
 * Storage key generation options
 */
export interface StorageKeyOptions {
    eventId: string;
    mediaType: MediaType;
    filename: string;
    userId: string;
}

/**
 * Upload request
 */
export interface UploadRequest {
    file: File | Buffer;
    eventId: string;
    mediaType: MediaType;
    userId: string;
    metadata?: Partial<FileMetadata>;
}

/**
 * Upload response
 */
export interface UploadResponse {
    success: boolean;
    storageKey: string;
    publicUrl: string;
    metadata: FileMetadata;
    error?: string;
}

/**
 * Signed URL request
 */
export interface SignedUrlRequest {
    storageKey: string;
    expiresIn?: number;
    contentType?: string;
}

/**
 * Signed URL response
 */
export interface SignedUrlResponse {
    url: string;
    expiresAt: Date;
    storageKey: string;
}

/**
 * Storage operation result
 */
export interface StorageOperationResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: StorageError;
}

/**
 * Storage error
 */
export interface StorageError {
    code: StorageErrorCode;
    message: string;
    details?: unknown;
}

/**
 * Storage error codes
 */
export enum StorageErrorCode {
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    UPLOAD_FAILED = 'UPLOAD_FAILED',
    DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
    DELETE_FAILED = 'DELETE_FAILED',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    NOT_FOUND = 'NOT_FOUND',
    BUCKET_ERROR = 'BUCKET_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Bucket configuration
 */
export interface BucketConfig {
    name: string;
    region: string;
    corsRules: CorsRule[];
    lifecycleRules?: LifecycleRule[];
}

/**
 * CORS rule configuration
 */
export interface CorsRule {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    maxAgeSeconds?: number;
}

/**
 * Lifecycle rule configuration
 */
export interface LifecycleRule {
    id: string;
    prefix: string;
    expirationDays?: number;
    transitionDays?: number;
}

/**
 * Upload progress callback
 */
export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * Upload progress
 */
export interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
    status: UploadStatus;
}

/**
 * Storage path info
 */
export interface StoragePathInfo {
    bucket: string;
    prefix: string;
    key: string;
    fullPath: string;
}

/**
 * Media URL options
 */
export interface MediaUrlOptions {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
}
