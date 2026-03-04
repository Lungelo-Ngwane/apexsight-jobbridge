-- Intro trial rollout:
-- - First 5 employer profiles receive a 15-day trial
-- - Trial users are marked as subscription_status='trialing'
-- - Trial users receive paid access via plan='professional' during trial

alter table public.employer_profiles
add column if not exists trial_granted boolean not null default false;

alter table public.employer_profiles
add column if not exists trial_started_at timestamptz;

alter table public.employer_profiles
add column if not exists trial_ends_at timestamptz;

alter table public.employer_profiles
drop constraint if exists employer_subscription_status_check;

alter table public.employer_profiles
add constraint employer_subscription_status_check
check (
  subscription_status = any (
    array[
      'inactive'::text,
      'active'::text,
      'past_due'::text,
      'cancelled'::text,
      'trialing'::text
    ]
  )
);

create index if not exists employer_profiles_trial_ends_at_idx
  on public.employer_profiles (trial_ends_at)
  where subscription_status = 'trialing';

create or replace function public.is_employer_trial_active(
  p_trial_granted boolean,
  p_trial_started_at timestamptz,
  p_trial_ends_at timestamptz
)
returns boolean
language sql
stable
as $$
  select
    coalesce(p_trial_granted, false)
    and p_trial_started_at is not null
    and p_trial_ends_at is not null
    and now() >= p_trial_started_at
    and now() < p_trial_ends_at
$$;

create or replace function public.assign_intro_trial_to_first_employers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial_limit integer := 5;
  v_trial_days integer := 15;
  v_current_trial_count integer := 0;
begin
  if coalesce(new.trial_granted, false) then
    if new.trial_started_at is null then
      new.trial_started_at := now();
    end if;

    if new.trial_ends_at is null then
      new.trial_ends_at := new.trial_started_at + make_interval(days => v_trial_days);
    end if;

    if public.is_employer_trial_active(new.trial_granted, new.trial_started_at, new.trial_ends_at) then
      new.subscription_status := 'trialing';
      new.plan := 'professional';
    end if;

    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.assign_intro_trial_to_first_employers', 0));

  select count(*)::integer
  into v_current_trial_count
  from public.employer_profiles ep
  where ep.trial_granted = true;

  if v_current_trial_count < v_trial_limit then
    new.trial_granted := true;
    new.trial_started_at := coalesce(new.trial_started_at, now());
    new.trial_ends_at := coalesce(
      new.trial_ends_at,
      new.trial_started_at + make_interval(days => v_trial_days)
    );

    if public.is_employer_trial_active(new.trial_granted, new.trial_started_at, new.trial_ends_at) then
      new.subscription_status := 'trialing';
      new.plan := 'professional';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_intro_trial_to_first_employers on public.employer_profiles;
create trigger trg_assign_intro_trial_to_first_employers
before insert on public.employer_profiles
for each row
execute function public.assign_intro_trial_to_first_employers();

create or replace function public.expire_elapsed_employer_trials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update public.employer_profiles ep
  set
    subscription_status = 'inactive',
    plan = 'free'
  where ep.subscription_status = 'trialing'
    and ep.trial_granted = true
    and ep.trial_ends_at is not null
    and ep.trial_ends_at <= now();

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
