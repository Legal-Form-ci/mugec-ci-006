-- =========================================================
-- MUGEC-CI : Renforcement complet CDC, RLS, triggers, rôles
-- =========================================================

create extension if not exists pgcrypto;

alter type public.app_role add value if not exists 'president';
alter type public.app_role add value if not exists 'secretaire_general';
alter type public.app_role add value if not exists 'tresorier_national';
alter type public.app_role add value if not exists 'commissaire_comptes';
alter type public.app_role add value if not exists 'secretaire_regional';
alter type public.app_role add value if not exists 'tresorier_regional';
alter type public.app_role add value if not exists 'member';

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role::text in ('super_admin','admin_national','admin_regional','admin_local','agent_saisie','president','secretaire_general','tresorier_national','commissaire_comptes','secretaire_regional','tresorier_regional')
  );
$$;

create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'super_admin');
$$;

create or replace function public.tg_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create sequence if not exists public.matricule_seq start 1;

alter table public.members add column if not exists direction text;
alter table public.members add column if not exists date_inscription timestamptz default now();
alter table public.members add column if not exists qr_code text;
alter table public.members add column if not exists is_legacy boolean not null default false;
alter table public.members add column if not exists validation_mode text not null default 'automatique';
alter table public.members add column if not exists payment_reference text;
alter table public.members add column if not exists payment_confirmed_at timestamptz;
alter table public.members add column if not exists photo_required boolean not null default false;
alter table public.members add column if not exists source text not null default 'web';

create or replace function public.generate_matricule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.matricule is null or btrim(new.matricule) = '' then
    new.matricule := 'MUGEC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.matricule_seq')::text, 5, '0');
  end if;
  if new.date_inscription is null then
    new.date_inscription := now();
  end if;
  if new.qr_code is null and new.matricule is not null then
    new.qr_code := 'https://mugec-ci.ivoireprojet.com/m/' || new.matricule;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'membre') on conflict do nothing;
  return new;
end;
$$;

update public.members
set date_inscription = coalesce(date_inscription, created_at, now()),
    qr_code = coalesce(qr_code, 'https://mugec-ci.ivoireprojet.com/m/' || coalesce(matricule, id::text));

alter table public.members alter column user_id set not null;
create index if not exists idx_members_user_id on public.members(user_id);
create index if not exists idx_members_email on public.members(email);
create index if not exists idx_members_region on public.members(region);
create index if not exists idx_members_statut on public.members(statut);

create table if not exists public.dependants (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  type text not null check (type in ('pere','mere','enfant','conjoint','autre')),
  nom text not null,
  prenoms text,
  date_naissance date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dependants enable row level security;
create index if not exists idx_dependants_member_id on public.dependants(member_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  type text not null check (type in ('inscription','cotisation')),
  periode text,
  montant_total integer not null,
  part_mutuelle integer not null default 0,
  part_miprojet integer not null default 0,
  statut_paiement text not null default 'en_attente' check (statut_paiement in ('en_attente','paye','echoue','annule','rembourse')),
  operateur text,
  reference_transaction text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create index if not exists idx_subscriptions_member_id on public.subscriptions(member_id);
create index if not exists idx_subscriptions_status on public.subscriptions(statut_paiement);

create table if not exists public.transactions_miprojet (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  montant integer not null,
  statut text not null default 'en_attente' check (statut in ('en_attente','vire','echoue')),
  date_virement timestamptz,
  reference text,
  created_at timestamptz not null default now()
);
alter table public.transactions_miprojet enable row level security;
create index if not exists idx_transactions_miprojet_subscription_id on public.transactions_miprojet(subscription_id);

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  channel text not null check (channel in ('email','sms','whatsapp','in_app')),
  title text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event, channel)
);
alter table public.notification_templates enable row level security;

create table if not exists public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  user_id uuid,
  canal text not null check (canal in ('email','sms','whatsapp','in_app')),
  event text not null,
  contenu text not null,
  statut text not null default 'en_attente' check (statut in ('en_attente','envoye','echoue','ignore')),
  provider text,
  provider_reference text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications_log enable row level security;
