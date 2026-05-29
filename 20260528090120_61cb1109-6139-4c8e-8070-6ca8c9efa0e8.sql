-- Harden dashboard/statistics RPCs so they no longer run with elevated privileges.
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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
END;
$$;

CREATE OR REPLACE FUNCTION public.miprojet_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.miprojet_dashboard_stats() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.miprojet_dashboard_stats() TO authenticated;

-- Do not expose this privileged workflow RPC directly to clients.
REVOKE EXECUTE ON FUNCTION public.validate_prestation_step(uuid, text, text) FROM anon, authenticated, public;

-- Helper predicate used only inside RLS policies; keeps payment-session access narrow.
CREATE OR REPLACE FUNCTION public.can_manage_payments(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text IN ('super_admin', 'admin_national', 'tresorier_national')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_payments(uuid) FROM anon, authenticated, public;

-- Payment sessions: remove member_id-based reads and prevent users from marking sessions as paid.
DROP POLICY IF EXISTS "payment sessions owner or admin read" ON public.payment_sessions;
DROP POLICY IF EXISTS "payment sessions owner create" ON public.payment_sessions;
DROP POLICY IF EXISTS "payment sessions admin update" ON public.payment_sessions;

CREATE POLICY "payment sessions owner or payment admin read"
ON public.payment_sessions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_manage_payments(auth.uid())
);

CREATE POLICY "payment sessions safe owner create"
ON public.payment_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND statut = 'en_attente'
    AND confirmed_at IS NULL
    AND coalesce(provider_payload, '{}'::jsonb) = '{}'::jsonb
  )
  OR public.can_manage_payments(auth.uid())
);

CREATE POLICY "payment sessions payment admin update"
ON public.payment_sessions
FOR UPDATE
TO authenticated
USING (public.can_manage_payments(auth.uid()))
WITH CHECK (public.can_manage_payments(auth.uid()));

-- Registration drafts contain PII and are not used by the current form flow; block public mutation.
DROP POLICY IF EXISTS "drafts public insert" ON public.registration_drafts;
DROP POLICY IF EXISTS "drafts public update by email" ON public.registration_drafts;
DROP POLICY IF EXISTS "drafts update by device" ON public.registration_drafts;