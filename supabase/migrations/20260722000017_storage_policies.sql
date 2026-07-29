-- =============================================================================
-- TASK-XXX: Storage RLS Policies for event-media bucket
-- Migration: 20260722000017_storage_policies.sql
-- Depends on: 20260722000001_canonical_schema.sql
-- =============================================================================

-- Ensure the event-media bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-media',
  'event-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read: anyone can view event media (required for student website)
CREATE POLICY "event_media_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-media');

-- Authenticated upload: authenticated users can upload to event-media
CREATE POLICY "event_media_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-media'
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp'))
    AND (length(storage.extension(name)) > 0)
  );

-- Authenticated update: users can update objects in event-media
CREATE POLICY "event_media_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-media')
  WITH CHECK (bucket_id = 'event-media');

-- Authenticated delete: users can delete objects in event-media
CREATE POLICY "event_media_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-media');

-- =============================================================================
-- End of Storage RLS Policies
-- =============================================================================
