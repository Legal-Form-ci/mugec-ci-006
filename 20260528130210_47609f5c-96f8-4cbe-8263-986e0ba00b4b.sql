
-- 1. DELETE policies on member_documents
CREATE POLICY "member documents owner delete"
ON public.member_documents FOR DELETE TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = member_documents.member_id AND m.user_id = auth.uid()
  )
);

-- 2. Restrict avatars bucket listing (public CDN URLs still work for public buckets)
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;

CREATE POLICY "avatars owner or admin list"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND (
    is_admin(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);

-- 3. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
-- Keep public access for functions that must run pre-auth (login lookup) or are
-- intentionally called from the client (validate_prestation_step uses internal role checks).
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.miprojet_dashboard_stats() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.open_member_rights_after_90_days() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_payments(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.role_for_prestation_step(integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.calculate_prestation_amount(text, timestamptz) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.current_user_dashboard_path() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.current_user_dashboard_path() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_prestation_step(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.validate_prestation_step(uuid, text, text) TO authenticated;
-- resolve_login_email / lookup_member_email_by_phone must remain callable pre-auth (login)
