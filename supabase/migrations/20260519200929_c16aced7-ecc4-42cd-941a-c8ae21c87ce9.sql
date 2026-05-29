
-- =========================================================
-- MUGEC-CI : Migration complète
-- =========================================================

-- 1) Enum des rôles
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'super_admin','admin_national','admin_regional','admin_local','agent_saisie','membre'
    );
  end if;
end $$;

-- 2) Table user_roles
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  region text,
  collectivite text,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- 3) Fonction has_role (security definer, évite la récursion RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('super_admin','admin_national','admin_regional','admin_local')
  );
$$;

-- 4) Trigger updated_at générique
create or replace function public.tg_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- 5) Séquence matricule
create sequence if not exists public.matricule_seq start 1;

-- 6) Table members
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  matricule text unique,
  nom text not null,
  prenoms text not null,
  date_naissance date,
  lieu_naissance text,
  sexe text check (sexe in ('M','F')),
  email text,
  telephone text,
  cni text,
  adresse text,
  photo_url text,
  collectivite text,
  region text,
  fonction text,
  matricule_pro text,
  date_embauche date,
  ayants_droit text,
  statut text not null default 'en_attente' check (statut in ('en_attente','actif','suspendu','radie')),
  paiement_methode text,
  frais_paye boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.members enable row level security;

create or replace function public.generate_matricule()
returns trigger language plpgsql as $$
begin
  if new.matricule is null then
    new.matricule := 'MUGEC-' || to_char(now(),'YYYY') || '-' ||
                     lpad(nextval('public.matricule_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists members_matricule on public.members;
create trigger members_matricule before insert on public.members
  for each row execute function public.generate_matricule();

drop trigger if exists members_updated on public.members;
create trigger members_updated before update on public.members
  for each row execute function public.tg_updated_at();

-- RLS members
drop policy if exists "members select self or admin" on public.members;
create policy "members select self or admin" on public.members for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "members insert self" on public.members;
create policy "members insert self" on public.members for insert
  with check (auth.uid() = user_id);
drop policy if exists "members update self or admin" on public.members;
create policy "members update self or admin" on public.members for update
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "members delete admin" on public.members;
create policy "members delete admin" on public.members for delete
  using (public.has_role(auth.uid(),'super_admin'));

-- 7) Cotisations
create table if not exists public.cotisations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  periode text not null,
  montant integer not null,
  statut text not null default 'en_attente' check (statut in ('en_attente','paye','en_retard')),
  methode text,
  reference text,
  paye_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cotisations enable row level security;
drop trigger if exists cotisations_updated on public.cotisations;
create trigger cotisations_updated before update on public.cotisations
  for each row execute function public.tg_updated_at();

drop policy if exists "coti select owner or admin" on public.cotisations;
create policy "coti select owner or admin" on public.cotisations for select using (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
  or public.is_admin(auth.uid())
);
drop policy if exists "coti insert owner or admin" on public.cotisations;
create policy "coti insert owner or admin" on public.cotisations for insert with check (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
  or public.is_admin(auth.uid())
);
drop policy if exists "coti update admin" on public.cotisations;
create policy "coti update admin" on public.cotisations for update using (public.is_admin(auth.uid()));

-- 8) News
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  cover_url text,
  author_id uuid references auth.users(id) on delete set null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.news enable row level security;
drop trigger if exists news_updated on public.news;
create trigger news_updated before update on public.news
  for each row execute function public.tg_updated_at();

drop policy if exists "news public read" on public.news;
create policy "news public read" on public.news for select using (published or public.is_admin(auth.uid()));
drop policy if exists "news admin write" on public.news;
create policy "news admin write" on public.news for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 9) Opportunités
create table if not exists public.opportunites (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text,
  lieu text,
  date_limite date,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.opportunites enable row level security;
drop trigger if exists opp_updated on public.opportunites;
create trigger opp_updated before update on public.opportunites
  for each row execute function public.tg_updated_at();
drop policy if exists "opp public read" on public.opportunites;
create policy "opp public read" on public.opportunites for select using (published or public.is_admin(auth.uid()));
drop policy if exists "opp admin write" on public.opportunites;
create policy "opp admin write" on public.opportunites for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 10) Forum
create table if not exists public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.forum_topics enable row level security;
drop trigger if exists topic_updated on public.forum_topics;
create trigger topic_updated before update on public.forum_topics
  for each row execute function public.tg_updated_at();

create table if not exists public.forum_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.forum_messages enable row level security;

drop policy if exists "topics auth read" on public.forum_topics;
create policy "topics auth read" on public.forum_topics for select using (auth.uid() is not null);
drop policy if exists "topics auth create" on public.forum_topics;
create policy "topics auth create" on public.forum_topics for insert with check (auth.uid() = author_id);
drop policy if exists "topics owner or admin update" on public.forum_topics;
create policy "topics owner or admin update" on public.forum_topics for update
  using (auth.uid() = author_id or public.is_admin(auth.uid()));
drop policy if exists "topics admin delete" on public.forum_topics;
create policy "topics admin delete" on public.forum_topics for delete using (public.is_admin(auth.uid()));

drop policy if exists "msg auth read" on public.forum_messages;
create policy "msg auth read" on public.forum_messages for select using (auth.uid() is not null);
drop policy if exists "msg auth create" on public.forum_messages;
create policy "msg auth create" on public.forum_messages for insert with check (auth.uid() = author_id);
drop policy if exists "msg owner update" on public.forum_messages;
create policy "msg owner update" on public.forum_messages for update using (auth.uid() = author_id);
drop policy if exists "msg owner or admin delete" on public.forum_messages;
create policy "msg owner or admin delete" on public.forum_messages for delete
  using (auth.uid() = author_id or public.is_admin(auth.uid()));

-- 11) Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp','in_app')),
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "notif owner read" on public.notifications;
create policy "notif owner read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notif owner update" on public.notifications;
create policy "notif owner update" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "notif admin insert" on public.notifications;
create policy "notif admin insert" on public.notifications for insert
  with check (public.is_admin(auth.uid()) or auth.uid() = user_id);

-- 12) Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  type text not null,
  url text not null,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
drop policy if exists "docs owner or admin read" on public.documents;
create policy "docs owner or admin read" on public.documents for select using (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
  or public.is_admin(auth.uid())
);
drop policy if exists "docs admin write" on public.documents;
create policy "docs admin write" on public.documents for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 13) Audit log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "audit super admin read" on public.audit_log;
create policy "audit super admin read" on public.audit_log for select
  using (public.has_role(auth.uid(),'super_admin'));

-- 14) RLS user_roles : lecture par soi-même et admins ; écriture admin uniquement
drop policy if exists "roles self or admin read" on public.user_roles;
create policy "roles self or admin read" on public.user_roles for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
drop policy if exists "roles super admin write" on public.user_roles;
create policy "roles super admin write" on public.user_roles for all
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- 15) Trigger : attribution automatique du rôle 'membre' à toute nouvelle inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'membre')
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 16) Création du compte super admin : admin@mugec-ci.ci / __ROTATE_ME__
do $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'admin@mugec-ci.ci';
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      'admin@mugec-ci.ci', crypt('__ROTATE_ME__', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Super Admin MUGEC-CI"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'admin@mugec-ci.ci'),
      'email', v_uid::text, now(), now(), now());
  end if;

  insert into public.user_roles (user_id, role) values (v_uid, 'super_admin')
    on conflict do nothing;
  insert into public.user_roles (user_id, role) values (v_uid, 'admin_national')
    on conflict do nothing;
end $$;
