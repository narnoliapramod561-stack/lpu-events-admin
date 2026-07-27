/**
 * Storage Validation Utilities
 * 
 * Comprehensive validation for file uploads, filenames, paths, and media
 * 
 * @module storage/validators
 */

import {
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZES,
    IMAGE_CONSTRAINTS,
    VALIDATION_CONFIG,
    MediaType,
    FILE_EXTENSIONS,
} from './constants';
import type {
    ValidationResult,
    ValidationError,
    ValidationErrorCode,
} from './types';

/**
 * Validate MIME type
 */
export function validateMimeType(
    mimeType: string,
    mediaType: MediaType,
): ValidationResult {
    const errors: ValidationError[] = [];

    const allowedTypes =
        mediaType === MediaType.DOCUMENT
            ? ALLOWED_MIME_TYPES.DOCUMENTS
            : ALLOWED_MIME_TYPES.IMAGES;

    if (!allowedTypes.includes(mimeType as never)) {
        errors.push({
            field: 'mimeType',
            message: `Invalid MIME type: ${mimeType}. Allowed types: ${allowedTypes.join(', ')}`,
            code: 'INVALID_MIME_TYPE' as ValidationErrorCode,
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate file size
 */
export function validateFileSize(
    size: number,
    mediaType: MediaType,
): ValidationResult {
    const errors: ValidationError[] = [];

    const maxSize =
        mediaType === MediaType.POSTER
            ? MAX_FILE_SIZES.POSTER
            : mediaType === MediaType.DOCUMENT
                ? MAX_FILE_SIZES.DOCUMENT
                : MAX_FILE_SIZES.IMAGE;

    if (size > maxSize) {
        errors.push({
            field: 'size',
            message: `File size ${formatBytes(size)} exceeds maximum ${formatBytes(maxSize)}`,
            code: 'FILE_TOO_LARGE' as ValidationErrorCode,
        });
    }

    if (size <= 0) {
        errors.push({
            field: 'size',
            message: 'File size must be greater than 0',
            code: 'INVALID_DIMENSIONS' as ValidationErrorCode,
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate filename
 */
export function validateFilename(filename: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!filename || filename.trim().length === 0) {
        errors.push({
            field: 'filename',
            message: 'Filename cannot be empty',
            code: 'MISSING_REQUIRED' as ValidationErrorCode,
        });
        return { valid: false, errors };
    }

    if (filename.length > VALIDATION_CONFIG.MAX_FILENAME_LENGTH) {
        errors.push({
            field: 'filename',
            message: `Filename exceeds maximum length of ${VALIDATION_CONFIG.MAX_FILENAME_LENGTH} characters`,
            code: 'INVALID_FILENAME' as ValidationErrorCode,
        });
    }

    if (!VALIDATION_CONFIG.ALLOWED_FILENAME_PATTERN.test(filename)) {
        errors.push({
            field: 'filename',
            message:
                'Filename contains invalid characters. Only alphanumeric, spaces, hyphens, underscores, and dots are allowed',
            code: 'INVALID_FILENAME' as ValidationErrorCode,
        });
    }

    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        errors.push({
            field: 'filename',
            message: 'Filename contains invalid path characters',
            code: 'PATH_TRAVERSAL' as ValidationErrorCode,
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate image dimensions
 */
export function validateImageDimensions(
    width: number,
    height: number,
    mediaType: MediaType,
): ValidationResult {
    const errors: ValidationError[] = [];

    if (mediaType === MediaType.DOCUMENT) {
        // Documents don't have dimension requirements
        return { valid: true, errors: [] };
    }

    const constraints =
        mediaType === MediaType.POSTER
            ? IMAGE_CONSTRAINTS.POSTER
            : IMAGE_CONSTRAINTS.GALLERY;

    if (width < constraints.MIN_WIDTH || height < constraints.MIN_HEIGHT) {
        errors.push({
            field: 'dimensions',
            message: `Image dimensions ${width}x${height} are below minimum ${constraints.MIN_WIDTH}x${constraints.MIN_HEIGHT}`,
            code: 'INVALID_DIMENSIONS' as ValidationErrorCode,
        });
    }

    if (width > constraints.MAX_WIDTH || height > constraints.MAX_HEIGHT) {
        errors.push({
            field: 'dimensions',
            message: `Image dimensions ${width}x${height} exceed maximum ${constraints.MAX_WIDTH}x${constraints.MAX_HEIGHT}`,
            code: 'INVALID_DIMENSIONS' as ValidationErrorCode,
        });
    }

    // Check aspect ratio for posters
    if (mediaType === MediaType.POSTER && 'ASPECT_RATIO_MIN' in constraints) {
        const aspectRatio = width / height;
        if (
            aspectRatio < constraints.ASPECT_RATIO_MIN ||
            aspectRatio > constraints.ASPECT_RATIO_MAX
        ) {
            errors.push({
                field: 'dimensions',
                message: `Image aspect ratio ${aspectRatio.toFixed(2)} is outside allowed range ${constraints.ASPECT_RATIO_MIN}-${constraints.ASPECT_RATIO_MAX}`,
                code: 'INVALID_DIMENSIONS' as ValidationErrorCode,
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate event ID format (UUID v4)
 */
export function validateEventId(eventId: string): ValidationResult {
    const errors: ValidationError[] = [];

    const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidV4Regex.test(eventId)) {
        errors.push({
            field: 'eventId',
            message: 'Invalid event ID format (must be UUID v4)',
            code: 'INVALID_EVENT_ID' as ValidationErrorCode,
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate file extension matches MIME type
 */
export function validateExtension(
    filename: string,
    mimeType: string,
): ValidationResult {
    const errors: ValidationError[] = [];

    const expectedExtension =
        FILE_EXTENSIONS[mimeType as keyof typeof FILE_EXTENSIONS];

    if (!expectedExtension) {
        errors.push({
            field: 'extension',
            message: `Unknown MIME type: ${mimeType}`,
            code: 'INVALID_MIME_TYPE' as ValidationErrorCode,
        });
        return { valid: false, errors };
    }

    const actualExtension = getFileExtension(filename);

    if (actualExtension.toLowerCase() !== expectedExtension.toLowerCase()) {
        errors.push({
            field: 'extension',
            message: `File extension ${actualExtension} does not match MIME type ${mimeType} (expected ${expectedExtension})`,
            code: 'INVALID_FILENAME' as ValidationErrorCode,
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Comprehensive file validation
 */
export function validateFile(
    filename: string,
    mimeType: string,
    size: number,
    mediaType: MediaType,
    dimensions?: { width: number; height: number },
): ValidationResult {
    const allErrors: ValidationError[] = [];

    // Validate filename
    const filenameResult = validateFilename(filename);
    allErrors.push(...filenameResult.errors);

    // Validate MIME type
    const mimeResult = validateMimeType(mimeType, mediaType);
    allErrors.push(...mimeResult.errors);

    // Validate extension
    const extResult = validateExtension(filename, mimeType);
    allErrors.push(...extResult.errors);

    // Validate file size
    const sizeResult = validateFileSize(size, mediaType);
    allErrors.push(...sizeResult.errors);

    // Validate dimensions for images
    if (dimensions && mediaType !== MediaType.DOCUMENT) {
        const dimResult = validateImageDimensions(
            dimensions.width,
            dimensions.height,
            mediaType,
        );
        allErrors.push(...dimResult.errors);
    }

    return {
        valid: allErrors.length === 0,
        errors: allErrors,
    };
}

/**
 * Validate storage path for security
 */
export function validateStoragePath(path: string): ValidationResult {
    const errors: ValidationError[] = [];

    // Check for path traversal
    if (path.includes('..')) {
        errors.push({
            field: 'path',
            message: 'Path contains invalid traversal sequence (..)',
            code: 'PATH_TRAVERSAL' as ValidationErrorCode,
        });
    }

    // Check for absolute paths
    if (path.startsWith('/') || path.startsWith('\\')) {
        errors.push({
            field: 'path',
            message: 'Path must be relative',
            code: 'PATH_TRAVERSAL' as ValidationErrorCode,
        });
    }

    // Check for null bytes
    if (path.includes('\0')) {
        errors.push({
            field: 'path',
            message: 'Path contains null bytes',
            code: 'PATH_TRAVERSAL' as ValidationErrorCode,
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Helper: Get file extension from filename
 */
function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
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

/**
 * Check if MIME type is an image
 */
export function isImageMimeType(mimeType: string): boolean {
    return ALLOWED_MIME_TYPES.IMAGES.includes(mimeType as never);
}

/**
 * Check if MIME type is a document
 */
export function isDocumentMimeType(mimeType: string): boolean {
    return ALLOWED_MIME_TYPES.DOCUMENTS.includes(mimeType as never);
}

/**
 * Get media type from MIME type
 */
export function getMediaTypeFromMime(mimeType: string): MediaType | null {
    if (isImageMimeType(mimeType)) {
        return MediaType.GALLERY; // Default to gallery for images
    }
    if (isDocumentMimeType(mimeType)) {
        return MediaType.DOCUMENT;
    }
    return null;
}
