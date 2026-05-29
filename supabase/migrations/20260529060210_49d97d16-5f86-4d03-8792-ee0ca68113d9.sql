
-- 1. Add DELETE policy on cotisations for super_admin
CREATE POLICY "coti delete super admin"
ON public.cotisations
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 2. Tighten registration_drafts: drop national admin broad read, keep super_admin only
DROP POLICY IF EXISTS "drafts top admin read" ON public.registration_drafts;
CREATE POLICY "drafts super admin read"
ON public.registration_drafts
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 3. Lock down SECURITY DEFINER functions: revoke from PUBLIC, grant only where needed.

-- Functions used by RLS predicates → must remain callable by authenticated
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_manage_payments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_payments(uuid) TO authenticated;

-- Login helpers → need anon (pre-auth lookup)
REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.lookup_member_email_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_member_email_by_phone(text) TO anon, authenticated;

-- Authenticated-only RPCs
REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.miprojet_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.miprojet_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.dashboard_sync_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_sync_health() TO authenticated;

REVOKE ALL ON FUNCTION public.member_public_info(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_public_info(text) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_prestation_step(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_prestation_step(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.dashboard_path_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_path_for(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_dashboard_path() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_dashboard_path() TO authenticated;

-- Internal-only definer functions (called from triggers/cron) → no API access
REVOKE ALL ON FUNCTION public.open_member_rights_after_90_days() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_paid_payment_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_subscription_financials() FROM PUBLIC, anon, authenticated;
