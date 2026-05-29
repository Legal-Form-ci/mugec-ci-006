CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v text;
  digits text;
  v_email text;
BEGIN
  v := lower(trim(coalesce(p_identifier, '')));
  IF length(v) = 0 THEN
    RETURN NULL;
  END IF;

  IF v = 'mugecadmin' OR v = 'adminmgec' THEN
    RETURN 'admin@mugec-ci.local';
  END IF;

  IF v = 'admininoce' OR v = 'inoceadmin' THEN
    RETURN 'inoce@miprojet.local';
  END IF;

  IF position('@' in v) > 0 THEN
    RETURN v;
  END IF;

  digits := regexp_replace(v, '\D', '', 'g');
  IF digits ~ '^[0-9]+$' AND length(digits) >= 6 THEN
    BEGIN
      SELECT public.lookup_member_email_by_phone(digits) INTO v_email;
      IF v_email IS NOT NULL AND length(v_email) > 0 THEN
        RETURN v_email;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated, service_role;