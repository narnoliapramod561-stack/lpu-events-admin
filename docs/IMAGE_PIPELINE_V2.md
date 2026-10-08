# LPU Events — Production Image Pipeline V2 Documentation

## 1. Executive Summary & Core Principle

The LPU Events Production Image Pipeline V2 adheres strictly to the core principle:

> **An organizer uploads one image once. The image is processed once at upload/replacement time. The generated assets are stored in Cloudflare R2. Cloudflare CDN caches and serves those immutable assets on subsequent requests. Opening an event must NEVER trigger image processing, resizing, cropping, enhancement, or regeneration.**

```
 Organizer Upload (Single Image)
         ↓
 SHA-256 Checksum Calculation
         ↓
 Pre-Flight Deduplication Check (re-uses existing assets if matched)
         ↓
 One-Time Client-Side V2 Processing:
   ├── Master/Source: Original file preserved byte-for-byte
   ├── Hero Placement: 1920×800 (2.4:1) + responsive variants (1200w, 800w)
   ├── Card Placement: 800×480 (5:3) + responsive variant (480w)
   └── Details Placement: 1280×720 (16:9) + responsive variants (800w, 640w)
         ↓
 Authenticated Cloudflare R2 Upload via Supabase Edge Function (`r2-upload`)
         ↓
 Cache-Control: public, max-age=31536000, immutable
         ↓
 Cloudflare Global Edge CDN Cache
         ↓
 Student & Admin Frontend (Direct static URL resolution, ZERO runtime compute)
```

---

## 2. Key Architecture Pillars

### 2.1 Master / Source Asset Preservation
* When an organizer uploads an image, the raw binary buffer is stored in R2 as the immutable canonical master:
  `events/v2/{hashPrefix}/{checksum}/source.{ext}`
* Preserves original dimensions, color space, MIME type, file size, and SHA-256 checksum.
* Master is never overwritten, never AI-upscaled, and never cropped.

### 2.2 Placement Derivatives
Fixed canvas dimensions tailored to existing UI slots without altering UI designs:
1. **Hero**: 1920 × 800 (Aspect ratio 2.4:1) — Desktop Hero Carousel
   * Responsive derivatives: `hero_1200w.webp` (1200×500), `hero_800w.webp` (800×333)
2. **Card**: 800 × 480 (Aspect ratio 5:3) — Event Grid Card
   * Responsive derivative: `card_480w.webp` (480×288)
3. **Details**: 1280 × 720 (Aspect ratio 16:9) — Event Details Canvas & Banner
   * Responsive derivatives: `details_800w.webp` (800×450), `details_640w.webp` (640×360)

---

## 3. Composition Algorithm & Zero-Crop Guarantee

### 3.1 2% Aspect-Ratio Match Tolerance
Calculated as:
$$\text{relativeDifference} = \frac{|\text{sourceRatio} - \text{targetRatio}|}{\text{targetRatio}}$$

If $\text{relativeDifference} \le 0.02$ (2%):
* Mode: `DIRECT_PROPORTIONAL`
* The image is scaled proportionally to fill the target canvas.
* Zero crop, zero distortion, zero background layer.

### 3.2 Mismatched Aspect Ratios (Adaptive Background)
If $\text{relativeDifference} > 0.02$ (e.g. portrait 4:5 or 9:16 poster in 16:9 or 2.4:1 canvas):
1. **Target Canvas**: Fixed resolution (e.g., 1920×800 or 1280×720) initialized.
2. **Ambient Fill Layer (Background)**:
   * Source artwork scaled to cover the entire canvas.
   * Rendered with Gaussian blur (sigma: 32px – 48px).
   * Overlaid with a subtle dark tint (`rgba(0, 0, 0, 0.22)`) to eliminate competition with the foreground.
3. **Complete Artwork Layer (Foreground)**:
   * 100% of the original poster placed uncropped.
   * Proportional scaling to maximum bounding dimension.
   * Centered on the canvas (`fgX = (canvasW - fgW) / 2`, `fgY = (canvasH - fgH) / 2`).
   * **Zero Crop Guarantee**: `cropped: false` is strictly enforced. No text, logos, or dates are clipped.
