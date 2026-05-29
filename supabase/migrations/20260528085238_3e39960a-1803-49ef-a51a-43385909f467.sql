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

  IF v = 'mugecadmin' THEN
    RETURN 'admin@mugec-ci.local';
  END IF;

  IF v IN ('inoceadmin', 'admininoce') THEN
    RETURN 'inoce@miprojet.local';
  END IF;

  IF v = 'adminmgec' THEN
    RETURN 'admin@mugec-ci.local';
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
      v_email := NULL;
    END;
  END IF;

  SELECT u.email INTO v_email
  FROM auth.users u
  WHERE lower(u.email) LIKE v || '@%'
  ORDER BY u.created_at ASC
  LIMIT 1;

  RETURN v_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_path_for(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
    ) THEN '/admin/miprojet'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text IN (
          'admin_national','admin_regional','admin_local','agent_saisie',
          'president','secretaire_general','tresorier_national','commissaire_comptes',
          'directeur_executif','comite_controle','conseil_sages','secretaire_regional',
          'tresorier_regional','delegue_section'
        )
    ) THEN '/admin'
    ELSE '/membre'
  END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_dashboard_path()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.dashboard_path_for(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_path_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_dashboard_path() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_path_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_dashboard_path() TO authenticated, service_role;