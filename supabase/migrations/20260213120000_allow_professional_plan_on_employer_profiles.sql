alter table public.employer_profiles
drop constraint if exists employer_plan_check;

alter table public.employer_profiles
add constraint employer_plan_check
check (
  plan = any (array['free'::text, 'starter'::text, 'professional'::text, 'enterprise'::text])
);
