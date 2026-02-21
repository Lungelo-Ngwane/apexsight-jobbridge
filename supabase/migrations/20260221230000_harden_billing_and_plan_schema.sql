-- Harden billing and plan-related schema based on current production model.

-- 1) Enforce integrity on employer_credits (currently nullable in schema dump).
alter table public.employer_credits
  alter column employer_id set not null,
  alter column credit_type set not null,
  alter column remaining set not null,
  alter column remaining set default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employer_credits_employer_id_fkey'
      and conrelid = 'public.employer_credits'::regclass
  ) then
    alter table public.employer_credits
      add constraint employer_credits_employer_id_fkey
      foreign key (employer_id)
      references public.employer_profiles(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employer_credits_remaining_non_negative'
      and conrelid = 'public.employer_credits'::regclass
  ) then
    alter table public.employer_credits
      add constraint employer_credits_remaining_non_negative
      check (remaining >= 0);
  end if;
end $$;

create unique index if not exists employer_credits_employer_credit_type_unique
  on public.employer_credits (employer_id, credit_type);

-- 2) Add missing foreign keys for linkage tables.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_skills_job_id_fkey'
      and conrelid = 'public.job_skills'::regclass
  ) then
    alter table public.job_skills
      add constraint job_skills_job_id_fkey
      foreign key (job_id)
      references public.jobs(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_matches_job_id_fkey'
      and conrelid = 'public.job_matches'::regclass
  ) then
    alter table public.job_matches
      add constraint job_matches_job_id_fkey
      foreign key (job_id)
      references public.jobs(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_matches_candidate_id_fkey'
      and conrelid = 'public.job_matches'::regclass
  ) then
    alter table public.job_matches
      add constraint job_matches_candidate_id_fkey
      foreign key (candidate_id)
      references public.candidate_profiles(id)
      on delete cascade;
  end if;
end $$;

-- 3) Protect against duplicate usage records for the same unlock target.
with ranked as (
  select
    id,
    row_number() over (
      partition by employer_id, context_id
      order by created_at asc, id asc
    ) as rn
  from public.employer_credit_usage
  where context_type = 'candidate_profile_view'
    and context_id is not null
)
delete from public.employer_credit_usage u
using ranked r
where u.id = r.id
  and r.rn > 1;

create unique index if not exists employer_credit_usage_unique_candidate_view
  on public.employer_credit_usage (employer_id, context_id)
  where context_type = 'candidate_profile_view';

-- 4) Useful billing uniqueness guarantees.
create unique index if not exists billing_invoices_invoice_number_key
  on public.billing_invoices (invoice_number);

create unique index if not exists billing_invoices_provider_reference_kind_key
  on public.billing_invoices (provider, provider_reference, kind)
  where provider_reference is not null;
