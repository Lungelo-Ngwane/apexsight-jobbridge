create table if not exists public.employer_addon_purchases (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete restrict,
  reference text not null unique,
  amount_paid integer not null default 0,
  status text not null default 'success',
  credits_added integer not null default 0,
  created_at timestamp with time zone not null default now()
);

with ranked as (
  select
    id,
    employer_id,
    credit_type,
    coalesce(remaining, 0) as remaining,
    row_number() over (
      partition by employer_id, credit_type
      order by created_at asc, id::text asc
    ) as rn
  from public.employer_credits
),
merged as (
  select
    employer_id,
    credit_type,
    sum(remaining)::integer as total_remaining
  from ranked
  group by employer_id, credit_type
),
keepers as (
  select distinct on (employer_id, credit_type)
    employer_id,
    credit_type,
    id as keep_id
  from ranked
  order by employer_id, credit_type, rn asc
),
to_update as (
  select
    m.employer_id,
    m.credit_type,
    m.total_remaining,
    k.keep_id
  from merged m
  join keepers k
    on k.employer_id = m.employer_id
   and k.credit_type = m.credit_type
),
updated as (
  update public.employer_credits ec
  set remaining = u.total_remaining
  from to_update u
  where ec.id = u.keep_id
  returning ec.id
)
delete from public.employer_credits ec
using ranked r
where ec.id = r.id
  and r.rn > 1;

create unique index if not exists employer_credits_employer_credit_type_unique
  on public.employer_credits (employer_id, credit_type);
