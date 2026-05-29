
-- Create 'content' bucket for AI-generated public images (cover/illustrations)
INSERT INTO storage.buckets (id, name, public)
VALUES ('content', 'content', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (images served via getPublicUrl)
DROP POLICY IF EXISTS "content public read" ON storage.objects;
CREATE POLICY "content public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'content');

-- Only admins (any admin role) can write
DROP POLICY IF EXISTS "content admin write" ON storage.objects;
CREATE POLICY "content admin write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'content' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "content admin update" ON storage.objects;
CREATE POLICY "content admin update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'content' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "content admin delete" ON storage.objects;
CREATE POLICY "content admin delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'content' AND public.is_admin(auth.uid()));
