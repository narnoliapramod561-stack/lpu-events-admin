/**
 * uploader.ts
 * Unified Image Upload & Persistence Orchestrator
 *
 * Implements the complete production lifecycle:
 * Upload File → Validate Magic Bytes → Process & Enhance → Resize & Compress →
 * Store in Cloudflare R2 / Backend Storage → Register media_assets in PostgreSQL →
 * Lifecycle Reference Tracking & Safe Orphan Deletion
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ImageContext, IMAGE_PIPELINE_VERSION } from './config';
import { validateImageFile } from './validator';
import { processImageForContext, ImageProcessingResult } from './processor';
import { getStorageBaseUrl } from './url';

export interface UploadedMediaResult {
  mediaId: string;
  objectKey: string;
  publicUrl: string;
  dataUrl: string;
  context: ImageContext;
  pipelineVersion: number;
  mimeType: string;
  fileSizeBytes: number;
  originalSizeBytes: number;
  width: number;
  height: number;
  checksum: string;
  savingsPercentage: number;
  compressionRatio: number;
  variants: {
    name: string;
    objectKey: string;
    width: number;
    height: number;
    fileSizeBytes: number;
  }[];
}

export interface ImageUploadOptions {
  supabase: SupabaseClient;
  file: File | Blob;
  context: ImageContext;
  adminUserId?: string;
  entityId?: string;
  bucketName?: string;
  onProgress?: (step: 'validating' | 'enhancing' | 'compressing' | 'uploading' | 'completed') => void;
}

export interface ReplaceEntityMediaOptions {
  supabase: SupabaseClient;
  entityTable: 'events' | 'advertisements' | 'event_memories' | 'sponsors' | 'carousel_items';
  entityId: string;
  mediaColumn: 'banner_media_id' | 'media_id' | 'cover_media_id' | 'logo_media_id';
  newMediaId: string | null;
}

/**
 * Maps image context to MediaType enum
 */
export function contextToMediaType(context: ImageContext): string {
  switch (context) {
    case 'hero':
      return 'CAROUSEL_IMAGE';
    case 'event-banner':
    case 'event-card':
      return 'EVENT_BANNER';
    case 'advertisement':
      return 'ADVERTISEMENT';
    case 'sponsor-logo':
      return 'SPONSOR_LOGO';
    case 'memory':
      return 'MEMORY_IMAGE';
    case 'thumbnail':
    case 'admin-preview':
    default:
      return 'EVENT_BANNER';
  }
}

/**
 * Uploads, optimizes, enhances, and registers any image file with R2 storage and database metadata.
 */
