
-- 1) Members: restrict self-update to non-sensitive fields
DROP POLICY IF EXISTS "members update self or admin" ON public.members;

CREATE POLICY "members update self limited"
ON public.members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND statut             IS NOT DISTINCT FROM (SELECT m.statut             FROM public.members m WHERE m.id = members.id)
  AND frais_paye         IS NOT DISTINCT FROM (SELECT m.frais_paye         FROM public.members m WHERE m.id = members.id)
  AND payment_confirmed_at IS NOT DISTINCT FROM (SELECT m.payment_confirmed_at FROM public.members m WHERE m.id = members.id)
  AND payment_reference  IS NOT DISTINCT FROM (SELECT m.payment_reference  FROM public.members m WHERE m.id = members.id)
  AND droits_ouverts_le  IS NOT DISTINCT FROM (SELECT m.droits_ouverts_le  FROM public.members m WHERE m.id = members.id)
  AND validation_mode    IS NOT DISTINCT FROM (SELECT m.validation_mode    FROM public.members m WHERE m.id = members.id)
  AND matricule          IS NOT DISTINCT FROM (SELECT m.matricule          FROM public.members m WHERE m.id = members.id)
  AND is_legacy          IS NOT DISTINCT FROM (SELECT m.is_legacy          FROM public.members m WHERE m.id = members.id)
);

CREATE POLICY "members update admin"
ON public.members
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Also force initial insert to be pending / unpaid regardless of client payload
DROP POLICY IF EXISTS "members insert self" ON public.members;
CREATE POLICY "members insert self safe"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND statut = 'en_attente'
  AND frais_paye = false
  AND payment_confirmed_at IS NULL
  AND droits_ouverts_le IS NULL
);

-- 2) Notifications: only admins (or server) can insert
DROP POLICY IF EXISTS "notif admin insert" ON public.notifications;
CREATE POLICY "notif admin insert only"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- 3) Registration drafts: require device_fingerprint match for updates
DROP POLICY IF EXISTS "drafts public update by email" ON public.registration_drafts;
CREATE POLICY "drafts update by device"
ON public.registration_drafts
FOR UPDATE
TO anon, authenticated
USING (
  email IS NOT NULL
  AND expires_at > now()
  AND device_fingerprint IS NOT NULL
  AND device_fingerprint = current_setting('request.headers', true)::json->>'x-device-fingerprint'
)
WITH CHECK (
  email IS NOT NULL
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND step BETWEEN 1 AND 4
  AND expires_at <= now() + interval '31 days'
  AND device_fingerprint IS NOT NULL
  AND device_fingerprint = current_setting('request.headers', true)::json->>'x-device-fingerprint'
);

-- Require device_fingerprint on inserts too
DROP POLICY IF EXISTS "drafts public insert" ON public.registration_drafts;
CREATE POLICY "drafts public insert"
ON public.registration_drafts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND step BETWEEN 1 AND 4
  AND COALESCE(expires_at, now() + interval '30 days') <= now() + interval '31 days'
  AND device_fingerprint IS NOT NULL
  AND length(device_fingerprint) BETWEEN 8 AND 256
);

-- 4) Revoke EXECUTE on sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.open_member_rights_after_90_days() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_prestation_step(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
