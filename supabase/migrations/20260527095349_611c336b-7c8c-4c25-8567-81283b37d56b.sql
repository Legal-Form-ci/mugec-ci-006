
-- Create / repair the two canonical admin auth accounts with fixed credentials
DO $$
DECLARE
  v_mugec_id uuid;
  v_inoce_id uuid;
BEGIN
  -- 1. ADMIN MUGEC-CI (login: mugecadmin)
  SELECT id INTO v_mugec_id FROM auth.users WHERE email = 'adminmgec@mugec-ci.local';
  IF v_mugec_id IS NULL THEN
    v_mugec_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_mugec_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'adminmgec@mugec-ci.local',
      crypt('@Mugec-CI26', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"login":"mugecadmin","display_name":"Admin MUGEC-CI"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_mugec_id,
            jsonb_build_object('sub', v_mugec_id::text, 'email', 'adminmgec@mugec-ci.local', 'email_verified', true),
            'email', 'adminmgec@mugec-ci.local', now(), now(), now());
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt('@Mugec-CI26', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now(),
           raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"login":"mugecadmin","display_name":"Admin MUGEC-CI"}'::jsonb
     WHERE id = v_mugec_id;
  END IF;

  -- 2. ADMIN MIPROJET (login: admininoce)
  SELECT id INTO v_inoce_id FROM auth.users WHERE email = 'admininoce@miprojet.local';
  IF v_inoce_id IS NULL THEN
    v_inoce_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_inoce_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'admininoce@miprojet.local',
      crypt('@Massa29012020', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"login":"admininoce","display_name":"Admin MIPROJET"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_inoce_id,
            jsonb_build_object('sub', v_inoce_id::text, 'email', 'admininoce@miprojet.local', 'email_verified', true),
            'email', 'admininoce@miprojet.local', now(), now(), now());
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt('@Massa29012020', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now(),
           raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"login":"admininoce","display_name":"Admin MIPROJET"}'::jsonb
     WHERE id = v_inoce_id;
  END IF;

  -- 3. Assign roles cleanly (remove membre role from these admin accounts)
  -- MUGEC-CI admin: admin_national (top admin for MUGEC-CI scope)
  DELETE FROM public.user_roles WHERE user_id = v_mugec_id AND role = 'membre';
  INSERT INTO public.user_roles (user_id, role)
    VALUES (v_mugec_id, 'admin_national')
    ON CONFLICT (user_id, role) DO NOTHING;

  -- MIPROJET admin: super_admin (super_admin is required for /admin/miprojet)
  DELETE FROM public.user_roles WHERE user_id = v_inoce_id AND role = 'membre';
  INSERT INTO public.user_roles (user_id, role)
    VALUES (v_inoce_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- 4. Update resolve_login_email with explicit mapping for the two admin logins
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
  IF length(v) = 0 THEN RETURN NULL; END IF;

  -- Explicit admin identifier mapping (sections 1-2 of the spec)
  IF v = 'mugecadmin' THEN RETURN 'adminmgec@mugec-ci.local'; END IF;
  IF v = 'admininoce' THEN RETURN 'admininoce@miprojet.local'; END IF;

  -- Already an email
  IF position('@' in v) > 0 THEN RETURN v; END IF;

  -- Phone-based lookup
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

  -- Identifier-based lookup (legacy admins): match email starting with "<identifier>@"
  SELECT u.email INTO v_email
  FROM auth.users u
  WHERE lower(u.email) LIKE v || '@%'
  ORDER BY u.created_at ASC
  LIMIT 1;

  RETURN v_email;
END;
$$;

-- 5. Server-side dashboard path resolver by user_id (no auth.uid() dependency).
-- Used by loginWithIdentifier with the freshly-signed-in user id, so we
-- avoid the race condition where supabase.rpc(...) runs as anon before the
-- browser has finished applying setSession().
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

REVOKE ALL ON FUNCTION public.dashboard_path_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_path_for(uuid) TO service_role;
