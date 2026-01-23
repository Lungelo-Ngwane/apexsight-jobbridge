-- =========================
-- CLEAN RESET (SAFE ORDER)
-- =========================

drop table if exists public.applications cascade;
drop table if exists public.jobs cascade;

-- =========================
-- JOBS TABLE
-- =========================
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  location text,
  employment_type text,
  status text not null default 'open', -- open | closed | archived
  created_at timestamptz not null default now()
);

-- =========================
-- APPLICATIONS TABLE
-- =========================
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'applied', -- applied | shortlisted | rejected | hired
  created_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

-- =========================
-- ENABLE ROW LEVEL SECURITY
-- =========================
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

-- =========================
-- JOBS POLICIES
-- =========================

-- Employers create jobs
create policy "employers_insert_jobs"
on public.jobs
for insert
with check (employer_id = auth.uid());

-- Employers read own jobs
create policy "employers_select_jobs"
on public.jobs
for select
using (employer_id = auth.uid());

-- Employers update own jobs
create policy "employers_update_jobs"
on public.jobs
for update
using (employer_id = auth.uid());

-- =========================
-- APPLICATIONS POLICIES
-- =========================

-- Candidates apply to jobs
create policy "candidates_apply"
on public.applications
for insert
with check (candidate_id = auth.uid());

-- Employers read applications for their jobs
create policy "employers_view_applicants"
on public.applications
for select
using (
  job_id in (
    select id from public.jobs where employer_id = auth.uid()
  )
);

-- Employers update application status
create policy "employers_update_applicants"
on public.applications
for update
using (
  job_id in (
    select id from public.jobs where employer_id = auth.uid()
  )
);
