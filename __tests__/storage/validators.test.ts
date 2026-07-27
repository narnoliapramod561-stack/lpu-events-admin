/**
 * Storage Validators Test Suite
 * 
 * Tests for file validation, MIME type checking, and security validation
 */

import {
    validateMimeType,
    validateFileSize,
    validateFilename,
    validateImageDimensions,
    validateEventId,
    validateExtension,
    validateFile,
    validateStoragePath,
    isImageMimeType,
    isDocumentMimeType,
    getMediaTypeFromMime,
} from '../../lib/storage/validators';
import { describe, it, expect } from '@jest/globals';
import { MediaType } from '../../lib/storage/constants';

describe('Storage Validators', () => {
    describe('validateMimeType', () => {
        it('should accept valid image MIME types', () => {
            const result = validateMimeType('image/jpeg', MediaType.POSTER);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should accept valid document MIME types', () => {
            const result = validateMimeType('application/pdf', MediaType.DOCUMENT);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject invalid MIME types', () => {
            const result = validateMimeType('application/exe', MediaType.POSTER);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].code).toBe('INVALID_MIME_TYPE');
        });

        it('should reject document MIME for image media type', () => {
            const result = validateMimeType('application/pdf', MediaType.POSTER);
            expect(result.valid).toBe(false);
        });
    });

    describe('validateFileSize', () => {
        it('should accept file within size limit', () => {
            const result = validateFileSize(1024 * 1024, MediaType.POSTER); // 1MB
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject file exceeding poster size limit', () => {
            const result = validateFileSize(6 * 1024 * 1024, MediaType.POSTER); // 6MB
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
        });

        it('should reject file exceeding document size limit', () => {
            const result = validateFileSize(51 * 1024 * 1024, MediaType.DOCUMENT); // 51MB
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
        });

        it('should reject zero or negative file size', () => {
            const result = validateFileSize(0, MediaType.GALLERY);
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_DIMENSIONS');
        });
    });

    describe('validateFilename', () => {
        it('should accept valid filename', () => {
            const result = validateFilename('event-poster.jpg');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject empty filename', () => {
            const result = validateFilename('');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('MISSING_REQUIRED');
        });

        it('should reject filename with path traversal', () => {
            const result = validateFilename('../../../etc/passwd');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'PATH_TRAVERSAL')).toBe(true);
        });

        it('should reject filename with invalid characters', () => {
            const result = validateFilename('file<script>.jpg');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_FILENAME');
        });

        it('should reject filename with slashes', () => {
            const result = validateFilename('path/to/file.jpg');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'PATH_TRAVERSAL')).toBe(true);
        });

        it('should reject filename exceeding max length', () => {
            const longName = 'a'.repeat(300) + '.jpg';
            const result = validateFilename(longName);
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_FILENAME');
        });
    });

    describe('validateImageDimensions', () => {
        it('should accept valid poster dimensions', () => {
            const result = validateImageDimensions(1920, 1080, MediaType.POSTER);
            expect(result.valid).toBe(true);
        });

        it('should reject dimensions below minimum for poster', () => {
            const result = validateImageDimensions(400, 300, MediaType.POSTER);
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_DIMENSIONS');
        });

        it('should reject dimensions exceeding maximum', () => {
            const result = validateImageDimensions(5000, 5000, MediaType.POSTER);
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_DIMENSIONS');
        });

        it('should reject invalid aspect ratio for poster', () => {
            const result = validateImageDimensions(1000, 2500, MediaType.POSTER);
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_DIMENSIONS');
        });

        it('should skip validation for documents', () => {
            const result = validateImageDimensions(100, 100, MediaType.DOCUMENT);
            expect(result.valid).toBe(true);
        });
    });

    describe('validateEventId', () => {
        it('should accept valid UUID v4', () => {
            const result = validateEventId('550e8400-e29b-41d4-a716-446655440000');
            expect(result.valid).toBe(true);
        });

        it('should reject invalid UUID format', () => {
            const result = validateEventId('not-a-uuid');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_EVENT_ID');
        });

        it('should reject non-v4 UUID', () => {
            const result = validateEventId('550e8400-e29b-11d4-a716-446655440000');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateExtension', () => {
        it('should accept matching extension and MIME type', () => {
            const result = validateExtension('image.jpg', 'image/jpeg');
            expect(result.valid).toBe(true);
        });

        it('should reject mismatched extension and MIME type', () => {
            const result = validateExtension('document.pdf', 'image/jpeg');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_FILENAME');
        });

        it('should reject unknown MIME type', () => {
            const result = validateExtension('file.xyz', 'application/unknown');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_MIME_TYPE');
        });
    });

    describe('validateFile', () => {
        it('should accept valid file', () => {
            const result = validateFile(
                'event-poster.jpg',
                'image/jpeg',
                2 * 1024 * 1024,
                MediaType.POSTER,
                { width: 1920, height: 1080 },
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should collect multiple errors', () => {
            const result = validateFile(
                '../../../invalid.exe',
                'application/exe',
                100 * 1024 * 1024,
                MediaType.POSTER,
                { width: 100, height: 100 },
            );
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
        });

        it('should validate without dimensions for documents', () => {
            const result = validateFile(
                'document.pdf',
                'application/pdf',
                5 * 1024 * 1024,
                MediaType.DOCUMENT,
            );
            expect(result.valid).toBe(true);
        });
    });

    describe('validateStoragePath', () => {
        it('should accept valid relative path', () => {
            const result = validateStoragePath('events/posters/event-id/file.jpg');
            expect(result.valid).toBe(true);
        });

        it('should reject path with traversal', () => {
            const result = validateStoragePath('events/../../../etc/passwd');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('PATH_TRAVERSAL');
        });

        it('should reject absolute path', () => {
            const result = validateStoragePath('/absolute/path/file.jpg');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('PATH_TRAVERSAL');
        });

        it('should reject path with null bytes', () => {
            const result = validateStoragePath('events/file\0.jpg');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('PATH_TRAVERSAL');
        });
    });

    describe('isImageMimeType', () => {
        it('should return true for image MIME types', () => {
            expect(isImageMimeType('image/jpeg')).toBe(true);
            expect(isImageMimeType('image/png')).toBe(true);
            expect(isImageMimeType('image/webp')).toBe(true);
        });

        it('should return false for non-image MIME types', () => {
            expect(isImageMimeType('application/pdf')).toBe(false);
            expect(isImageMimeType('text/plain')).toBe(false);
        });
    });

    describe('isDocumentMimeType', () => {
        it('should return true for document MIME types', () => {
            expect(isDocumentMimeType('application/pdf')).toBe(true);
            expect(isDocumentMimeType('application/msword')).toBe(true);
        });

        it('should return false for non-document MIME types', () => {
            expect(isDocumentMimeType('image/jpeg')).toBe(false);
        });
    });

    describe('getMediaTypeFromMime', () => {
        it('should return GALLERY for image MIME types', () => {
            expect(getMediaTypeFromMime('image/jpeg')).toBe(MediaType.GALLERY);
        });

        it('should return DOCUMENT for document MIME types', () => {
            expect(getMediaTypeFromMime('application/pdf')).toBe(MediaType.DOCUMENT);
        });

        it('should return null for unknown MIME types', () => {
            expect(getMediaTypeFromMime('application/unknown')).toBeNull();
        });
    });
});
