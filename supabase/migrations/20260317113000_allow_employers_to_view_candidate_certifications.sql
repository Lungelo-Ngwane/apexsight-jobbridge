drop policy if exists candidate_certifications_select_own on public.candidate_certifications;
drop policy if exists candidate_certifications_select_own_or_related_employer on public.candidate_certifications;
create policy candidate_certifications_select_own_or_related_employer
on public.candidate_certifications
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_certifications.candidate_id
      and cp.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.job_applications ja
    join public.jobs j on j.id = ja.job_id
    where ja.candidate_profile_id = candidate_certifications.candidate_id
      and public.is_employer_member(j.employer_id)
  )
);

drop policy if exists "candidate_certifications_files_select_own" on storage.objects;
drop policy if exists "candidate_certifications_files_select_own_or_related_employer" on storage.objects;
create policy "candidate_certifications_files_select_own_or_related_employer"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'candidate-certifications'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.candidate_certifications cc
      join public.candidate_profiles cp on cp.id = cc.candidate_id
      join public.job_applications ja on ja.candidate_profile_id = cp.id
      join public.jobs j on j.id = ja.job_id
      where cc.certificate_file_path = name
        and public.is_employer_member(j.employer_id)
    )
  )
);
