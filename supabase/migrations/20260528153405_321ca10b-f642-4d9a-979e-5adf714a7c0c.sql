
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  cotisations_total integer;
  cotisations_mois integer;
  droits_adhesion_total integer;
  droits_adhesion_mois integer;
  revenus_total integer;
  revenus_mois integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- MUGEC-CI ne perçoit que la part mutuelle (part_mutuelle), pas la part MIPROJET.
  SELECT COALESCE(SUM(part_mutuelle), 0)::integer
    INTO cotisations_total
  FROM public.subscriptions
  WHERE type = 'cotisation' AND statut_paiement IN ('paye','confirme','valide');

  SELECT COALESCE(SUM(part_mutuelle), 0)::integer
    INTO cotisations_mois
  FROM public.subscriptions
  WHERE type = 'cotisation' AND statut_paiement IN ('paye','confirme','valide')
    AND COALESCE(paid_at, created_at) >= date_trunc('month', now());

  SELECT COALESCE(SUM(part_mutuelle), 0)::integer
    INTO droits_adhesion_total
  FROM public.subscriptions
  WHERE type = 'inscription' AND statut_paiement IN ('paye','confirme','valide');

  SELECT COALESCE(SUM(part_mutuelle), 0)::integer
    INTO droits_adhesion_mois
  FROM public.subscriptions
  WHERE type = 'inscription' AND statut_paiement IN ('paye','confirme','valide')
    AND COALESCE(paid_at, created_at) >= date_trunc('month', now());

  revenus_total := cotisations_total + droits_adhesion_total;
  revenus_mois := cotisations_mois + droits_adhesion_mois;

  SELECT jsonb_build_object(
    'members_total', (SELECT COUNT(*) FROM public.members),
    'members_actifs', (SELECT COUNT(*) FROM public.members WHERE statut = 'actif'),
    'members_en_attente', (SELECT COUNT(*) FROM public.members WHERE statut = 'en_attente'),
    'members_suspendus', (SELECT COUNT(*) FROM public.members WHERE statut = 'suspendu'),
    'droits_adhesion_total', droits_adhesion_total,
    'droits_adhesion_mois', droits_adhesion_mois,
    'cotisations_mois', cotisations_mois,
    'cotisations_total', cotisations_total,
    'revenus_mois', revenus_mois,
    'revenus_total', revenus_total,
    'cotisations_attente', (SELECT COUNT(*) FROM public.cotisations WHERE statut = 'en_attente'),
    'prestations_en_cours', (SELECT COUNT(*) FROM public.prestation_requests WHERE statut_global IN ('en_attente', 'en_cours')),
    'prestations_validees_mois', (SELECT COUNT(*) FROM public.prestation_requests WHERE statut_global = 'valide' AND COALESCE(closed_at, updated_at, created_at) >= date_trunc('month', now())),
    'prestations_rejetees_mois', (SELECT COUNT(*) FROM public.prestation_requests WHERE statut_global = 'rejete' AND COALESCE(closed_at, updated_at, created_at) >= date_trunc('month', now())),
    'subscriptions_total', (SELECT COUNT(*) FROM public.subscriptions),
    'subscriptions_payees', (SELECT COUNT(*) FROM public.subscriptions WHERE statut_paiement IN ('paye','confirme','valide')),
    'paiements_total', GREATEST((SELECT COUNT(*) FROM public.payment_sessions), (SELECT COUNT(*) FROM public.subscriptions)),
    'paiements_payes', GREATEST((SELECT COUNT(*) FROM public.payment_sessions WHERE statut = 'paye'), (SELECT COUNT(*) FROM public.subscriptions WHERE statut_paiement IN ('paye','confirme','valide'))),
    'notifications_total', (SELECT COUNT(*) FROM public.notifications),
    'forum_topics_total', (SELECT COUNT(*) FROM public.forum_topics),
    'forum_messages_total', (SELECT COUNT(*) FROM public.forum_messages)
  ) INTO result;

  RETURN result;
END;
$function$;

-- Indexes pour accélérer les agrégats sur 50k+ utilisateurs.
CREATE INDEX IF NOT EXISTS idx_subscriptions_type_statut_paid_at
  ON public.subscriptions (type, statut_paiement, paid_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member_id
  ON public.subscriptions (member_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_member_statut
  ON public.cotisations (member_id, statut);
CREATE INDEX IF NOT EXISTS idx_notifications_log_created_at
  ON public.notifications_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_log_canal
  ON public.notifications_log (canal, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_user_id
  ON public.members (user_id);
CREATE INDEX IF NOT EXISTS idx_members_statut
  ON public.members (statut);
