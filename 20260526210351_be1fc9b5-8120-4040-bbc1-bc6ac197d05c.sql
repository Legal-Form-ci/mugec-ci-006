create extension if not exists pgcrypto;

alter type public.app_role add value if not exists 'directeur_executif';
alter type public.app_role add value if not exists 'comite_controle';
alter type public.app_role add value if not exists 'conseil_sages';
alter type public.app_role add value if not exists 'delegue_section';

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
      and role::text in (
        'super_admin','admin_national','admin_regional','admin_local','agent_saisie',
        'president','secretaire_general','tresorier_national','commissaire_comptes',
        'directeur_executif','comite_controle','conseil_sages','secretaire_regional',
        'tresorier_regional','delegue_section'
      )
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

alter table public.members add column if not exists type_membre text not null default 'office';
alter table public.members add column if not exists droits_ouverts_le timestamptz;
alter table public.members add column if not exists step_completed integer not null default 1;
alter table public.members add column if not exists suspended_reason text;
alter table public.members add column if not exists last_cotisation_at timestamptz;
alter table public.members add constraint members_type_membre_check check (type_membre in ('office','affilie','honoraire')) not valid;
alter table public.members add constraint members_step_completed_check check (step_completed between 1 and 4) not valid;
create index if not exists idx_members_matricule on public.members(matricule);
create index if not exists idx_members_telephone on public.members(telephone);
create index if not exists idx_members_collectivite on public.members(collectivite);
create index if not exists idx_members_created_at on public.members(created_at);
create index if not exists idx_members_droits_ouverts_le on public.members(droits_ouverts_le);

alter table public.registration_drafts add column if not exists device_fingerprint text;
alter table public.registration_drafts add column if not exists last_seen timestamptz not null default now();
alter table public.registration_drafts add column if not exists expires_at timestamptz not null default (now() + interval '30 days');
alter table public.registration_drafts add column if not exists uploaded_documents jsonb not null default '{}'::jsonb;
create index if not exists idx_registration_drafts_resume on public.registration_drafts(nom, email, telephone);
create index if not exists idx_registration_drafts_expires_at on public.registration_drafts(expires_at);

alter table public.dependants add column if not exists extrait_url text;
create or replace function public.check_children_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type = 'enfant' and (
    select count(*) from public.dependants
    where member_id = new.member_id and type = 'enfant' and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) >= 4 then
    raise exception 'Maximum 4 enfants autorisés par membre';
  end if;
  return new;
end;
$$;
drop trigger if exists dependants_children_limit on public.dependants;
create trigger dependants_children_limit before insert or update on public.dependants for each row execute function public.check_children_limit();

create table if not exists public.member_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  draft_id uuid references public.registration_drafts(id) on delete cascade,
  type text not null check (type in ('fiche_signee','autorisation_signee','cni','extrait_naissance','extrait_enfant','photo','autre')),
  url text not null,
  file_name text,
  mime_type text,
  size_bytes integer,
  validated boolean not null default false,
  validated_by uuid,
  validated_at timestamptz,
  rejection_reason text,
  offline_available boolean not null default true,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint member_documents_owner_check check (member_id is not null or draft_id is not null)
);
alter table public.member_documents enable row level security;
create index if not exists idx_member_documents_member_id on public.member_documents(member_id);
create index if not exists idx_member_documents_draft_id on public.member_documents(draft_id);
create index if not exists idx_member_documents_type on public.member_documents(type);

