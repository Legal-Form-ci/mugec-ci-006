
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.user_security (
  user_id UUID PRIMARY KEY,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_security TO authenticated;
GRANT ALL ON public.user_security TO service_role;
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_security self read" ON public.user_security;
CREATE POLICY "user_security self read" ON public.user_security FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_security self update" ON public.user_security;
CREATE POLICY "user_security self update" ON public.user_security FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS consent_reglement BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_prelevement BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_confidentialite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_members_nom_trgm ON public.members USING gin (lower(nom) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_members_prenoms_trgm ON public.members USING gin (lower(prenoms) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_members_matricule ON public.members (matricule);
CREATE INDEX IF NOT EXISTS idx_members_statut ON public.members (statut);
CREATE INDEX IF NOT EXISTS idx_members_collectivite ON public.members (collectivite);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON public.members (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotisations_member ON public.cotisations (member_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_periode ON public.cotisations (periode);
CREATE INDEX IF NOT EXISTS idx_cotisations_statut ON public.cotisations (statut);
CREATE INDEX IF NOT EXISTS idx_cotisations_created_at ON public.cotisations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestation_requests_member ON public.prestation_requests (member_id);
CREATE INDEX IF NOT EXISTS idx_prestation_requests_statut ON public.prestation_requests (statut_global);
CREATE INDEX IF NOT EXISTS idx_prestation_requests_created_at ON public.prestation_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_published ON public.news (published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunites_published ON public.opportunites (published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_traite ON public.contact_messages (traite, created_at DESC);

INSERT INTO public.notification_templates (event, channel, title, body, active) VALUES
  ('account.created', 'email',
   'Votre compte {{role_label}} a été créé',
   E'Bonjour {{prenoms}},\n\nVotre compte a été créé sur la plateforme MUGEC-CI / MIPROJET.\n\nIdentifiant : {{identifiant}}\nMot de passe provisoire : {{password}}\n\nVeuillez vous connecter ici : {{login_url}}\nDès votre première connexion, vous serez invité à définir un nouveau mot de passe.\n\nMerci.',
   true),
  ('registration.completed', 'email',
   'Bienvenue à la MUGEC-CI — inscription confirmée',
   E'Bonjour {{prenoms}},\n\nVotre inscription en tant que membre est enregistrée. En vous inscrivant, vous avez expressément accepté :\n• le Règlement intérieur de la mutuelle\n• l''Autorisation de prélèvement des cotisations\n• la Clause de confidentialité et de traitement des données\n\nVotre matricule : {{matricule}}\n\nVos droits seront ouverts dès confirmation du paiement et après le délai règlementaire.\n\nMUGEC-CI vous remercie.',
   true),
  ('password.must_change', 'email',
   'Action requise : changez votre mot de passe',
   E'Bonjour {{prenoms}},\n\nPour des raisons de sécurité, vous devez définir un nouveau mot de passe lors de votre prochaine connexion.\n\nConnectez-vous ici : {{login_url}}\n\nMerci.',
   true)
ON CONFLICT DO NOTHING;
