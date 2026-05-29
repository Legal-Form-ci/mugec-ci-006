
-- 1) user_roles: defensive RESTRICTIVE policies — only super_admin can write
CREATE POLICY "roles restrict insert to super admin"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "roles restrict update to super admin"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "roles restrict delete to super admin"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 2) member_documents: require verified email claim on draft-linked access
DROP POLICY IF EXISTS "member documents owner or admin read" ON public.member_documents;
CREATE POLICY "member documents owner or admin read"
  ON public.member_documents FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (member_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_documents.member_id AND m.user_id = auth.uid()
    ))
    OR (draft_id IS NOT NULL
        AND COALESCE((auth.jwt() ->> 'email_verified')::boolean, false) = true
        AND EXISTS (
          SELECT 1 FROM public.registration_drafts d
          WHERE d.id = member_documents.draft_id
            AND lower(d.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        ))
  );

DROP POLICY IF EXISTS "member documents owner delete" ON public.member_documents;
CREATE POLICY "member documents owner delete"
  ON public.member_documents FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (member_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_documents.member_id AND m.user_id = auth.uid()
    ))
    OR (draft_id IS NOT NULL
        AND COALESCE((auth.jwt() ->> 'email_verified')::boolean, false) = true
        AND EXISTS (
          SELECT 1 FROM public.registration_drafts d
          WHERE d.id = member_documents.draft_id
            AND lower(d.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        ))
  );
