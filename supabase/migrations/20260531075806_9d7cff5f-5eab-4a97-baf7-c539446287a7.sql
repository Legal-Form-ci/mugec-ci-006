-- MUGEC-CI — Complément idempotent Lot 2

-- Fonction interne de rate limiting, appelée uniquement côté serveur.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _bucket_key text,
  _limit integer,
  _window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_hits integer;
  v_retry integer;
BEGIN
  IF _bucket_key IS NULL OR length(btrim(_bucket_key)) < 3 OR length(_bucket_key) > 240 THEN
    RAISE EXCEPTION 'Invalid rate limit bucket';
  END IF;
  IF _limit < 1 OR _limit > 1000 OR _window_seconds < 1 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.rate_limit_counters(bucket_key, window_start, hits)
  VALUES (_bucket_key, v_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = public.rate_limit_counters.hits + 1
  RETURNING hits INTO v_hits;

  DELETE FROM public.rate_limit_counters
  WHERE created_at < now() - interval '2 days';

  v_retry := greatest(0, _window_seconds - floor(extract(epoch from now() - v_window_start))::integer);

  RETURN jsonb_build_object(
    'allowed', v_hits <= _limit,
    'hits', v_hits,
    'limit', _limit,
    'retry_after_seconds', v_retry
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

-- File notification : deny explicite des écritures depuis le client si absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_queue' AND policyname='queue deny client insert'
  ) THEN
    CREATE POLICY "queue deny client insert" ON public.notification_queue AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_queue' AND policyname='queue deny client update'
  ) THEN
    CREATE POLICY "queue deny client update" ON public.notification_queue AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notification_queue' AND policyname='queue deny client delete'
  ) THEN
    CREATE POLICY "queue deny client delete" ON public.notification_queue AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
  END IF;
END $$;

-- Audit étendu pour membres, cotisations, prestations et pièces jointes.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id uuid;
  v_target_label text;
BEGIN
  v_target_id := COALESCE(NEW.id, OLD.id);
  v_target_label := COALESCE(
    NEW.matricule,
    OLD.matricule,
    NEW.reference,
    OLD.reference,
    NEW.type_evenement,
    OLD.type_evenement,
    TG_TABLE_NAME
  );

  INSERT INTO public.audit_log(user_id, action, entity, entity_id, metadata, before_data, after_data, severity)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    v_target_id,
    jsonb_build_object('table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'target_label', v_target_label),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    CASE WHEN TG_TABLE_NAME IN ('members','prestation_requests') THEN 'warning' ELSE 'info' END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_row_change() TO service_role;

DROP TRIGGER IF EXISTS audit_members_changes ON public.members;
CREATE TRIGGER audit_members_changes
AFTER INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_cotisations_changes ON public.cotisations;
CREATE TRIGGER audit_cotisations_changes
AFTER INSERT OR UPDATE OR DELETE ON public.cotisations
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_prestation_requests_changes ON public.prestation_requests;
CREATE TRIGGER audit_prestation_requests_changes
AFTER INSERT OR UPDATE OR DELETE ON public.prestation_requests
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_prestation_attachments_changes ON public.prestation_attachments;
CREATE TRIGGER audit_prestation_attachments_changes
AFTER INSERT OR DELETE ON public.prestation_attachments
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Cron jobs idempotents.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminders-overdue-cotisations') THEN
    PERFORM cron.unschedule('reminders-overdue-cotisations');
  END IF;
  PERFORM cron.schedule(
    'reminders-overdue-cotisations',
    '0 8 * * *',
    'SELECT public.enqueue_overdue_cotisation_reminders();'
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'open-member-rights-after-90-days') THEN
    PERFORM cron.unschedule('open-member-rights-after-90-days');
  END IF;
  PERFORM cron.schedule(
    'open-member-rights-after-90-days',
    '30 1 * * *',
    'SELECT public.open_member_rights_after_90_days();'
  );
END $$;