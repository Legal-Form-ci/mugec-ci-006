
REVOKE EXECUTE ON FUNCTION public.tg_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_matricule() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_prestation_amount() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_children_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.role_for_prestation_step(integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.calculate_prestation_amount(text, timestamptz) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.open_member_rights_after_90_days() FROM anon, authenticated, public;
-- Keep validate_prestation_step callable by authenticated admins via RPC
REVOKE EXECUTE ON FUNCTION public.validate_prestation_step(uuid, text, text) FROM anon, public;
-- has_role/is_admin/is_super_admin are used inside RLS policies — those run as definer; clients don't need direct EXECUTE
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated, public;
