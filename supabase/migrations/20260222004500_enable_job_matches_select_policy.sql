alter table if exists public.job_matches enable row level security;

drop policy if exists job_matches_select_employer_own on public.job_matches;
create policy job_matches_select_employer_own
on public.job_matches
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = job_matches.job_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists job_matches_select_candidate_own on public.job_matches;
create policy job_matches_select_candidate_own
on public.job_matches
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = job_matches.candidate_id
      and cp.user_id = auth.uid()
  )
);
