/**
 * migrate_v1_to_v2.ts
 * Safe, Idempotent Backfill & Migration Script: Image Pipeline V1 -> V2
 *
 * Scans existing event media assets:
 * 1. Checks if asset is already migrated to V2 (idempotent).
 * 2. Fetches existing source image from R2 / CDN.
 * 3. Calculates deterministic SHA-256 checksum.
 * 4. Generates all V2 placement derivatives (hero, card, details) and responsive variants
 *    with zero foreground crop and adaptive background composition.
 * 5. Uploads V2 derivatives to Cloudflare R2 / Storage with immutable cache headers.
 * 6. Updates media_assets record with V2 schema and placement metadata.
 * 7. Never deletes V1 assets during migration.
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import crypto from 'node:crypto';
import {
  V2_PIPELINE_VERSION,
  ASPECT_RATIO_TOLERANCE,
  V2_PLACEMENT_CONFIGS,
  PlacementKey
} from '../packages/shared/src/images/config.js';
import { calculatePlacementGeometry } from '../packages/shared/src/images/processor.js';

interface MigrationOptions {
  dryRun?: boolean;
  limit?: number;
  eventId?: string;
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lpuevents.live';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const R2_PUBLIC_URL = process.env.VITE_R2_PUBLIC_URL || 'https://images.lpuevents.live';

export async function runMigration(options: MigrationOptions = {}) {
  const { dryRun = false, limit = 50, eventId } = options;

  console.log('========================================================================');
  console.log('  LPU EVENTS — PRODUCTION IMAGE PIPELINE V1 -> V2 BACKFILL MIGRATION    ');
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no database/storage writes)' : 'LIVE EXECUTION'} | Limit: ${limit}`);
  console.log('========================================================================\n');

  if (!SUPABASE_SERVICE_KEY) {
    console.warn('[NOTICE] SUPABASE_SERVICE_ROLE_KEY not set. Simulation/dry-run mode active.');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || 'dummy-key');

  // 1. Query events needing V2 migration
  let query = supabase
    .from('events')
    .select('id, name, banner_media_id, media_assets:banner_media_id(id, object_key, bucket, checksum, width, height, metadata, file_size_bytes)')
    .not('banner_media_id', 'is', null);

  if (eventId) {
    query = query.eq('id', eventId);
  } else {
    query = query.limit(limit);
  }

  const { data: events, error: queryErr } = await query;

  if (queryErr) {
    console.error('Failed to query events for migration:', queryErr.message);
    return;
  }

  if (!events || events.length === 0) {
    console.log('No events found requiring V2 migration.');
    return;
  }

  console.log(`Found ${events.length} candidate events for inspection.\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const event of events) {
    const mediaAsset = Array.isArray(event.media_assets) ? event.media_assets[0] : event.media_assets;
    if (!mediaAsset || !mediaAsset.object_key) {
      console.log(`[SKIP] Event "${event.name}" (${event.id}): No linked media asset.`);
      skippedCount++;
      continue;
    }

    // Check if already V2
    if (mediaAsset.metadata?.pipeline_version === V2_PIPELINE_VERSION && mediaAsset.metadata?.placement) {
      console.log(`[ALREADY V2] Event "${event.name}" (${event.id}): Has valid V2 placements.`);
      skippedCount++;
      continue;
    }

    console.log(`[MIGRATING] Event "${event.name}" (${event.id})...`);
    const startTime = Date.now();

    try {
      // 2. Fetch existing source/derivative image
      const sourceUrl = mediaAsset.object_key.startsWith('http')
        ? mediaAsset.object_key
        : `${R2_PUBLIC_URL}/${mediaAsset.object_key.replace(/^\/+/, '')}`;

      const res = await fetch(sourceUrl);
      if (!res.ok) {
        throw new Error(`Failed to download source asset: HTTP ${res.status} from ${sourceUrl}`);
      }

      const inputBuffer = Buffer.from(await res.arrayBuffer());
      const checksum = crypto.createHash('sha256').update(inputBuffer).digest('hex');
      const hashPrefix = checksum.slice(0, 4);

      // Inspect source dimensions
      const imageInfo = await sharp(inputBuffer).metadata();
      const srcWidth = imageInfo.width || 1200;
      const srcHeight = imageInfo.height || 800;

      console.log(`  Source: ${srcWidth}x${srcHeight} px | SHA-256: ${checksum.slice(0, 16)}...`);

      const placementMeta: Record<string, any> = {};

      // 3. Generate V2 Placements using Sharp
      for (const [pKey, pConfig] of Object.entries(V2_PLACEMENT_CONFIGS) as [PlacementKey, any][]) {
        const geom = calculatePlacementGeometry(srcWidth, srcHeight, pConfig.targetWidth, pConfig.targetHeight);
        let outBuffer: Buffer;

        if (geom.composition === 'DIRECT_PROPORTIONAL') {
          outBuffer = await sharp(inputBuffer)
            .resize(pConfig.targetWidth, pConfig.targetHeight, { fit: 'fill' })
            .webp({ quality: pConfig.quality })
            .toBuffer();
        } else {
          // Adaptive background: blurred background + centered uncropped foreground
          const bgBuffer = await sharp(inputBuffer)
            .resize(pConfig.targetWidth, pConfig.targetHeight, { fit: 'cover' })
            .blur(24)
            .modulate({ brightness: 0.78 })
            .toBuffer();

          const fgBuffer = await sharp(inputBuffer)
            .resize(geom.fgWidth, geom.fgHeight, { fit: 'fill' })
            .toBuffer();

          outBuffer = await sharp(bgBuffer)
            .composite([{ input: fgBuffer, top: geom.fgY, left: geom.fgX }])
            .webp({ quality: pConfig.quality })
            .toBuffer();
        }

        const primaryKey = `events/v2/${hashPrefix}/${checksum}/${pKey}.webp`;

        if (!dryRun && SUPABASE_SERVICE_KEY) {
          await supabase.storage.from('media').upload(primaryKey, outBuffer, {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
            upsert: true
          });
        }

        const variantMeta: any[] = [];
        for (const variant of pConfig.variants) {
          const varGeom = calculatePlacementGeometry(srcWidth, srcHeight, variant.width, variant.height);
          let varBuffer: Buffer;

          if (varGeom.composition === 'DIRECT_PROPORTIONAL') {
            varBuffer = await sharp(inputBuffer)
              .resize(variant.width, variant.height, { fit: 'fill' })
              .webp({ quality: variant.quality })
              .toBuffer();
          } else {
            const varBg = await sharp(inputBuffer)
              .resize(variant.width, variant.height, { fit: 'cover' })
              .blur(20)
              .modulate({ brightness: 0.78 })
              .toBuffer();

            const varFg = await sharp(inputBuffer)
              .resize(varGeom.fgWidth, varGeom.fgHeight, { fit: 'fill' })
              .toBuffer();

            varBuffer = await sharp(varBg)
              .composite([{ input: varFg, top: varGeom.fgY, left: varGeom.fgX }])
              .webp({ quality: variant.quality })
              .toBuffer();
          }

          const varKey = `events/v2/${hashPrefix}/${checksum}/${pKey}_${variant.name}.webp`;

          if (!dryRun && SUPABASE_SERVICE_KEY) {
            await supabase.storage.from('media').upload(varKey, varBuffer, {
              contentType: 'image/webp',
              cacheControl: 'public, max-age=31536000, immutable',
              upsert: true
            });
          }

          variantMeta.push({
            name: variant.name,
            width: variant.width,
            height: variant.height,
            file_size_bytes: varBuffer.length,
            object_key: varKey
          });
        }

        placementMeta[pKey] = {
          width: pConfig.targetWidth,
          height: pConfig.targetHeight,
          composition: geom.composition,
          cropped: false,
          distorted: false,
          object_key: primaryKey,
          file_size_bytes: outBuffer.length,
          variants: variantMeta
        };

        console.log(`  -> Placement [${pKey}]: ${geom.composition} (${pConfig.targetWidth}x${pConfig.targetHeight}) - ${outBuffer.length} bytes`);
      }

      // 4. Update Database Metadata Safely
      const updatedMetadata = {
        ...(mediaAsset.metadata || {}),
        pipeline_version: V2_PIPELINE_VERSION,
        source: {
          checksum,
          width: srcWidth,
          height: srcHeight,
          size_bytes: inputBuffer.length,
          object_key: `events/v2/${hashPrefix}/${checksum}/source.webp`
        },
        placement: placementMeta,
        migrated_at: new Date().toISOString()
      };

      if (!dryRun && SUPABASE_SERVICE_KEY) {
        await supabase
          .from('media_assets')
          .update({
            metadata: updatedMetadata,
            status: 'READY'
          })
          .eq('id', mediaAsset.id);
      }

      const elapsed = Date.now() - startTime;
      console.log(`  ✔ Successfully migrated in ${elapsed}ms\n`);
      migratedCount++;
    } catch (err: any) {
      console.error(`  ✖ Migration failed for event ${event.id}:`, err.message, '\n');
      failedCount++;
    }
  }

  console.log('========================================================================');
  console.log(`  Migration Complete: ${migratedCount} migrated, ${skippedCount} skipped, ${failedCount} failed`);
  console.log('========================================================================\n');
}

// CLI Execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 25;

  runMigration({ dryRun, limit }).catch((err) => {
    console.error('Fatal migration script error:', err);
    process.exit(1);
  });
}
