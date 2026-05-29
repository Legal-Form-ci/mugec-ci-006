
-- Comptes admin synthétiques + index ciblés pour dashboards admin

-- 1. Création des comptes super-admin via auth.users (mots de passe bcrypt via crypt())
DO $$
DECLARE
  v_inoce_id uuid;
  v_mugec_id uuid;
BEGIN
  -- Super-admin MiProjet : identifiant "inoceadmin" -> email synthétique
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'inoceadmin@miprojet.local') THEN
    v_inoce_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_inoce_id, 'authenticated', 'authenticated',
      'inoceadmin@miprojet.local',
      crypt('__ROTATE_ME__', gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',ARRAY['email'],'username','inoceadmin'),
      jsonb_build_object('username','inoceadmin','display_name','Super Admin MiProjet'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_inoce_id,
            jsonb_build_object('sub', v_inoce_id::text, 'email', 'inoceadmin@miprojet.local'),
            'email', v_inoce_id::text, now(), now(), now());
  ELSE
    SELECT id INTO v_inoce_id FROM auth.users WHERE email = 'inoceadmin@miprojet.local';
    UPDATE auth.users SET encrypted_password = crypt('__ROTATE_ME__', gen_salt('bf')), updated_at = now()
    WHERE id = v_inoce_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_inoce_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Admin MUGEC-CI : identifiant "adminmgec"
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'adminmgec@mugec-ci.local') THEN
    v_mugec_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_mugec_id, 'authenticated', 'authenticated',
      'adminmgec@mugec-ci.local',
      crypt('__ROTATE_ME__', gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',ARRAY['email'],'username','adminmgec'),
      jsonb_build_object('username','adminmgec','display_name','Admin MUGEC-CI'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_mugec_id,
            jsonb_build_object('sub', v_mugec_id::text, 'email', 'adminmgec@mugec-ci.local'),
            'email', v_mugec_id::text, now(), now(), now());
  ELSE
    SELECT id INTO v_mugec_id FROM auth.users WHERE email = 'adminmgec@mugec-ci.local';
    UPDATE auth.users SET encrypted_password = crypt('__ROTATE_ME__', gen_salt('bf')), updated_at = now()
    WHERE id = v_mugec_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_mugec_id, 'admin_national')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- 2. Indexes ciblés pour les dashboards (pagination 50/page)
CREATE INDEX IF NOT EXISTS idx_members_statut_created ON public.members (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_region ON public.members (region);
CREATE INDEX IF NOT EXISTS idx_members_collectivite ON public.members (collectivite);
CREATE INDEX IF NOT EXISTS idx_members_telephone ON public.members (telephone);
CREATE INDEX IF NOT EXISTS idx_members_matricule ON public.members (matricule);
CREATE INDEX IF NOT EXISTS idx_cotisations_member_periode ON public.cotisations (member_id, periode);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member_status ON public.subscriptions (member_id, statut_paiement, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestation_requests_statut ON public.prestation_requests (statut_global, step_validation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON public.payment_sessions (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_miprojet_status ON public.transactions_miprojet (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_log_user ON public.notifications_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log (user_id, created_at DESC);

-- 3. SECURITY DEFINER : KPIs dashboard (évite N+1)
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT jsonb_build_object(
    'members_total', (SELECT count(*) FROM public.members),
    'members_actifs', (SELECT count(*) FROM public.members WHERE statut = 'actif'),
    'members_en_attente', (SELECT count(*) FROM public.members WHERE statut = 'en_attente'),
    'cotisations_mois', (SELECT coalesce(sum(montant),0) FROM public.cotisations WHERE statut = 'paye' AND paye_le >= date_trunc('month', now())),
    'cotisations_total', (SELECT coalesce(sum(montant),0) FROM public.cotisations WHERE statut = 'paye'),
    'prestations_en_cours', (SELECT count(*) FROM public.prestation_requests WHERE statut_global IN ('en_attente','en_cours')),
    'prestations_validees_mois', (SELECT count(*) FROM public.prestation_requests WHERE statut_global = 'valide' AND closed_at >= date_trunc('month', now())),
    'transactions_miprojet_total', (SELECT coalesce(sum(montant),0) FROM public.transactions_miprojet WHERE statut = 'paye')
  ) INTO result;
  RETURN result;
END $$;

-- 4. SECURITY DEFINER : MiProjet KPIs (super_admin uniquement)
CREATE OR REPLACE FUNCTION public.miprojet_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT jsonb_build_object(
    'transactions_total', (SELECT coalesce(sum(montant),0) FROM public.transactions_miprojet),
    'transactions_paye', (SELECT coalesce(sum(montant),0) FROM public.transactions_miprojet WHERE statut = 'paye'),
    'transactions_attente', (SELECT coalesce(sum(montant),0) FROM public.transactions_miprojet WHERE statut = 'en_attente'),
    'parts_miprojet_mois', (SELECT coalesce(sum(part_miprojet),0) FROM public.subscriptions WHERE statut_paiement = 'paye' AND paid_at >= date_trunc('month', now())),
    'parts_mutuelle_mois', (SELECT coalesce(sum(part_mutuelle),0) FROM public.subscriptions WHERE statut_paiement = 'paye' AND paid_at >= date_trunc('month', now())),
    'sessions_paiement', (SELECT count(*) FROM public.payment_sessions WHERE statut = 'paye')
  ) INTO result;
  RETURN result;
END $$;
