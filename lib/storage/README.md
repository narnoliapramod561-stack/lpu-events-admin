# Storage Infrastructure Module

Canonical storage layer for LPU Events media infrastructure using Cloudflare R2.

## Overview

This module provides a complete, production-ready storage infrastructure for managing event media assets including posters, gallery images, and supporting documents. It is designed to be reusable across all LPU Events applications (Student Website, Organizer Portal, Super Admin Portal, and future Flutter apps).

## Architecture

The storage infrastructure is built around **Cloudflare R2** as the canonical object storage solution, providing:

- **Global CDN** - Fast media delivery worldwide
- **S3-Compatible API** - Industry-standard integration
- **Cost-Effective** - No egress fees
- **Scalable** - Handles growth seamlessly

## Module Structure

```
lib/storage/
├── constants.ts      # Media types, MIME types, size limits, paths
├── types.ts          # TypeScript interfaces and types
├── config.ts         # Environment configuration and validation
├── validators.ts     # File validation and security checks
├── utils.ts          # Path generation and naming utilities
├── metadata.ts       # File metadata management
├── index.ts          # Public API exports
└── README.md         # This file
```

## Core Components

### 1. Constants (`constants.ts`)

Defines canonical values for the storage infrastructure:

- **MediaType** - Poster, Gallery, Document
- **ALLOWED_MIME_TYPES** - Whitelisted file types
- **MAX_FILE_SIZES** - Size limits per media type
- **MEDIA_PATHS** - Directory structure in bucket
- **IMAGE_CONSTRAINTS** - Dimension requirements
- **ACCESS_CONTROL** - CORS and bucket policies

### 2. Types (`types.ts`)

TypeScript interfaces for type-safe storage operations:

- `StorageConfig` - R2 configuration
- `BucketConfig` - Bucket settings
- `FileMetadata` - Complete file information
- `ValidationResult` - Validation outcomes
- `StorageKeyOptions` - Key generation parameters

### 3. Configuration (`config.ts`)

Environment-based configuration with fail-fast validation:

```typescript
import { getStorageConfig, validateStorageEnv } from '@/lib/storage';

// Validates required environment variables
const config = getStorageConfig();

// Check configuration status
const status = getConfigurationStatus();
```

**Required Environment Variables:**
- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `R2_EVENT_IMAGES_BUCKET` (optional, defaults to 'lpu-events-images')
- `R2_PUBLIC_URL_PREFIX` (optional)

### 4. Validators (`validators.ts`)

Comprehensive validation for security and data integrity:

```typescript
import { validateFile, validateMimeType } from '@/lib/storage';

const result = validateFile(
    filename,
    mimeType,
    fileSize,
    MediaType.POSTER,
    { width: 1920, height: 1080 }
);

if (!result.valid) {
    console.error('Validation failed:', result.errors);
}
```

**Validation Features:**
- MIME type whitelisting
- File size enforcement
- Filename sanitization
- Path traversal protection
- Image dimension validation
- Extension verification

### 5. Utilities (`utils.ts`)

Path generation, naming, and helper functions:

```typescript
import { generateStorageKey, sanitizeFilename } from '@/lib/storage';

// Generate secure storage key
const key = generateStorageKey({
    eventId: 'uuid-here',
    mediaType: MediaType.POSTER,
    filename: 'event-poster.jpg',
    userId: 'user-id',
});
// Result: events/posters/uuid-here/1234567890-a1b2c3d4.jpg

// Sanitize unsafe filename
const safe = sanitizeFilename('../../../etc/passwd');
// Result: 'etc-passwd'
```

### 6. Metadata (`metadata.ts`)

File metadata creation and management:

```typescript
import { createFileMetadata } from '@/lib/storage';

const metadata = createFileMetadata({
    originalName: 'my-poster.jpg',
    mimeType: 'image/jpeg',
    size: 1024 * 500, // 500 KB
    eventId: 'event-uuid',
    mediaType: MediaType.POSTER,
    userId: 'user-id',
    bucketName: 'lpu-events-images',
    dimensions: { width: 1920, height: 1080 },
});
```

## Media Structure

The canonical directory layout in the R2 bucket:

```
lpu-events-images/
├── events/
│   ├── posters/
│   │   └── {event-id}/
│   │       └── {timestamp}-{hash}.{ext}
│   ├── gallery/
│   │   └── {event-id}/
│   │       └── {timestamp}-{hash}.{ext}
│   └── documents/
│       └── {event-id}/
│           └── {timestamp}-{hash}.{ext}
└── temp/  (auto-cleanup after 24h)
```

## Security Features

### 1. MIME Type Whitelisting

Only allowed file types can be uploaded:

**Images:**
- `image/jpeg`
- `image/png`
- `image/webp`

**Documents:**
- `application/pdf`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### 2. Path Traversal Protection

All filenames and paths are sanitized to prevent:
- Directory traversal (`../`, `..\\`)
- Absolute paths
- Null bytes
- Special characters

### 3. File Size Limits

Enforced maximum sizes per media type:
- **Posters**: 5 MB
- **Gallery Images**: 10 MB
- **Documents**: 50 MB

### 4. Image Validation

