-- Phase 5b: Storage bucket for punch photos (Tier 1 selfie + Tier 2 site photo)
-- Private bucket, only service_role can read/write (backend-mediated uploads)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-punch-photos',
  'hr-punch-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hr_punch_photos_svc_all_select" ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'hr-punch-photos');

CREATE POLICY "hr_punch_photos_svc_all_insert" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'hr-punch-photos');

CREATE POLICY "hr_punch_photos_svc_all_update" ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'hr-punch-photos')
  WITH CHECK (bucket_id = 'hr-punch-photos');

CREATE POLICY "hr_punch_photos_svc_all_delete" ON storage.objects
  FOR DELETE TO service_role
  USING (bucket_id = 'hr-punch-photos');

-- TODO: 5-year auto cleanup via pg_cron / Edge Function (Phase 5e)
