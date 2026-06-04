DROP POLICY IF EXISTS "news public read" ON public.news;
DROP POLICY IF EXISTS "news admin write" ON public.news;

CREATE POLICY "news published read"
ON public.news
FOR SELECT
TO anon, authenticated
USING (published = true);

CREATE POLICY "news admin read"
ON public.news
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "news admin write"
ON public.news
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "opp public read" ON public.opportunites;
DROP POLICY IF EXISTS "opp admin write" ON public.opportunites;

CREATE POLICY "opportunites published read"
ON public.opportunites
FOR SELECT
TO anon, authenticated
USING (published = true);

CREATE POLICY "opportunites admin read"
ON public.opportunites
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "opportunites admin write"
ON public.opportunites
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "content admin write" ON storage.objects;
DROP POLICY IF EXISTS "content admin update" ON storage.objects;
DROP POLICY IF EXISTS "content admin delete" ON storage.objects;

CREATE POLICY "content admin write"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content' AND public.is_admin(auth.uid()));

CREATE POLICY "content admin update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'content' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'content' AND public.is_admin(auth.uid()));

CREATE POLICY "content admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'content' AND public.is_admin(auth.uid()));