Posters and gallery images must meet dimension requirements:
- **Minimum**: 800x600 pixels
- **Maximum**: 4000x4000 pixels
- **Aspect Ratio**: Between 0.5 and 2.0

### 5. Secure Naming

Generated filenames include:
- Timestamp (prevents collisions)
- Random hash (unpredictability)
- Sanitized extension

## Usage Examples

### Basic File Validation

```typescript
import { validateFile, MediaType } from '@/lib/storage';

const validation = validateFile(
    'event-poster.jpg',
    'image/jpeg',
    3 * 1024 * 1024, // 3MB
    MediaType.POSTER,
    { width: 1920, height: 1080 }
);

if (validation.valid) {
    // Proceed with upload
} else {
    validation.errors.forEach(error => {
        console.error(`${error.code}: ${error.message}`);
    });
}
```

### Generate Storage Key

```typescript
import { generateStorageKey, MediaType } from '@/lib/storage';

const storageKey = generateStorageKey({
    eventId: 'abc-123-def',
    mediaType: MediaType.GALLERY,
    filename: 'photo.jpg',
    userId: 'user-xyz',
});

console.log(storageKey);
// events/gallery/abc-123-def/1640000000000-a1b2c3d4.jpg
```

### Create File Metadata

```typescript
import { createFileMetadata, MediaType } from '@/lib/storage';

const metadata = createFileMetadata({
    originalName: 'event-poster.jpg',
    mimeType: 'image/jpeg',
    size: 2048576, // 2MB
    eventId: 'event-uuid',
    mediaType: MediaType.POSTER,
    userId: 'user-id',
    bucketName: 'lpu-events-images',
    dimensions: { width: 1920, height: 1080 },
});

// Use metadata.storageKey for R2 upload
// Save metadata to database
```

### Configuration Status Check

```typescript
import { getConfigurationStatus, isStorageConfigured } from '@/lib/storage';

if (!isStorageConfigured()) {
    const status = getConfigurationStatus();
    console.error('Missing env vars:', status.missing);
    throw new Error('Storage not configured');
}
```

## Configuration

### Development Environment

Create `.env.local`:

```bash
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_EVENT_IMAGES_BUCKET=lpu-events-images-dev
R2_PUBLIC_URL_PREFIX=https://dev-cdn.lpuevents.com
```

### Production Environment

Set environment variables in your deployment platform:

```bash
CLOUDFLARE_R2_ACCOUNT_ID=prod-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=prod-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=prod-secret
R2_EVENT_IMAGES_BUCKET=lpu-events-images
R2_PUBLIC_URL_PREFIX=https://cdn.lpuevents.com
```

## Testing

Comprehensive test suite in `__tests__/storage/`:

```bash
npm test -- __tests__/storage
```

Tests cover:
- MIME type validation
- File size enforcement
- Filename sanitization
- Path traversal protection
- Image dimension validation
- Storage key generation
- Metadata creation
- Configuration validation

## Error Handling

All validation functions return structured errors:

```typescript
type ValidationError = {
    code: string;
    message: string;
    field?: string;
};
```

**Error Codes:**
- `INVALID_MIME_TYPE` - File type not allowed
- `FILE_TOO_LARGE` - Exceeds size limit
- `INVALID_FILENAME` - Unsafe or malformed filename
- `PATH_TRAVERSAL` - Path security violation
- `INVALID_DIMENSIONS` - Image size requirements not met
- `INVALID_EVENT_ID` - Malformed UUID
- `MISSING_REQUIRED` - Required field missing

## Integration Guide

### Step 1: Environment Setup

1. Create Cloudflare R2 bucket
2. Generate API credentials
3. Configure environment variables
4. Validate configuration at startup

### Step 2: Upload Flow

1. Receive file from client
2. Extract file metadata
3. Validate file (MIME, size, dimensions)
4. Generate storage key
5. Upload to R2
6. Create metadata record
7. Save metadata to database

### Step 3: Retrieval Flow

1. Query metadata from database
2. Generate public URL
3. Return URL to client
4. Client fetches from CDN

## Best Practices

1. **Always validate files** before uploading
2. **Use generated storage keys** - never use user-provided paths
3. **Store metadata** in database for queries
4. **Enable CDN caching** for public URLs
5. **Implement retry logic** for upload failures
6. **Monitor storage metrics** (size, costs, errors)
7. **Regular security audits** of allowed MIME types

## Limitations

- Maximum file size: 50 MB (documents)
- Supported image formats: JPEG, PNG, WebP
- Supported document formats: PDF, Word
- UUID v4 required for event IDs

## Future Enhancements

Planned for later phases:
- Signed upload URLs
- Direct browser-to-R2 uploads
- Image transformation pipeline
- Video support
- Batch operations
- Archive/backup functionality

## Support

For issues or questions:
- Review test suite for usage examples
- Check environment configuration
- Verify Cloudflare R2 credentials
- Consult Phase 4 Task Roadmap

## Version

**Phase 4 - Task P4-T03**  
Storage Infrastructure - Initial Implementation

---

**Note:** This module is part of the LPU Events Phase 4 implementation. It provides the foundation for all media management features across the platform.
