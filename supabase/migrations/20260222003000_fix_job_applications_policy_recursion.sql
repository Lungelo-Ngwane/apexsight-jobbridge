-- Fix infinite recursion in job_applications RLS policy evaluation.

create or replace function public.is_current_user_candidate_profile(
  p_candidate_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = p_candidate_profile_id
      and cp.user_id = auth.uid()
  );
$$;

create or replace function public.is_current_user_employer_for_job(
  p_job_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = p_job_id
      and ep.user_id = auth.uid()
  );
$$;

grant execute on function public.is_current_user_candidate_profile(uuid) to authenticated;
grant execute on function public.is_current_user_employer_for_job(uuid) to authenticated;

alter table if exists public.job_applications enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_applications'
  loop
    execute format(
      'drop policy if exists %I on public.job_applications',
      r.policyname
    );
  end loop;
end $$;

create policy job_applications_select_candidate_own
on public.job_applications
for select
to authenticated
using (
  public.is_current_user_candidate_profile(candidate_profile_id)
);

create policy job_applications_select_employer_own
on public.job_applications
for select
to authenticated
using (
  public.is_current_user_employer_for_job(job_id)
);

create policy job_applications_insert_candidate_own
on public.job_applications
for insert
to authenticated
with check (
  public.is_current_user_candidate_profile(candidate_profile_id)
);

create policy job_applications_update_employer_own
on public.job_applications
for update
to authenticated
using (
  public.is_current_user_employer_for_job(job_id)
)
with check (
  public.is_current_user_employer_for_job(job_id)
);
