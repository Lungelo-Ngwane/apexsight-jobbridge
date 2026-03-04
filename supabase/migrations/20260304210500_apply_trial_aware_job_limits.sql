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
  v_trial_granted boolean := false;
  v_trial_started_at timestamptz;
  v_trial_ends_at timestamptz;
  v_trial_active boolean := false;
begin
  if new.employer_id is null then
    return new;
  end if;

  if coalesce(new.status, 'open') <> 'open' then
    return new;
  end if;

  select
    lower(coalesce(ep.plan, 'free')),
    coalesce(ep.trial_granted, false),
    ep.trial_started_at,
    ep.trial_ends_at
  into
    v_plan,
    v_trial_granted,
    v_trial_started_at,
    v_trial_ends_at
  from public.employer_profiles ep
  where ep.id = new.employer_id;

  if v_plan is null then
    v_plan := 'free';
  end if;

  v_trial_active := public.is_employer_trial_active(
    v_trial_granted,
    v_trial_started_at,
    v_trial_ends_at
  );

  if v_trial_active then
    v_plan := 'professional';
  end if;

  if v_plan = 'enterprise' then
    return new;
  end if;

  select p.job_limit
  into v_job_limit
  from public.plans p
  where lower(p.name) = v_plan
  limit 1;

  v_effective_limit := case
    when v_job_limit is not null and v_job_limit > 0 then v_job_limit
    when v_plan = 'starter' then 5
    when v_plan = 'professional' then 20
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
