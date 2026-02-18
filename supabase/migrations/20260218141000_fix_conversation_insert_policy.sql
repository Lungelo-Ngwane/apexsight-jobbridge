drop policy if exists conversations_insert_participants on public.conversations;

create policy conversations_insert_participants
on public.conversations
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    exists (
      select 1
      from public.employer_profiles ep
      where ep.id = employer_id
        and ep.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.candidate_profiles cp
      where cp.id = candidate_profile_id
        and cp.user_id = auth.uid()
    )
  )
);