4. **No-Blind-Upscale Guard**:
   * If source resolution is smaller than the target placement, foreground is never artificially upscaled beyond 1.0x native pixels.

### 3.3 Zero AI & Artwork Fidelity
* No AI upscaling, AI smart crop, or generative fill.
* Automatic enhancement disabled for event posters (`contrastClip: 0.0`, `vibranceBoost: 1.0`, `sharpenAmount: 0.0`, `preserveOriginalColorProfile: true`).
* Artwork renders with exact colors and tones intended by the organizer.

---

## 4. Storage & CDN Invalidation Strategy

### 4.1 Content-Addressed Immutable Keys
Deterministic naming scheme keyed by source SHA-256 hash:
* `events/v2/{hashPrefix}/{checksum}/source.{ext}`
* `events/v2/{hashPrefix}/{checksum}/hero.webp`
* `events/v2/{hashPrefix}/{checksum}/card.webp`
* `events/v2/{hashPrefix}/{checksum}/details.webp`
* Responsive derivatives: `hero_1200w.webp`, `hero_800w.webp`, `card_480w.webp`, `details_800w.webp`, `details_640w.webp`

### 4.2 Cache-Control Headers
All generated derivatives are uploaded with:
```http
Cache-Control: public, max-age=31536000, immutable
Content-Type: image/webp
```
Cloudflare CDN caches the response edge-wide. Query strings (`?v=123`) are forbidden as cache-busting mechanisms.

### 4.3 Image Replacement & Deduplication
* **Deduplication**: If an identical image is uploaded, SHA-256 pre-flight check detects the existing asset and skips regeneration.
* **Replacement**: When an organizer changes an event's image, the new image produces a new SHA-256 hash and new object keys. The old asset is marked as `PENDING_DELETE` in the database, allowing existing views to remain safe while marking it for orphan garbage collection.

---

## 5. Database Schema & Migration

Migration `supabase/migrations/20261003000001_image_pipeline_v2.sql` adds:
* `source_checksum` column and index on `media_assets`
* `v2_placements` JSONB column storing placement dimensions, composition modes, and object keys
* Pre-flight deduplication RPC: `find_existing_media_by_checksum(p_checksum, p_pipeline_version)`

---

## 6. Migration & Backfill Tool

A production migration script is available at `scripts/migrate_v1_to_v2.ts`:
```bash
# Dry run inspection
npx tsx scripts/migrate_v1_to_v2.ts --dry-run --limit 20

# Execute full migration
npx tsx scripts/migrate_v1_to_v2.ts --concurrency 5
```
Features:
* Idempotent: Skips assets already marked with `pipeline_version: 2`.
* Zero downtime: V1 assets remain readable while V2 assets are generated and linked.
* Sharp-powered headless Node/Deno composition with identical adaptive background mathematics.

---

## 7. Verification & Test Matrix

The test suite covers:
* `packages/shared/src/images/v2-matrix.test.ts`:
  1. Exact ratio proportional scaling (2400×1000 $\to$ 1920×800)
  2. Portrait poster uncropped adaptive background (1080×1350 $\to$ 1920×800)
  3. Square poster uncropped adaptive background (1200×1200 $\to$ 800×480)
  4. Wide poster uncropped adaptive background (2400×1000 $\to$ 800×480)
  5. Small source No-Blind-Upscale (600×800 $\to$ 1280×720)
  6. Correct ratio preservation without alteration
  7. Independent responsive derivative calculations (no offset recycling)
  8. SHA-256 deduplication
  9. Safe image replacement lifecycle
  10. Immutable CDN Cache-Control headers
* `packages/shared/src/images/expansion.test.ts`: Geometric bounds verification
* `packages/shared/src/images/pipeline.test.ts`: Centralized pipeline test suite
* `packages/shared/src/images/integration.test.ts`: End-to-end integration suite
* `packages/shared/src/images/r2-lifecycle-simulation.test.ts`: Storage provider and atomic deletion claiming
