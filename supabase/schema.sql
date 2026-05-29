-- ============================================================
-- MUGEC-CI : Schéma Supabase initial
-- À exécuter dans le SQL Editor de votre projet Supabase externe.
-- ============================================================

-- 1. Enum des rôles
create type if not exists public.app_role as enum (
  'super_admin',
  'admin_national',
  'admin_regional',
  'admin_local',
  'agent_saisie',
  'membre'
);

-- 2. Table user_roles (jamais sur profiles !)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  region text,
  collectivite text,
  created_at timestamptz default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- 3. Fonction security definer
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- 4. Table members
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
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
  statut text default 'en_attente' check (statut in ('en_attente','actif','suspendu','radie')),
  paiement_methode text,
  frais_paye boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.members enable row level security;

-- 5. RLS members
create policy "members select self" on public.members
  for select using (auth.uid() = user_id or public.has_role(auth.uid(),'super_admin')
                    or public.has_role(auth.uid(),'admin_national'));
create policy "members insert self" on public.members
  for insert with check (auth.uid() = user_id);
create policy "members update self" on public.members
  for update using (auth.uid() = user_id);

-- 6. Cotisations
create table if not exists public.cotisations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  periode text not null,
  montant integer not null,
  statut text default 'en_attente' check (statut in ('en_attente','paye','en_retard')),
  methode text,
  paye_le timestamptz,
  created_at timestamptz default now()
);
alter table public.cotisations enable row level security;
create policy "coti owner" on public.cotisations for select
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));

-- 7. Actualités
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean default true,
  created_at timestamptz default now()
);
alter table public.news enable row level security;
create policy "news public" on public.news for select using (published);

-- 8. Trigger updated_at
create or replace function public.tg_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger members_updated before update on public.members
  for each row execute function public.tg_updated_at();

-- 9. Auto-attribution rôle membre à l'inscription
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'membre')
  on conflict do nothing;
  return new;
end; $$ language plpgsql security definer set search_path = public;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 10. Génération matricule
create or replace function public.generate_matricule() returns trigger as $$
begin
  if new.matricule is null then
    new.matricule := 'MUGEC-' || to_char(now(),'YYYY') || '-' ||
                     lpad(nextval('public.matricule_seq')::text, 5, '0');
  end if;
  return new;
end; $$ language plpgsql;
create sequence if not exists public.matricule_seq start 1;
create trigger members_matricule before insert on public.members
  for each row execute function public.generate_matricule();
