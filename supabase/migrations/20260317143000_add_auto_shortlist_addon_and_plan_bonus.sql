-- Add the auto-shortlist add-on and once-off starter/professional bonus credits.

alter table public.employer_profiles
add column if not exists starter_auto_shortlist_bonus_granted boolean not null default false;

alter table public.employer_profiles
add column if not exists professional_auto_shortlist_bonus_granted boolean not null default false;

do $$
begin
  if exists (
    select 1
    from public.addons
    where lower(trim(type)) = 'auto_shortlist'
  ) then
    update public.addons
    set
      name = 'Auto Shortlisting',
      price = 39900,
      credits = 10,
      active = true
    where lower(trim(type)) = 'auto_shortlist';
  else
    insert into public.addons (
      name,
      price,
      type,
      credits,
      active
    )
    values (
      'Auto Shortlisting',
      39900,
      'auto_shortlist',
      10,
      true
    );
  end if;
end
$$;

create or replace function public.grant_auto_shortlist_plan_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.subscription_status, 'inactive')) <> 'active' then
    return new;
  end if;

  if lower(coalesce(new.plan, 'free')) = 'starter'
    and coalesce(new.starter_auto_shortlist_bonus_granted, false) = false then
    insert into public.employer_credits (
      employer_id,
      credit_type,
      remaining
    )
    values (
      new.id,
      'auto_shortlist',
      2
    )
    on conflict (employer_id, credit_type)
    do update
    set remaining = public.employer_credits.remaining + excluded.remaining;

    new.starter_auto_shortlist_bonus_granted := true;
  end if;

  if lower(coalesce(new.plan, 'free')) = 'professional'
    and coalesce(new.professional_auto_shortlist_bonus_granted, false) = false then
    insert into public.employer_credits (
      employer_id,
      credit_type,
      remaining
    )
    values (
      new.id,
      'auto_shortlist',
      4
    )
    on conflict (employer_id, credit_type)
    do update
    set remaining = public.employer_credits.remaining + excluded.remaining;

    new.professional_auto_shortlist_bonus_granted := true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grant_auto_shortlist_plan_bonus on public.employer_profiles;

create trigger trg_grant_auto_shortlist_plan_bonus
before insert or update of plan, subscription_status
on public.employer_profiles
for each row
execute function public.grant_auto_shortlist_plan_bonus();

update public.employer_profiles
set subscription_status = subscription_status
where lower(coalesce(subscription_status, 'inactive')) = 'active'
  and (
    (
      lower(coalesce(plan, 'free')) = 'starter'
      and coalesce(starter_auto_shortlist_bonus_granted, false) = false
    )
    or (
      lower(coalesce(plan, 'free')) = 'professional'
      and coalesce(professional_auto_shortlist_bonus_granted, false) = false
    )
  );
