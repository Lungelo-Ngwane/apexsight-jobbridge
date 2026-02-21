do $$
begin
  if to_regclass('public.employer_credits') is not null then
    execute 'alter table public.employer_credits enable row level security';
    execute 'drop policy if exists "employer_credits_select_own" on public.employer_credits';
    execute '
      create policy "employer_credits_select_own"
      on public.employer_credits
      for select
      using (
        exists (
          select 1
          from public.employer_profiles ep
          where ep.id = employer_credits.employer_id
            and ep.user_id = auth.uid()
        )
      )
    ';
  end if;
end $$;

do $$
begin
  if to_regclass('public.employer_credit_usage') is not null then
    execute 'alter table public.employer_credit_usage enable row level security';
    execute 'drop policy if exists "employer_credit_usage_select_own" on public.employer_credit_usage';
    execute '
      create policy "employer_credit_usage_select_own"
      on public.employer_credit_usage
      for select
      using (
        exists (
          select 1
          from public.employer_profiles ep
          where ep.id = employer_credit_usage.employer_id
            and ep.user_id = auth.uid()
        )
      )
    ';
  end if;
end $$;

do $$
begin
  if to_regclass('public.employer_addon_purchases') is not null then
    execute 'alter table public.employer_addon_purchases enable row level security';
    execute 'drop policy if exists "employer_addon_purchases_select_own" on public.employer_addon_purchases';
    execute '
      create policy "employer_addon_purchases_select_own"
      on public.employer_addon_purchases
      for select
      using (
        exists (
          select 1
          from public.employer_profiles ep
          where ep.id = employer_addon_purchases.employer_id
            and ep.user_id = auth.uid()
        )
      )
    ';
  end if;
end $$;

do $$
begin
  if to_regclass('public.job_ai_reports') is not null then
    execute 'alter table public.job_ai_reports enable row level security';
    execute 'drop policy if exists "job_ai_reports_select_own" on public.job_ai_reports';
    execute '
      create policy "job_ai_reports_select_own"
      on public.job_ai_reports
      for select
      using (
        exists (
          select 1
          from public.employer_profiles ep
          where ep.id = job_ai_reports.employer_id
            and ep.user_id = auth.uid()
        )
      )
    ';
  end if;
end $$;

create or replace function public.enforce_premium_job_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated'
     and (
       new.is_featured is distinct from old.is_featured
       or new.featured_until is distinct from old.featured_until
     ) then
    raise exception 'FEATURED_JOB_REQUIRES_CREDIT'
      using errcode = 'P0001',
            detail = 'Use the feature-job edge function to set featured fields.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_premium_job_fields on public.jobs;
create trigger trg_enforce_premium_job_fields
before update on public.jobs
for each row
execute function public.enforce_premium_job_fields();
