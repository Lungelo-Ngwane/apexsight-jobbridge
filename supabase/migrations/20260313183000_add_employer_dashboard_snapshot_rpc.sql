create or replace function public.get_employer_dashboard_snapshot()
returns table (
  plan_name text,
  active_jobs integer,
  total_applicants integer,
  shortlisted integer,
  job_limit integer,
  extra_job_slot_credits integer,
  candidate_views_used_this_month integer,
  candidate_view_limit integer,
  team_members_used integer,
  team_member_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employer_id uuid;
  v_plan text := 'free';
  v_month_start timestamptz := date_trunc('month', timezone('utc', now()));
begin
  select
    ctx.employer_id,
    lower(coalesce(ctx.plan, 'free'))
  into v_employer_id, v_plan
  from public.get_current_employer_context() as ctx
  limit 1;

  if v_employer_id is null then
    return;
  end if;

  return query
  with selected_plan as (
    select
      p.name,
      p.job_limit,
      p.user_limit,
      p.candidate_view_limit
    from public.plans p
    where lower(p.name) = v_plan
    limit 1
  ),
  active_jobs_count as (
    select count(*)::integer as value
    from public.jobs j
    where j.employer_id = v_employer_id
      and j.status = 'open'
  ),
  total_applicants_count as (
    select count(*)::integer as value
    from public.job_applications ja
    join public.jobs j on j.id = ja.job_id
    where j.employer_id = v_employer_id
  ),
  shortlisted_count as (
    select count(*)::integer as value
    from public.job_applications ja
    join public.jobs j on j.id = ja.job_id
    where j.employer_id = v_employer_id
      and ja.status = 'shortlisted'
  ),
  extra_job_slot_credit as (
    select coalesce(max(ec.remaining), 0)::integer as value
    from public.employer_credits ec
    where ec.employer_id = v_employer_id
      and ec.credit_type = 'job_slot'
  ),
  candidate_views_count as (
    select count(*)::integer as value
    from public.employer_credit_usage ecu
    where ecu.employer_id = v_employer_id
      and ecu.context_type = 'candidate_profile_view'
      and ecu.created_at >= v_month_start
  ),
  team_members_count as (
    select count(*)::integer as value
    from public.employer_memberships em
    where em.employer_id = v_employer_id
      and em.status in ('active', 'invited')
  )
  select
    coalesce(sp.name, v_plan) as plan_name,
    aj.value as active_jobs,
    ta.value as total_applicants,
    sl.value as shortlisted,
    case
      when sp.name is not null and sp.job_limit is null then null
      when sp.name is not null then sp.job_limit + ej.value
      when v_plan = 'starter' then 2 + ej.value
      when v_plan = 'professional' then 3 + ej.value
      when v_plan = 'enterprise' then 4 + ej.value
      else 1 + ej.value
    end as job_limit,
    ej.value as extra_job_slot_credits,
    cv.value as candidate_views_used_this_month,
    case
      when sp.name is not null and sp.candidate_view_limit is null then null
      when sp.name is not null then sp.candidate_view_limit
      when v_plan = 'starter' then 50
      when v_plan = 'professional' then 300
      when v_plan = 'enterprise' then 9999
      else 10
    end as candidate_view_limit,
    tm.value as team_members_used,
    case
      when sp.name is not null then sp.user_limit
      when v_plan = 'free' then 1
      else null
    end as team_member_limit
  from selected_plan sp
  right join active_jobs_count aj on true
  join total_applicants_count ta on true
  join shortlisted_count sl on true
  join extra_job_slot_credit ej on true
  join candidate_views_count cv on true
  join team_members_count tm on true;
end;
$$;

grant execute on function public.get_employer_dashboard_snapshot() to authenticated;
