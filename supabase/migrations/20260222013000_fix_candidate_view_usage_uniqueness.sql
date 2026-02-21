drop index if exists public.employer_credit_usage_unique_candidate_view;
drop index if exists public.employer_credit_usage_unique_candidate_view_monthly;

alter table public.employer_credit_usage
  add column if not exists usage_month date;

update public.employer_credit_usage
set usage_month = date_trunc('month', created_at at time zone 'UTC')::date
where usage_month is null;

alter table public.employer_credit_usage
  alter column usage_month set not null;

with ranked as (
  select
    id,
    row_number() over (
      partition by employer_id, context_id, usage_month
      order by created_at asc, id asc
    ) as rn
  from public.employer_credit_usage
  where context_type = 'candidate_profile_view'
    and context_id is not null
)
delete from public.employer_credit_usage ecu
using ranked r
where ecu.id = r.id
  and r.rn > 1;

create or replace function public.set_employer_credit_usage_month()
returns trigger
language plpgsql
as $$
begin
  new.usage_month := date_trunc(
    'month',
    coalesce(new.created_at, now()) at time zone 'UTC'
  )::date;
  return new;
end;
$$;

drop trigger if exists trg_set_employer_credit_usage_month on public.employer_credit_usage;
create trigger trg_set_employer_credit_usage_month
before insert on public.employer_credit_usage
for each row
execute function public.set_employer_credit_usage_month();

create unique index if not exists employer_credit_usage_unique_candidate_view_monthly
  on public.employer_credit_usage (employer_id, context_id, usage_month)
  where context_type = 'candidate_profile_view'
    and context_id is not null;
