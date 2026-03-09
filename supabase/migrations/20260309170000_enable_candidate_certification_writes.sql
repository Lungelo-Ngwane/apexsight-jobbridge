-- Allow candidates to create, update, and delete their own certification records.
drop policy if exists candidate_certifications_insert_own on public.candidate_certifications;
create policy candidate_certifications_insert_own
on public.candidate_certifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_certifications.candidate_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists candidate_certifications_update_own on public.candidate_certifications;
create policy candidate_certifications_update_own
on public.candidate_certifications
for update
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_certifications.candidate_id
      and cp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_certifications.candidate_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists candidate_certifications_delete_own on public.candidate_certifications;
create policy candidate_certifications_delete_own
on public.candidate_certifications
for delete
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_certifications.candidate_id
      and cp.user_id = auth.uid()
  )
);
