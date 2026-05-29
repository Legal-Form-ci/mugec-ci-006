drop policy if exists "drafts public insert" on public.registration_drafts;
create policy "drafts public insert" on public.registration_drafts
for insert to anon, authenticated
with check (
  email is not null
  and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  and step between 1 and 4
  and coalesce(expires_at, now() + interval '30 days') <= now() + interval '31 days'
);

drop policy if exists "drafts public update by email" on public.registration_drafts;
create policy "drafts public update by email" on public.registration_drafts
for update to anon, authenticated
using (
  email is not null
  and expires_at > now()
)
with check (
  email is not null
  and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  and step between 1 and 4
  and expires_at <= now() + interval '31 days'
);

revoke execute on function public.open_member_rights_after_90_days() from anon, authenticated;
revoke execute on function public.validate_prestation_step(uuid, text, text) from anon;
grant execute on function public.validate_prestation_step(uuid, text, text) to authenticated;