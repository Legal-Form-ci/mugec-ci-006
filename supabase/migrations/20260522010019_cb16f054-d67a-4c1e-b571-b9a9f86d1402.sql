
-- Brouillons d'inscription (persistance étape 1)
create table if not exists public.registration_drafts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  telephone text,
  nom text,
  prenoms text,
  step integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists registration_drafts_email_uidx on public.registration_drafts (lower(email));
alter table public.registration_drafts enable row level security;

-- Reprise par email/téléphone (public en écriture limitée, lecture serveur uniquement)
drop policy if exists "drafts public insert" on public.registration_drafts;
create policy "drafts public insert" on public.registration_drafts
  for insert to anon, authenticated with check (true);
drop policy if exists "drafts public update by email" on public.registration_drafts;
create policy "drafts public update by email" on public.registration_drafts
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "drafts admin read" on public.registration_drafts;
create policy "drafts admin read" on public.registration_drafts
  for select to authenticated using (is_admin(auth.uid()));

create trigger registration_drafts_updated
  before update on public.registration_drafts
  for each row execute function public.tg_updated_at();