export async function uploadAndOptimizeImage(
  options: ImageUploadOptions
): Promise<UploadedMediaResult> {
  const { supabase, file, context, entityId, onProgress } = options;

  // 1. Validate magic bytes, bounds, and limits
  if (onProgress) onProgress('validating');
  const validation = await validateImageFile(file, context);
  if (!validation.valid) {
    throw new Error(validation.error || 'Image file validation failed.');
  }

  // 2. Process & Enhance & Compress into WebP Derivatives
  if (onProgress) onProgress('enhancing');
  const processed: ImageProcessingResult = await processImageForContext(file, context);

  // 3. Authenticated Edge Function Upload to Cloudflare R2
  if (onProgress) onProgress('uploading');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Administrative session required to upload image. Please log in again.');
  }

  const formData = new FormData();

  // Attach primary (desktop) WebP file
  formData.append('file', processed.primaryBlob, `${processed.checksum}_desktop.webp`);
  formData.append('file_desktop', processed.primaryBlob, `${processed.checksum}_desktop.webp`);

  // Attach responsive variants (tablet & mobile) if present
  for (const variant of processed.variants) {
    if (variant.name === 'tablet') {
      formData.append('file_tablet', variant.blob, `${processed.checksum}_tablet.webp`);
    } else if (variant.name === 'mobile') {
      formData.append('file_mobile', variant.blob, `${processed.checksum}_mobile.webp`);
    }
  }

  formData.append('context', context);
  formData.append('checksum', processed.checksum);
  if (entityId) formData.append('entity_id', entityId);
  formData.append(
    'metadata',
    JSON.stringify({
      original_size_bytes: processed.originalSizeBytes,
      optimized_size_bytes: processed.primarySizeBytes,
      savings_percentage: processed.savingsPercentage,
      compression_ratio: processed.compressionRatio,
      variants: processed.variants.map((v) => ({
        name: v.name,
        object_key: v.objectKey,
        width: v.width,
        height: v.height,
        file_size_bytes: v.fileSizeBytes
      }))
    })
  );

  let edgeData: any = null;

  try {
    const { data: invokeData, error: invokeErr } = await supabase.functions.invoke('r2-upload', {
      body: formData,
    });

    if (invokeErr) {
      throw invokeErr;
    }
    edgeData = invokeData;
  } catch (invokeError: any) {
    // Direct fetch fallback with explicit headers
    const supabaseUrl = (supabase as any).supabaseUrl || (supabase as any).rest?.url?.replace(/\/rest\/v1\/?$/, '');
    if (supabaseUrl) {
      const edgeUrl = `${supabaseUrl}/functions/v1/r2-upload`;
      const edgeRes = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: (supabase as any).supabaseKey || (supabase as any).anonKey || 'sb_publishable_S9KH9_RTpx1MiPwyEBWxRQ_QkJVgzsA'
        },
        body: formData
      });

      if (edgeRes.ok) {
        edgeData = await edgeRes.json();
      } else {
        let errorMsg = `Upload failed (HTTP ${edgeRes.status})`;
        try {
          const errJson = await edgeRes.json();
          if (errJson?.message) errorMsg = errJson.message;
          else if (errJson?.error) errorMsg = errJson.error;
        } catch {}
        throw new Error(errorMsg);
      }
    } else {
      throw new Error(invokeError?.message || 'Edge Function invocation failed.');
    }
  }

  if (!edgeData?.media_id) {
    throw new Error('Upload succeeded but the server did not return a verified media record ID.');
  }

  if (onProgress) onProgress('completed');

  const resolvedVariants = edgeData.variants && Array.isArray(edgeData.variants) && edgeData.variants.length > 0
    ? edgeData.variants.map((v: any) => ({
        name: v.name,
        objectKey: v.object_key,
        width: v.width,
        height: v.height,
        fileSizeBytes: v.file_size_bytes || 0
      }))
    : processed.variants.map((v) => ({
        name: v.name,
        objectKey: v.objectKey,
        width: v.width,
        height: v.height,
        fileSizeBytes: v.fileSizeBytes
      }));

  return {
    mediaId: edgeData.media_id,
    objectKey: edgeData.object_key || processed.primaryObjectKey,
    publicUrl: edgeData.public_url || `${getStorageBaseUrl()}/${processed.primaryObjectKey}`,
    dataUrl: processed.primaryDataUrl,
    context,
    pipelineVersion: IMAGE_PIPELINE_VERSION,
    mimeType: processed.mimeType,
    fileSizeBytes: processed.primarySizeBytes,
    originalSizeBytes: processed.originalSizeBytes,
    width: processed.primaryWidth,
    height: processed.primaryHeight,
    checksum: processed.checksum,
    savingsPercentage: processed.savingsPercentage,
    compressionRatio: processed.compressionRatio,
    variants: resolvedVariants
  };
}

/**
 * Replaces an entity's associated media asset, marking old unreferenced assets as PENDING_DELETE.
 */
export async function replaceEntityMediaAsset(
  options: ReplaceEntityMediaOptions
): Promise<{ success: boolean; oldMediaId?: string | null }> {
  const { supabase, entityTable, entityId, mediaColumn, newMediaId } = options;

  try {
    // 1. Try atomic RPC replace_entity_media if available
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('replace_entity_media', {
        p_entity_table: entityTable,
        p_entity_id: entityId,
        p_media_column: mediaColumn,
        p_new_media_id: newMediaId
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        return { success: true, oldMediaId: rpcRes.old_media_id };
      }
    } catch {
      // Fallback to client orchestration
    }

    // 2. Direct transactional update fallback
    const { data: currentEntity, error: fetchErr } = await supabase
      .from(entityTable)
      .select(mediaColumn)
      .eq('id', entityId)
      .maybeSingle();

    if (fetchErr || !currentEntity) {
      return { success: false };
    }

    const oldMediaId = (currentEntity as any)[mediaColumn];

    const { error: updateErr } = await supabase
      .from(entityTable)
      .update({
        [mediaColumn]: newMediaId,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId);

    if (updateErr) throw updateErr;

    // If old media ID exists and is different, mark it PENDING_DELETE
    if (oldMediaId && oldMediaId !== newMediaId) {
      await supabase
        .from('media_assets')
        .update({
          status: 'PENDING_DELETE',
          deleted_at: new Date().toISOString()
        })
        .eq('id', oldMediaId);
    }

    return { success: true, oldMediaId };
  } catch (err) {
    console.error('replaceEntityMediaAsset error:', err);
    return { success: false };
  }
}
