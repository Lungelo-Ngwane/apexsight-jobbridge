-- JOBS TABLE
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  location text,
  employment_type text,
  status text default 'open',
  created_at timestamp with time zone default now()
);

-- APPLICATIONS TABLE
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  status text default 'applied',
  created_at timestamp with time zone default now()
);
