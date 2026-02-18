alter table public.jobs
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_until timestamp with time zone null;

create table if not exists public.job_ai_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  report jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists job_ai_reports_job_id_created_at_idx
  on public.job_ai_reports (job_id, created_at desc);

create table if not exists public.employer_credit_usage (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  credit_type text not null,
  amount integer not null default 1,
  context_type text null,
  context_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);
