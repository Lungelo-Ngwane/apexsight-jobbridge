alter table public.jobs
  add column if not exists salary_min integer,
  add column if not exists salary_max integer,
  add column if not exists benefits text;

alter table public.jobs
  drop constraint if exists jobs_salary_min_check,
  drop constraint if exists jobs_salary_max_check,
  drop constraint if exists jobs_salary_range_check;

alter table public.jobs
  add constraint jobs_salary_min_check
  check (salary_min is null or salary_min >= 0);

alter table public.jobs
  add constraint jobs_salary_max_check
  check (salary_max is null or salary_max >= 0);

alter table public.jobs
  add constraint jobs_salary_range_check
  check (
    salary_min is null
    or salary_max is null
    or salary_max >= salary_min
  );
