alter table if exists public.jobs
  add column if not exists work_mode text,
  add column if not exists department text,
  add column if not exists min_years_experience integer;

alter table if exists public.jobs
  drop constraint if exists jobs_min_years_experience_check;

alter table if exists public.jobs
  add constraint jobs_min_years_experience_check
  check (min_years_experience is null or (min_years_experience >= 0 and min_years_experience <= 50));