create index if not exists idx_notifications_log_member_id on public.notifications_log(member_id);
create index if not exists idx_notifications_log_user_id on public.notifications_log(user_id);

alter table public.documents add column if not exists title text;
alter table public.documents add column if not exists file_name text;
alter table public.documents add column if not exists mime_type text;
alter table public.documents add column if not exists offline_available boolean not null default true;
alter table public.documents add column if not exists uploaded_by uuid;

drop trigger if exists members_matricule on public.members;
create trigger members_matricule before insert on public.members for each row execute function public.generate_matricule();
drop trigger if exists members_updated on public.members;
create trigger members_updated before update on public.members for each row execute function public.tg_updated_at();
drop trigger if exists cotisations_updated on public.cotisations;
create trigger cotisations_updated before update on public.cotisations for each row execute function public.tg_updated_at();
drop trigger if exists news_updated on public.news;
create trigger news_updated before update on public.news for each row execute function public.tg_updated_at();
drop trigger if exists opp_updated on public.opportunites;
create trigger opp_updated before update on public.opportunites for each row execute function public.tg_updated_at();
drop trigger if exists topic_updated on public.forum_topics;
create trigger topic_updated before update on public.forum_topics for each row execute function public.tg_updated_at();
drop trigger if exists dependants_updated on public.dependants;
create trigger dependants_updated before update on public.dependants for each row execute function public.tg_updated_at();
drop trigger if exists subscriptions_updated on public.subscriptions;
create trigger subscriptions_updated before update on public.subscriptions for each row execute function public.tg_updated_at();
drop trigger if exists notification_templates_updated on public.notification_templates;
create trigger notification_templates_updated before update on public.notification_templates for each row execute function public.tg_updated_at();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS members
drop policy if exists "members select self or admin" on public.members;
create policy "members select self or admin" on public.members for select to authenticated using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "members insert self" on public.members;
create policy "members insert self" on public.members for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "members update self or admin" on public.members;
create policy "members update self or admin" on public.members for update to authenticated using (auth.uid() = user_id or public.is_admin(auth.uid())) with check (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "members delete admin" on public.members;
drop policy if exists "members delete super admin" on public.members;
create policy "members delete super admin" on public.members for delete to authenticated using (public.is_super_admin(auth.uid()));

-- RLS user_roles
drop policy if exists "roles self or admin read" on public.user_roles;
create policy "roles self or admin read" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "roles super admin write" on public.user_roles;
create policy "roles super admin write" on public.user_roles for all to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

-- RLS dependants
drop policy if exists "dependants owner or admin read" on public.dependants;
create policy "dependants owner or admin read" on public.dependants for select to authenticated using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists "dependants owner or admin write" on public.dependants;
create policy "dependants owner or admin write" on public.dependants for all to authenticated using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()) or public.is_admin(auth.uid())) with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()) or public.is_admin(auth.uid()));

-- RLS subscriptions
drop policy if exists "subscriptions owner or admin read" on public.subscriptions;
create policy "subscriptions owner or admin read" on public.subscriptions for select to authenticated using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists "subscriptions owner or admin create" on public.subscriptions;
create policy "subscriptions owner or admin create" on public.subscriptions for insert to authenticated with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists "subscriptions admin update" on public.subscriptions;
create policy "subscriptions admin update" on public.subscriptions for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- RLS transactions MiPROJET
drop policy if exists "transactions_miprojet super admin only" on public.transactions_miprojet;
create policy "transactions_miprojet super admin only" on public.transactions_miprojet for all to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

-- RLS templates et logs
drop policy if exists "notification_templates admins read" on public.notification_templates;
create policy "notification_templates admins read" on public.notification_templates for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists "notification_templates super admin write" on public.notification_templates;
create policy "notification_templates super admin write" on public.notification_templates for all to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

