-- Remove employer trial support and normalize existing trial records.

update public.employer_profiles
set
  selected_plan = case
    when selected_plan is null and lower(coalesce(plan, 'free')) in ('starter', 'professional', 'enterprise')
      then lower(plan)
    else selected_plan
  end,
  plan = 'free',
  subscription_status = 'inactive',
  trial_granted = false,
  trial_started_at = null,
  trial_ends_at = null
where
  coalesce(trial_granted, false) = true
  or lower(coalesce(subscription_status, 'inactive')) = 'trialing';

create or replace function public.is_employer_trial_active(
  p_trial_granted boolean,
  p_trial_started_at timestamptz,
  p_trial_ends_at timestamptz
)
returns boolean
language sql
stable
as $$
  select false;
$$;

create or replace function public.assign_intro_trial_to_first_employers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.trial_granted := false;
  new.trial_started_at := null;
  new.trial_ends_at := null;

  if lower(coalesce(new.subscription_status, 'inactive')) = 'trialing' then
    new.subscription_status := 'inactive';
  end if;

  if lower(coalesce(new.plan, 'free')) not in ('starter', 'professional', 'enterprise') then
    new.plan := 'free';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_intro_trial_to_first_employers on public.employer_profiles;

create or replace function public.expire_elapsed_employer_trials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return 0;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'expire-employer-trials-daily';
  end if;
exception
  when undefined_function or invalid_schema_name then
    null;
end
$$;

create or replace function public.enforce_job_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_open_jobs integer;
  v_job_limit integer;
  v_effective_limit integer;
  v_credit_id uuid;
begin
  if new.employer_id is null then
    return new;
  end if;

  if coalesce(new.status, 'open') <> 'open' then
    return new;
  end if;

  select lower(coalesce(ep.plan, 'free'))
  into v_plan
  from public.employer_profiles ep
  where ep.id = new.employer_id;

  if v_plan is null then
    v_plan := 'free';
  end if;

  select p.job_limit
  into v_job_limit
  from public.plans p
  where lower(p.name) = v_plan
  limit 1;

  v_effective_limit := case
    when v_job_limit is not null and v_job_limit > 0 then v_job_limit
    when v_plan = 'enterprise' then 4
    when v_plan = 'professional' then 3
    when v_plan = 'starter' then 2
    else 1
  end;

  select count(*)::integer
  into v_open_jobs
  from public.jobs j
  where j.employer_id = new.employer_id
    and j.status = 'open'
    and (tg_op <> 'UPDATE' or j.id <> new.id);

  if v_open_jobs >= v_effective_limit then
    update public.employer_credits ec
    set remaining = ec.remaining - 1
    where ec.employer_id = new.employer_id
      and ec.credit_type = 'job_slot'
      and ec.remaining > 0
    returning ec.id into v_credit_id;

    if v_credit_id is null then
      raise exception 'PLAN_LIMIT_REACHED'
        using errcode = 'P0001',
              detail = format('Plan %s allows %s open jobs and no job_slot credits are available.', v_plan, v_effective_limit);
    end if;

    insert into public.employer_credit_usage (
      employer_id,
      credit_type,
      amount,
      context_type,
      context_id,
      metadata
    )
    values (
      new.employer_id,
      'job_slot',
      1,
      'job',
      new.id,
      jsonb_build_object(
        'reason', 'plan_limit_overflow',
        'plan', v_plan,
        'limit', v_effective_limit
      )
    );
  end if;

  return new;
end;
$$;