drop policy if exists "member documents owner or admin read" on public.member_documents;
create policy "member documents owner or admin read" on public.member_documents for select to authenticated using (
  public.is_admin(auth.uid())
  or exists (select 1 from public.members m where m.id = member_documents.member_id and m.user_id = auth.uid())
);
drop policy if exists "member documents owner create" on public.member_documents;
create policy "member documents owner create" on public.member_documents for insert to authenticated with check (
  public.is_admin(auth.uid())
  or exists (select 1 from public.members m where m.id = member_documents.member_id and m.user_id = auth.uid())
);
drop policy if exists "member documents admin update" on public.member_documents;
create policy "member documents admin update" on public.member_documents for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table if not exists public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  draft_id uuid references public.registration_drafts(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  type text not null check (type in ('inscription','cotisation','prestation')),
  operateur text not null check (operateur in ('orange','mtn','wave','moov')),
  telephone text not null,
  montant_total integer not null,
  part_mutuelle integer not null default 0,
  part_miprojet integer not null default 0,
  statut text not null default 'en_attente' check (statut in ('en_attente','paye','echoue','expire','annule')),
  reference text unique,
  provider_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_sessions enable row level security;
create index if not exists idx_payment_sessions_user_id on public.payment_sessions(user_id);
create index if not exists idx_payment_sessions_member_id on public.payment_sessions(member_id);
create index if not exists idx_payment_sessions_reference on public.payment_sessions(reference);
create index if not exists idx_payment_sessions_statut on public.payment_sessions(statut);

drop policy if exists "payment sessions owner or admin read" on public.payment_sessions;
create policy "payment sessions owner or admin read" on public.payment_sessions for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.members m where m.id = payment_sessions.member_id and m.user_id = auth.uid())
  or public.is_admin(auth.uid())
);
drop policy if exists "payment sessions owner create" on public.payment_sessions;
create policy "payment sessions owner create" on public.payment_sessions for insert to authenticated with check (user_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "payment sessions admin update" on public.payment_sessions;
create policy "payment sessions admin update" on public.payment_sessions for update to authenticated using (public.is_admin(auth.uid()) or user_id = auth.uid()) with check (public.is_admin(auth.uid()) or user_id = auth.uid());

create table if not exists public.prestation_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  type_evenement text not null check (type_evenement in ('mariage_membre','mariage_deux_membres','naissance','naissance_deux_membres','deces_membre','deces_conjoint','deces_ascendant','deces_enfant','retraite')),
  montant_applicable integer not null default 0,
  statut_global text not null default 'en_attente' check (statut_global in ('en_attente','en_cours','valide','rejete','annule')),
  step_validation integer not null default 1 check (step_validation between 1 and 5),
  pj_urls jsonb not null default '[]'::jsonb,
  motif_rejet text,
  submitted_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.prestation_requests enable row level security;
create index if not exists idx_prestation_requests_member_id on public.prestation_requests(member_id);
create index if not exists idx_prestation_requests_step on public.prestation_requests(step_validation);
create index if not exists idx_prestation_requests_status on public.prestation_requests(statut_global);
create index if not exists idx_prestation_requests_created_at on public.prestation_requests(created_at);

create table if not exists public.prestation_validations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.prestation_requests(id) on delete cascade,
  niveau integer not null check (niveau between 1 and 5),
  validateur_id uuid not null,
  role_requis text not null,
  action text not null check (action in ('valide','rejete')),
  motif text,
  metadata jsonb not null default '{}'::jsonb,
  validated_at timestamptz not null default now()
);
alter table public.prestation_validations enable row level security;
create index if not exists idx_prestation_validations_request_id on public.prestation_validations(request_id);
create index if not exists idx_prestation_validations_validateur_id on public.prestation_validations(validateur_id);

create or replace function public.calculate_prestation_amount(_type text, _date_inscription timestamptz default now())
returns integer
language plpgsql
stable
set search_path = public
as $$
declare years integer;
begin
  if _type = 'mariage_membre' then return 100000; end if;
  if _type = 'mariage_deux_membres' then return 200000; end if;
  if _type = 'naissance' then return 50000; end if;
  if _type = 'naissance_deux_membres' then return 100000; end if;
  if _type = 'deces_membre' then return 300000; end if;
  if _type = 'deces_conjoint' then return 200000; end if;
  if _type = 'deces_ascendant' then return 200000; end if;
  if _type = 'deces_enfant' then return 150000; end if;
  if _type = 'retraite' then
    years := greatest(0, date_part('year', age(now(), coalesce(_date_inscription, now())))::integer);
    if years <= 10 then return 200000; end if;
    if years <= 15 then return 250000; end if;
    if years <= 20 then return 300000; end if;
    if years <= 25 then return 400000; end if;
    return 500000;
  end if;
  return 0;
end;
$$;

create or replace function public.set_prestation_amount()
returns trigger
language plpgsql
set search_path = public
as $$
declare joined_at timestamptz;
begin
  select date_inscription into joined_at from public.members where id = new.member_id;
  new.montant_applicable := public.calculate_prestation_amount(new.type_evenement, joined_at);
  return new;
end;
$$;
drop trigger if exists prestation_amount_before_insert on public.prestation_requests;
create trigger prestation_amount_before_insert before insert or update of type_evenement on public.prestation_requests for each row execute function public.set_prestation_amount();

create or replace function public.role_for_prestation_step(_step integer)
returns text
language sql
stable
set search_path = public
as $$
  select case _step
    when 1 then 'delegue_section'
    when 2 then 'secretaire_regional'
    when 3 then 'secretaire_general'
    when 4 then 'tresorier_national'
    else 'system'
  end;
$$;

