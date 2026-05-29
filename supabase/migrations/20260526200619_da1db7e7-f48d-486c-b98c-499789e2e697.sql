-- Corriger les agrégations dashboard et fiabiliser la synchronisation financière publique.

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  cotisations_total integer;
  subscriptions_total integer;
  cotisations_mois integer;
  subscriptions_mois integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(SUM(montant), 0)::integer
    INTO cotisations_total
  FROM public.cotisations
  WHERE statut IN ('paye', 'confirme', 'valide');

  SELECT COALESCE(SUM(montant_total), 0)::integer
    INTO subscriptions_total
  FROM public.subscriptions
  WHERE statut_paiement IN ('paye', 'confirme', 'valide');

  SELECT COALESCE(SUM(montant), 0)::integer
    INTO cotisations_mois
  FROM public.cotisations
  WHERE statut IN ('paye', 'confirme', 'valide')
    AND COALESCE(paye_le, created_at) >= date_trunc('month', now());

  SELECT COALESCE(SUM(montant_total), 0)::integer
    INTO subscriptions_mois
  FROM public.subscriptions
  WHERE statut_paiement IN ('paye', 'confirme', 'valide')
    AND COALESCE(paid_at, created_at) >= date_trunc('month', now());

  SELECT jsonb_build_object(
    'members_total', (SELECT COUNT(*) FROM public.members),
    'members_actifs', (SELECT COUNT(*) FROM public.members WHERE statut = 'actif'),
    'members_en_attente', (SELECT COUNT(*) FROM public.members WHERE statut = 'en_attente'),
    'members_suspendus', (SELECT COUNT(*) FROM public.members WHERE statut = 'suspendu'),
    'cotisations_mois', GREATEST(cotisations_mois, subscriptions_mois),
    'cotisations_total', GREATEST(cotisations_total, subscriptions_total),
    'cotisations_attente', (SELECT COUNT(*) FROM public.cotisations WHERE statut IN ('en_attente', 'pending')),
    'prestations_en_cours', (SELECT COUNT(*) FROM public.prestation_requests WHERE statut_global IN ('en_attente', 'en_cours')),
    'prestations_validees_mois', (SELECT COUNT(*) FROM public.prestation_requests WHERE statut_global IN ('valide', 'validé') AND COALESCE(closed_at, updated_at) >= date_trunc('month', now())),
    'prestations_rejetees_mois', (SELECT COUNT(*) FROM public.prestation_requests WHERE statut_global IN ('rejete', 'rejeté') AND COALESCE(closed_at, updated_at) >= date_trunc('month', now())),
    'subscriptions_total', (SELECT COUNT(*) FROM public.subscriptions),
    'subscriptions_payees', (SELECT COUNT(*) FROM public.subscriptions WHERE statut_paiement IN ('paye', 'confirme', 'valide')),
    'paiements_total', (SELECT COUNT(*) FROM public.payment_sessions),
    'paiements_payes', (SELECT COUNT(*) FROM public.payment_sessions WHERE statut IN ('paye', 'confirme', 'valide')),
    'notifications_total', (SELECT COUNT(*) FROM public.notifications),
    'forum_topics_total', (SELECT COUNT(*) FROM public.forum_topics),
    'forum_messages_total', (SELECT COUNT(*) FROM public.forum_messages)
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.miprojet_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  tx_total integer;
  tx_paye integer;
  tx_attente integer;
  sub_miprojet_total integer;
  sub_miprojet_mois integer;
  sub_mutuelle_mois integer;
  sub_paid_count integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(SUM(montant), 0)::integer
    INTO tx_total
  FROM public.transactions_miprojet;

  SELECT COALESCE(SUM(montant), 0)::integer
    INTO tx_paye
  FROM public.transactions_miprojet
  WHERE statut IN ('paye', 'confirme', 'valide');

  SELECT COALESCE(SUM(montant), 0)::integer
    INTO tx_attente
  FROM public.transactions_miprojet
  WHERE statut IN ('en_attente', 'pending');

  SELECT COALESCE(SUM(part_miprojet), 0)::integer, COUNT(*)::integer
    INTO sub_miprojet_total, sub_paid_count
  FROM public.subscriptions
  WHERE statut_paiement IN ('paye', 'confirme', 'valide');

  SELECT COALESCE(SUM(part_miprojet), 0)::integer
    INTO sub_miprojet_mois
  FROM public.subscriptions
  WHERE statut_paiement IN ('paye', 'confirme', 'valide')
    AND COALESCE(paid_at, created_at) >= date_trunc('month', now());

  SELECT COALESCE(SUM(part_mutuelle), 0)::integer
    INTO sub_mutuelle_mois
  FROM public.subscriptions
  WHERE statut_paiement IN ('paye', 'confirme', 'valide')
    AND COALESCE(paid_at, created_at) >= date_trunc('month', now());

  SELECT jsonb_build_object(
    'transactions_total', GREATEST(tx_total, sub_miprojet_total),
    'transactions_paye', GREATEST(tx_paye, sub_miprojet_total),
    'transactions_attente', tx_attente,
    'parts_miprojet_mois', sub_miprojet_mois,
    'parts_mutuelle_mois', sub_mutuelle_mois,
    'sessions_paiement', GREATEST((SELECT COUNT(*) FROM public.payment_sessions WHERE statut IN ('paye', 'confirme', 'valide')), sub_paid_count),
    'subscriptions_payees', sub_paid_count,
    'members_total', (SELECT COUNT(*) FROM public.members),
    'cotisations_total', (SELECT COALESCE(SUM(montant), 0) FROM public.cotisations WHERE statut IN ('paye', 'confirme', 'valide'))
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_subscription_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  paid_at_value timestamptz;
  period_value text;
  tx_ref text;
BEGIN
  IF NEW.statut_paiement NOT IN ('paye', 'confirme', 'valide') THEN
    RETURN NEW;
  END IF;

  paid_at_value := COALESCE(NEW.paid_at, now());
  period_value := COALESCE(NEW.periode, to_char(paid_at_value, 'YYYY-MM'));
  tx_ref := COALESCE(NEW.reference_transaction, NEW.id::text);

  UPDATE public.members
  SET
    frais_paye = CASE WHEN NEW.type = 'inscription' THEN true ELSE frais_paye END,
    statut = CASE WHEN NEW.type = 'inscription' AND statut = 'en_attente' THEN 'actif' ELSE statut END,
    payment_reference = CASE WHEN NEW.type = 'inscription' THEN COALESCE(payment_reference, tx_ref) ELSE payment_reference END,
    payment_confirmed_at = CASE WHEN NEW.type = 'inscription' THEN COALESCE(payment_confirmed_at, paid_at_value) ELSE payment_confirmed_at END,
    last_cotisation_at = GREATEST(COALESCE(last_cotisation_at, paid_at_value), paid_at_value),
    updated_at = now()
  WHERE id = NEW.member_id;

  IF NEW.type IN ('inscription', 'cotisation') THEN
    INSERT INTO public.cotisations(member_id, periode, montant, statut, methode, reference, paye_le)
    SELECT NEW.member_id, period_value, NEW.montant_total, 'paye', NEW.operateur, tx_ref, paid_at_value
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cotisations c
      WHERE c.member_id = NEW.member_id
        AND COALESCE(c.reference, '') = tx_ref
    );
  END IF;

  IF COALESCE(NEW.part_miprojet, 0) > 0 THEN
    INSERT INTO public.transactions_miprojet(subscription_id, montant, statut, reference, date_virement)
    SELECT NEW.id, NEW.part_miprojet, 'paye', tx_ref, paid_at_value
    WHERE NOT EXISTS (
      SELECT 1 FROM public.transactions_miprojet t
      WHERE t.subscription_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS subscriptions_financial_sync ON public.subscriptions;
CREATE TRIGGER subscriptions_financial_sync
AFTER INSERT OR UPDATE OF statut_paiement, paid_at, reference_transaction, montant_total, part_miprojet, part_mutuelle, operateur, periode
ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_subscription_financials();

CREATE OR REPLACE FUNCTION public.sync_paid_payment_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sub_id uuid;
  paid_at_value timestamptz;
  period_value text;
  ref_value text;
BEGIN
  IF NEW.statut NOT IN ('paye', 'confirme', 'valide') OR NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  paid_at_value := COALESCE(NEW.confirmed_at, now());
  period_value := to_char(paid_at_value, 'YYYY-MM');
  ref_value := COALESCE(NEW.reference, NEW.id::text);

  INSERT INTO public.subscriptions(
    member_id, type, periode, montant_total, part_mutuelle, part_miprojet,
    statut_paiement, operateur, reference_transaction, paid_at
  )
  SELECT
    NEW.member_id,
    NEW.type,
    period_value,
    NEW.montant_total,
    NEW.part_mutuelle,
    NEW.part_miprojet,
    'paye',
    NEW.operateur,
    ref_value,
    paid_at_value
  WHERE NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.member_id = NEW.member_id
      AND COALESCE(s.reference_transaction, '') = ref_value
  )
  RETURNING id INTO sub_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS payment_sessions_paid_sync ON public.payment_sessions;
CREATE TRIGGER payment_sessions_paid_sync
AFTER INSERT OR UPDATE OF statut, confirmed_at, reference
ON public.payment_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_paid_payment_session();

DROP TRIGGER IF EXISTS members_matricule ON public.members;
CREATE TRIGGER members_matricule
BEFORE INSERT ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.generate_matricule();

DROP TRIGGER IF EXISTS members_updated ON public.members;
CREATE TRIGGER members_updated
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.tg_updated_at();

DROP TRIGGER IF EXISTS cotisations_updated ON public.cotisations;
CREATE TRIGGER cotisations_updated
BEFORE UPDATE ON public.cotisations
FOR EACH ROW
EXECUTE FUNCTION public.tg_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated ON public.subscriptions;
CREATE TRIGGER subscriptions_updated
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.tg_updated_at();

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_statut_created ON public.members(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_matricule ON public.members(matricule);
CREATE INDEX IF NOT EXISTS idx_members_email_lower ON public.members(lower(email));
CREATE INDEX IF NOT EXISTS idx_members_telephone ON public.members(telephone);
CREATE INDEX IF NOT EXISTS idx_members_region_collectivite ON public.members(region, collectivite);
CREATE INDEX IF NOT EXISTS idx_cotisations_member_status_date ON public.cotisations(member_id, statut, COALESCE(paye_le, created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_cotisations_status_date ON public.cotisations(statut, COALESCE(paye_le, created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member_status_date ON public.subscriptions(member_id, statut_paiement, COALESCE(paid_at, created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_date ON public.subscriptions(statut_paiement, COALESCE(paid_at, created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status_date ON public.payment_sessions(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_miprojet_status_date ON public.transactions_miprojet(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestation_requests_status_date ON public.prestation_requests(statut_global, COALESCE(closed_at, created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_forum_topics_created ON public.forum_topics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_messages_topic_created ON public.forum_messages(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications(user_id, read, created_at DESC);

CREATE OR REPLACE FUNCTION public.dashboard_sync_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN jsonb_build_object(
    'members_without_role', (
      SELECT COUNT(*) FROM public.members m
      WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = m.user_id)
    ),
    'paid_subscriptions_without_cotisation', (
      SELECT COUNT(*) FROM public.subscriptions s
      WHERE s.statut_paiement IN ('paye', 'confirme', 'valide')
        AND s.type IN ('inscription', 'cotisation')
        AND NOT EXISTS (
          SELECT 1 FROM public.cotisations c
          WHERE c.member_id = s.member_id
            AND COALESCE(c.reference, '') = COALESCE(s.reference_transaction, s.id::text)
        )
    ),
    'paid_subscriptions_without_miprojet_transaction', (
      SELECT COUNT(*) FROM public.subscriptions s
      WHERE s.statut_paiement IN ('paye', 'confirme', 'valide')
        AND COALESCE(s.part_miprojet, 0) > 0
        AND NOT EXISTS (SELECT 1 FROM public.transactions_miprojet t WHERE t.subscription_id = s.id)
    ),
    'orphan_cotisations', (
      SELECT COUNT(*) FROM public.cotisations c
      WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = c.member_id)
    ),
    'orphan_subscriptions', (
      SELECT COUNT(*) FROM public.subscriptions s
      WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = s.member_id)
    ),
    'orphan_miprojet_transactions', (
      SELECT COUNT(*) FROM public.transactions_miprojet t
      WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = t.subscription_id)
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.miprojet_dashboard_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dashboard_sync_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_subscription_financials() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_paid_payment_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.miprojet_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_sync_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_financials() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_paid_payment_session() TO service_role;