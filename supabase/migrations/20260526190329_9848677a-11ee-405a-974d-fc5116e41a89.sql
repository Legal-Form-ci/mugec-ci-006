CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'members_total', (SELECT count(*) FROM public.members),
    'members_actifs', (SELECT count(*) FROM public.members WHERE statut = 'actif'),
    'members_en_attente', (SELECT count(*) FROM public.members WHERE statut = 'en_attente'),
    'members_suspendus', (SELECT count(*) FROM public.members WHERE statut = 'suspendu'),
    'cotisations_mois', (SELECT coalesce(sum(montant),0) FROM public.cotisations WHERE statut = 'paye' AND paye_le >= date_trunc('month', now())),
    'cotisations_total', (SELECT coalesce(sum(montant),0) FROM public.cotisations WHERE statut = 'paye'),
    'cotisations_attente', (SELECT count(*) FROM public.cotisations WHERE statut = 'en_attente'),
    'prestations_en_cours', (SELECT count(*) FROM public.prestation_requests WHERE statut_global IN ('en_attente','en_cours')),
    'prestations_validees_mois', (SELECT count(*) FROM public.prestation_requests WHERE statut_global = 'valide' AND closed_at >= date_trunc('month', now())),
    'prestations_rejetees_mois', (SELECT count(*) FROM public.prestation_requests WHERE statut_global = 'rejete' AND closed_at >= date_trunc('month', now()))
  ) INTO result;
  RETURN result;
END;
$function$;