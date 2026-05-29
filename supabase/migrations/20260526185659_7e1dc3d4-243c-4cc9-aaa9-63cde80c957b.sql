
-- 1) member_documents : autoriser le propriétaire du brouillon à lire/supprimer ses docs avant création du membre
DROP POLICY IF EXISTS "member documents owner or admin read" ON public.member_documents;
CREATE POLICY "member documents owner or admin read"
ON public.member_documents
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR (
    member_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_documents.member_id AND m.user_id = auth.uid()
    )
  )
  OR (
    draft_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.registration_drafts d
      WHERE d.id = member_documents.draft_id
        AND lower(d.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    )
  )
);

DROP POLICY IF EXISTS "member documents owner delete" ON public.member_documents;
CREATE POLICY "member documents owner delete"
ON public.member_documents
FOR DELETE
TO authenticated
USING (
  is_admin(auth.uid())
  OR (
    member_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_documents.member_id AND m.user_id = auth.uid()
    )
  )
  OR (
    draft_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.registration_drafts d
      WHERE d.id = member_documents.draft_id
        AND lower(d.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    )
  )
);

-- 2) registration_drafts : renommer la policy deny pour clarifier qu'elle bloque aussi les lectures
ALTER POLICY "drafts deny client writes" ON public.registration_drafts RENAME TO "drafts client no access";
