REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.lookup_member_email_by_phone(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lookup_member_email_by_phone(text) TO service_role;