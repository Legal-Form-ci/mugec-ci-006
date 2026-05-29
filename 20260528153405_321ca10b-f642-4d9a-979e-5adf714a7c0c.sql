-- contact_messages
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  email text NOT NULL,
  telephone text,
  sujet text,
  message text NOT NULL,
  user_id uuid,
  traite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact public insert" ON public.contact_messages;
CREATE POLICY "contact public insert" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(nom)) BETWEEN 1 AND 120
    AND length(btrim(email)) BETWEEN 3 AND 255
    AND length(btrim(message)) BETWEEN 1 AND 4000
  );

DROP POLICY IF EXISTS "contact admin read" ON public.contact_messages;
CREATE POLICY "contact admin read" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "contact admin update" ON public.contact_messages;
CREATE POLICY "contact admin update" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Safe member lookup by matricule (no financial info)
CREATE OR REPLACE FUNCTION public.member_public_info(p_matricule text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  SELECT jsonb_build_object(
    'matricule', m.matricule,
    'nom', m.nom,
    'prenoms', m.prenoms,
    'photo_url', m.photo_url,
    'collectivite', m.collectivite,
    'region', m.region,
    'fonction', m.fonction,
    'statut', m.statut,
    'type_membre', m.type_membre,
    'date_inscription', m.date_inscription
  ) INTO result
  FROM public.members m
  WHERE m.matricule = p_matricule
  LIMIT 1;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.member_public_info(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_public_info(text) TO authenticated;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_members_matricule ON public.members (matricule);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members (user_id);
CREATE INDEX IF NOT EXISTS idx_members_statut ON public.members (statut);
CREATE INDEX IF NOT EXISTS idx_forum_topics_created_at ON public.forum_topics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_messages_topic ON public.forum_messages (topic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cotisations_member ON public.cotisations (member_id, paye_le DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON public.subscriptions (member_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_documents_member ON public.member_documents (member_id);