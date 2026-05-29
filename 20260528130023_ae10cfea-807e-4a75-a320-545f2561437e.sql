-- Server-side resolution of login identifier → email
-- Avoids exposing admin usernames and synthetic email domains in the client bundle.
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v text;
  digits text;
  v_email text;
BEGIN
  v := trim(coalesce(p_identifier, ''));
  IF length(v) = 0 THEN RETURN NULL; END IF;

  -- Already an email
  IF position('@' in v) > 0 THEN
    RETURN v;
  END IF;

  -- Phone-based lookup via existing helper
  digits := regexp_replace(v, '[\s.\-()]', '', 'g');
  IF digits ~ '^[0-9]+$' AND length(digits) >= 6 THEN
    BEGIN
      SELECT public.lookup_member_email_by_phone(digits) INTO v_email;
      IF v_email IS NOT NULL AND length(v_email) > 0 THEN
        RETURN v_email;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_email := NULL;
    END;
  END IF;

  -- Identifier-based lookup (admins): match email starting with "<identifier>@"
  SELECT u.email INTO v_email
  FROM auth.users u
  WHERE lower(u.email) LIKE lower(v) || '@%'
  ORDER BY u.created_at ASC
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- Explicit DELETE policy on subscriptions for super_admin only
DROP POLICY IF EXISTS "subscriptions super admin delete" ON public.subscriptions;
CREATE POLICY "subscriptions super admin delete"
ON public.subscriptions
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));