create or replace function public.validate_prestation_step(_request_id uuid, _action text, _motif text default null)
returns public.prestation_requests
language plpgsql
security definer
set search_path = public
as $$
declare req public.prestation_requests;
declare required_role text;
begin
  select * into req from public.prestation_requests where id = _request_id for update;
  if not found then raise exception 'Demande introuvable'; end if;
  if req.step_validation >= 5 or req.statut_global in ('valide','rejete','annule') then
    raise exception 'Demande déjà clôturée';
  end if;
  required_role := public.role_for_prestation_step(req.step_validation);
  if required_role <> 'system' and not exists (
    select 1 from public.user_roles where user_id = auth.uid() and role::text = required_role
  ) and not public.is_super_admin(auth.uid()) then
    raise exception 'Rôle insuffisant pour cette validation';
  end if;
  insert into public.prestation_validations(request_id, niveau, validateur_id, role_requis, action, motif)
  values (_request_id, req.step_validation, auth.uid(), required_role, _action, _motif);
  if _action = 'rejete' then
    update public.prestation_requests set statut_global = 'rejete', motif_rejet = _motif, closed_at = now(), updated_at = now() where id = _request_id returning * into req;
  elsif req.step_validation = 4 then
    update public.prestation_requests set step_validation = 5, statut_global = 'valide', closed_at = now(), updated_at = now() where id = _request_id returning * into req;
  else
    update public.prestation_requests set step_validation = step_validation + 1, statut_global = 'en_cours', updated_at = now() where id = _request_id returning * into req;
  end if;
  return req;
end;
$$;

drop policy if exists "prestation owner or admin read" on public.prestation_requests;
create policy "prestation owner or admin read" on public.prestation_requests for select to authenticated using (
  exists (select 1 from public.members m where m.id = prestation_requests.member_id and m.user_id = auth.uid())
  or public.is_admin(auth.uid())
);
drop policy if exists "prestation owner create" on public.prestation_requests;
create policy "prestation owner create" on public.prestation_requests for insert to authenticated with check (
  exists (select 1 from public.members m where m.id = prestation_requests.member_id and m.user_id = auth.uid())
  and exists (select 1 from public.members m where m.id = prestation_requests.member_id and m.droits_ouverts_le is not null and m.droits_ouverts_le <= now())
);
drop policy if exists "prestation admin update" on public.prestation_requests;
create policy "prestation admin update" on public.prestation_requests for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "prestation validations owner or admin read" on public.prestation_validations;
create policy "prestation validations owner or admin read" on public.prestation_validations for select to authenticated using (
  exists (
    select 1 from public.prestation_requests pr
    join public.members m on m.id = pr.member_id
    where pr.id = prestation_validations.request_id and m.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);
drop policy if exists "prestation validations admin insert" on public.prestation_validations;
create policy "prestation validations admin insert" on public.prestation_validations for insert to authenticated with check (public.is_admin(auth.uid()));

create table if not exists public.cron_jobs_log (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  statut text not null default 'ok' check (statut in ('ok','erreur')),
  details jsonb not null default '{}'::jsonb,
  executed_at timestamptz not null default now()
);
alter table public.cron_jobs_log enable row level security;
drop policy if exists "cron logs super admin read" on public.cron_jobs_log;
create policy "cron logs super admin read" on public.cron_jobs_log for select to authenticated using (public.is_super_admin(auth.uid()));

create or replace function public.open_member_rights_after_90_days()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare updated_count integer;
begin
  update public.members m
  set droits_ouverts_le = now(), updated_at = now()
  where droits_ouverts_le is null
    and statut = 'actif'
    and exists (
      select 1 from public.subscriptions s
      where s.member_id = m.id
        and s.type = 'cotisation'
        and s.statut_paiement = 'paye'
        and s.paid_at <= now() - interval '90 days'
    );
  get diagnostics updated_count = row_count;
  insert into public.cron_jobs_log(job_name, statut, details)
  values ('open_member_rights_after_90_days', 'ok', jsonb_build_object('updated_count', updated_count));
  return updated_count;
end;
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

drop trigger if exists payment_sessions_updated on public.payment_sessions;
create trigger payment_sessions_updated before update on public.payment_sessions for each row execute function public.tg_updated_at();
drop trigger if exists prestation_requests_updated on public.prestation_requests;
create trigger prestation_requests_updated before update on public.prestation_requests for each row execute function public.tg_updated_at();

insert into public.notification_templates(event, channel, title, body) values
('prestation_submitted','email','Nouvelle demande de prestation','Une demande {{type_evenement}} est en attente de validation niveau {{step_validation}}.'),
('prestation_next_step','whatsapp','Validation prestation MUGEC-CI','Une demande MUGEC-CI attend votre validation niveau {{step_validation}}.'),
('prestation_late_j5','email','Relance validation prestation','Une demande de prestation attend votre action depuis 5 jours ouvrés.'),
('prestation_validated','sms','Prestation validée','Votre demande de prestation MUGEC-CI est validée. Montant : {{montant}} FCFA.'),
('prestation_rejected','sms','Prestation rejetée','Votre demande MUGEC-CI est rejetée. Motif : {{motif}}'),
('rights_opened','sms','Droits prestations ouverts','Vos droits aux prestations MUGEC-CI sont ouverts. Vous pouvez déposer une demande depuis votre espace membre.')
on conflict(event, channel) do update set title = excluded.title, body = excluded.body, active = true, updated_at = now();