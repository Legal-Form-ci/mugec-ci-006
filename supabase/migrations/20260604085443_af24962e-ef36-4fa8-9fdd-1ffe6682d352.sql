DROP POLICY IF EXISTS "audit super admin read" ON public.audit_log;
CREATE POLICY "audit super admin read"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "docs admin write" ON public.documents;
DROP POLICY IF EXISTS "docs owner or admin read" ON public.documents;

CREATE POLICY "docs admin write"
ON public.documents
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "docs owner or admin read"
ON public.documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = documents.member_id AND m.user_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "msg owner or admin delete" ON public.forum_messages;
CREATE POLICY "msg owner or admin delete"
ON public.forum_messages
FOR DELETE
TO authenticated
USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "topics admin delete" ON public.forum_topics;
DROP POLICY IF EXISTS "topics owner or admin update" ON public.forum_topics;

CREATE POLICY "topics admin delete"
ON public.forum_topics
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "topics owner or admin update"
ON public.forum_topics
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "avatars owner or admin list" ON storage.objects;
CREATE POLICY "avatars owner or admin list"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (public.is_admin(auth.uid()) OR auth.uid()::text = (storage.foldername(name))[1])
);