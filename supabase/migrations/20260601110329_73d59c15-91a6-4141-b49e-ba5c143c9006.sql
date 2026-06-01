-- 1) Cotisations: restrict to authenticated role
DROP POLICY IF EXISTS "coti insert owner or admin" ON public.cotisations;
DROP POLICY IF EXISTS "coti select owner or admin" ON public.cotisations;
DROP POLICY IF EXISTS "coti update admin" ON public.cotisations;

CREATE POLICY "coti select owner or admin"
ON public.cotisations FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = cotisations.member_id AND m.user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

CREATE POLICY "coti insert owner or admin"
ON public.cotisations FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    EXISTS (SELECT 1 FROM public.members m WHERE m.id = cotisations.member_id AND m.user_id = auth.uid())
    AND statut = 'en_attente'
    AND paye_le IS NULL
    AND reference IS NULL
    AND methode IS NULL
  )
);

CREATE POLICY "coti update admin"
ON public.cotisations FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 2) member_documents: remove draft_id JWT-email branch (forgeable; drafts have no unique email).
-- Pre-registration document operations must go through server functions using the service role.
DROP POLICY IF EXISTS "member documents owner or admin read" ON public.member_documents;
DROP POLICY IF EXISTS "member documents owner delete" ON public.member_documents;
DROP POLICY IF EXISTS "member documents owner create" ON public.member_documents;

CREATE POLICY "member documents owner or admin read"
ON public.member_documents FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    member_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_documents.member_id AND m.user_id = auth.uid())
  )
);

CREATE POLICY "member documents owner create"
ON public.member_documents FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    member_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_documents.member_id AND m.user_id = auth.uid())
  )
);

CREATE POLICY "member documents owner delete"
ON public.member_documents FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    member_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_documents.member_id AND m.user_id = auth.uid())
  )
);
