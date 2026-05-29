CREATE OR REPLACE VIEW public.finance_revenue_summary
WITH (security_invoker = on) AS
SELECT
  s.id,
  s.member_id,
  s.type,
  CASE
    WHEN s.type IN ('inscription', 'droit_adhesion', 'adhesion') THEN 'droit_adhesion'
    WHEN s.type = 'cotisation' THEN 'cotisation'
    ELSE s.type
  END AS categorie,
  s.periode,
  s.montant_total,
  s.part_mutuelle,
  s.part_miprojet,
  s.statut_paiement,
  s.operateur,
  s.reference_transaction,
  COALESCE(s.paid_at, s.created_at) AS date_operation,
  s.created_at
FROM public.subscriptions s;

GRANT SELECT ON public.finance_revenue_summary TO authenticated;
GRANT ALL ON public.finance_revenue_summary TO service_role;

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
  cotisations_mois integer;
  droits_adhesion_total integer;
  droits_adhesion_mois integer;
  revenus_total integer;
  revenus_mois integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(SUM(montant_total), 0)::integer
    INTO cotisations_total
  FROM public.subscriptions
  WHERE type = 'cotisation' AND statut_paiement = 'paye';

  SELECT COALESCE(SUM(montant_total), 0)::integer
    INTO cotisations_mois
  FROM public.subscriptions
  WHERE type = 'cotisation' AND statut_paiement = 'paye'
    AND COALESCE(paid_at, created_at) >= date_trunc('month', now());

  SELECT COALESCE(SUM(montant_total), 0)::integer
    INTO droits_adhesion_total
  FROM public.subscriptions
  WHERE type = 'inscription' AND statut_paiement = 'paye';

  SELECT COALESCE(SUM(montant_total), 0)::integer
    INTO droits_adhesion_mois
  FROM public.subscriptions
  WHERE type = 'inscription' AND statut_paiement = 'paye'
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
    'subscriptions_payees', (SELECT COUNT(*) FROM public.subscriptions WHERE statut_paiement = 'paye'),
    'paiements_total', GREATEST((SELECT COUNT(*) FROM public.payment_sessions), (SELECT COUNT(*) FROM public.subscriptions)),
    'paiements_payes', GREATEST((SELECT COUNT(*) FROM public.payment_sessions WHERE statut = 'paye'), (SELECT COUNT(*) FROM public.subscriptions WHERE statut_paiement = 'paye')),
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
  sub_mutuelle_total integer;
  sub_mutuelle_mois integer;
  sub_paid_count integer;
  droits_adhesion_miprojet integer;
  cotisations_miprojet integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(SUM(montant), 0)::integer INTO tx_total FROM public.transactions_miprojet;
  SELECT COALESCE(SUM(montant), 0)::integer INTO tx_paye FROM public.transactions_miprojet WHERE statut = 'vire';
  SELECT COALESCE(SUM(montant), 0)::integer INTO tx_attente FROM public.transactions_miprojet WHERE statut = 'en_attente';

  SELECT COALESCE(SUM(part_miprojet), 0)::integer, COUNT(*)::integer
    INTO sub_miprojet_total, sub_paid_count
  FROM public.subscriptions
  WHERE statut_paiement = 'paye';

  SELECT COALESCE(SUM(part_miprojet), 0)::integer INTO sub_miprojet_mois
  FROM public.subscriptions
  WHERE statut_paiement = 'paye' AND COALESCE(paid_at, created_at) >= date_trunc('month', now());

  SELECT COALESCE(SUM(part_mutuelle), 0)::integer INTO sub_mutuelle_total
  FROM public.subscriptions
  WHERE statut_paiement = 'paye';

  SELECT COALESCE(SUM(part_mutuelle), 0)::integer INTO sub_mutuelle_mois
  FROM public.subscriptions
  WHERE statut_paiement = 'paye' AND COALESCE(paid_at, created_at) >= date_trunc('month', now());

  SELECT COALESCE(SUM(part_miprojet), 0)::integer INTO droits_adhesion_miprojet
  FROM public.subscriptions
  WHERE type = 'inscription' AND statut_paiement = 'paye';

  SELECT COALESCE(SUM(part_miprojet), 0)::integer INTO cotisations_miprojet
  FROM public.subscriptions
  WHERE type = 'cotisation' AND statut_paiement = 'paye';

  SELECT jsonb_build_object(
    'transactions_total', GREATEST(tx_total, sub_miprojet_total),
    'transactions_paye', GREATEST(tx_paye, sub_miprojet_total),
    'transactions_attente', tx_attente,
    'parts_miprojet_total', sub_miprojet_total,
    'parts_miprojet_mois', sub_miprojet_mois,
    'parts_mutuelle_total', sub_mutuelle_total,
    'parts_mutuelle_mois', sub_mutuelle_mois,
    'droits_adhesion_miprojet', droits_adhesion_miprojet,
    'cotisations_miprojet', cotisations_miprojet,
    'sessions_paiement', GREATEST((SELECT COUNT(*) FROM public.payment_sessions WHERE statut = 'paye'), sub_paid_count),
    'subscriptions_payees', sub_paid_count,
    'members_total', (SELECT COUNT(*) FROM public.members),
    'cotisations_total', (SELECT COALESCE(SUM(montant_total), 0) FROM public.subscriptions WHERE type = 'cotisation' AND statut_paiement = 'paye')
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
  IF NEW.statut_paiement <> 'paye' THEN
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

  INSERT INTO public.cotisations(member_id, periode, montant, statut, methode, reference, paye_le)
  SELECT NEW.member_id, period_value, NEW.montant_total, 'paye', NEW.operateur, tx_ref, paid_at_value
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cotisations c
    WHERE c.member_id = NEW.member_id
      AND COALESCE(c.reference, '') = tx_ref
  );

  IF COALESCE(NEW.part_miprojet, 0) > 0 THEN
    INSERT INTO public.transactions_miprojet(subscription_id, montant, statut, reference, date_virement)
    SELECT NEW.id, NEW.part_miprojet, 'vire', tx_ref, paid_at_value
    WHERE NOT EXISTS (
      SELECT 1 FROM public.transactions_miprojet t WHERE t.subscription_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS subscriptions_financial_sync ON public.subscriptions;
CREATE TRIGGER subscriptions_financial_sync
AFTER INSERT OR UPDATE OF statut_paiement, paid_at, reference_transaction, montant_total, part_miprojet, part_mutuelle, operateur, periode, type
ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_subscription_financials();

INSERT INTO public.cotisations(member_id, periode, montant, statut, methode, reference, paye_le)
SELECT
  s.member_id,
  COALESCE(s.periode, to_char(COALESCE(s.paid_at, s.created_at), 'YYYY-MM')),
  s.montant_total,
  'paye',
  s.operateur,
  COALESCE(s.reference_transaction, s.id::text),
  COALESCE(s.paid_at, s.created_at)
FROM public.subscriptions s
WHERE s.statut_paiement = 'paye'
  AND NOT EXISTS (
    SELECT 1 FROM public.cotisations c
    WHERE c.member_id = s.member_id
      AND COALESCE(c.reference, '') = COALESCE(s.reference_transaction, s.id::text)
  );

INSERT INTO public.transactions_miprojet(subscription_id, montant, statut, reference, date_virement)
SELECT s.id, s.part_miprojet, 'vire', COALESCE(s.reference_transaction, s.id::text), COALESCE(s.paid_at, s.created_at)
FROM public.subscriptions s
WHERE s.statut_paiement = 'paye'
  AND COALESCE(s.part_miprojet, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.transactions_miprojet t WHERE t.subscription_id = s.id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_member_type_status_date
  ON public.subscriptions(member_id, type, statut_paiement, COALESCE(paid_at, created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_type_status_date
  ON public.subscriptions(type, statut_paiement, COALESCE(paid_at, created_at) DESC);

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.miprojet_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.miprojet_dashboard_stats() TO authenticated;