drop policy if exists "notifications_log owner or admin read" on public.notifications_log;
create policy "notifications_log owner or admin read" on public.notifications_log for select to authenticated using ((user_id = auth.uid()) or exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists "notifications_log admin write" on public.notifications_log;
create policy "notifications_log admin write" on public.notifications_log for insert to authenticated with check (public.is_admin(auth.uid()) or user_id = auth.uid());

drop policy if exists "docs owner create" on public.documents;
create policy "docs owner create" on public.documents for insert to authenticated with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()) or public.is_admin(auth.uid()));

insert into public.notification_templates(event, channel, title, body) values
('registration_validated','sms','Inscription validée','Bienvenue à la MUGEC-CI {{prenoms}} {{nom}}. Votre inscription est validée. Matricule : {{matricule}}. Espace membre : {{member_url}}'),
('registration_validated','whatsapp','Bienvenue MUGEC-CI','Bonjour {{prenoms}}, votre inscription MUGEC-CI est validée. Matricule : {{matricule}}. Consultez votre espace : {{member_url}}'),
('registration_validated','email','Bienvenue à la MUGEC-CI','Bonjour {{prenoms}} {{nom}},\n\nVotre inscription à la MUGEC-CI est validée automatiquement après paiement.\nMatricule : {{matricule}}\nCollectivité : {{collectivite}}\n\nTéléchargez votre fiche et votre carte depuis : {{member_url}}\n\nMUGEC-CI'),
('payment_confirmed','sms','Paiement confirmé','Paiement MUGEC-CI confirmé : {{montant}} FCFA via {{operateur}}. Référence : {{reference}}. Merci.'),
('payment_confirmed','whatsapp','Reçu de paiement MUGEC-CI','Votre paiement de {{montant}} FCFA est confirmé. Référence : {{reference}}. Votre reçu est disponible dans l’espace membre.'),
('payment_confirmed','email','Reçu de paiement MUGEC-CI','Bonjour {{prenoms}},\n\nNous confirmons la réception de votre paiement de {{montant}} FCFA via {{operateur}}.\nRéférence : {{reference}}.\n\nVotre reçu et vos documents sont disponibles dans votre espace membre.'),
('cotisation_late_j3','sms','Rappel cotisation','Rappel MUGEC-CI : votre cotisation est en attente. Merci de régulariser via votre espace membre : {{member_url}}'),
('cotisation_late_j7','whatsapp','Rappel cotisation MUGEC-CI','Bonjour {{prenoms}}, votre cotisation reste en attente depuis 7 jours. Régularisez ici : {{member_url}}'),
('status_suspended','email','Statut suspendu MUGEC-CI','Bonjour {{prenoms}},\n\nVotre statut MUGEC-CI est temporairement suspendu. Merci de régulariser votre situation depuis votre espace membre ou de contacter l’administration.'),
('official_communication','email','Communication officielle MUGEC-CI','{{message}}'),
('new_member_admin','email','Nouveau membre inscrit','Nouveau membre MUGEC-CI : {{prenoms}} {{nom}}, matricule {{matricule}}, région {{region}}, collectivité {{collectivite}}.'),
('split_done','email','Virement MiPROJET confirmé','Split paiement effectué. Part MiPROJET : {{part_miprojet}} FCFA. Référence : {{reference}}.')
on conflict(event, channel) do update set title = excluded.title, body = excluded.body, active = true, updated_at = now();

insert into public.user_roles(user_id, role)
select id, 'super_admin'::public.app_role from auth.users where email = 'admin@mugec-ci.ci'
on conflict do nothing;
insert into public.user_roles(user_id, role)
select id, 'admin_national'::public.app_role from auth.users where email = 'admin@mugec-ci.ci'
on conflict do nothing;

insert into public.subscriptions(member_id, type, montant_total, part_mutuelle, part_miprojet, statut_paiement, operateur, reference_transaction, paid_at)
select m.id, 'inscription', 5000, 4000, 1000, case when m.frais_paye then 'paye' else 'en_attente' end, m.paiement_methode,
       coalesce(m.payment_reference, 'INIT-' || m.id::text), m.payment_confirmed_at
from public.members m
where not exists (select 1 from public.subscriptions s where s.member_id = m.id and s.type = 'inscription')
on conflict do nothing;