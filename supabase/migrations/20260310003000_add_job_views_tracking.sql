alter table if exists public.jobs
add column if not exists view_count integer not null default 0;

create table if not exists public.job_views (
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  open_count integer not null default 1,
  primary key (job_id, candidate_user_id)
);

alter table if exists public.job_views enable row level security;

create policy "candidates_select_own_job_views"
on public.job_views
for select
using (candidate_user_id = auth.uid());

create policy "employers_select_job_views_for_own_jobs"
on public.job_views
for select
using (
  exists (
    select 1
    from public.jobs
    where jobs.id = job_views.job_id
      and jobs.employer_id = auth.uid()
  )
);

create or replace function public.record_job_view(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_user_id uuid := auth.uid();
  v_is_new_view boolean := false;
  v_view_count integer := 0;
begin
  if v_candidate_user_id is null or p_job_id is null then
    return 0;
  end if;

  insert into public.job_views (
    job_id,
    candidate_user_id,
    first_viewed_at,
    last_viewed_at,
    open_count
  )
  values (
    p_job_id,
    v_candidate_user_id,
    now(),
    now(),
    1
  )
  on conflict (job_id, candidate_user_id) do nothing;

  v_is_new_view := found;

  if not v_is_new_view then
    update public.job_views
    set
      last_viewed_at = now(),
      open_count = open_count + 1
    where job_id = p_job_id
      and candidate_user_id = v_candidate_user_id;
  end if;

  if v_is_new_view then
    update public.jobs
    set view_count = coalesce(view_count, 0) + 1
    where id = p_job_id;
  end if;

  select coalesce(view_count, 0)
  into v_view_count
  from public.jobs
  where id = p_job_id;

  return coalesce(v_view_count, 0);
end;
$$;

grant execute on function public.record_job_view(uuid) to authenticated;
