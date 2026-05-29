
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_matricule() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_prestation_amount() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_children_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;
-- Keep login lookup helpers callable pre-auth (required by /login flow)
-- public.lookup_member_email_by_phone and public.resolve_login_email remain executable.
