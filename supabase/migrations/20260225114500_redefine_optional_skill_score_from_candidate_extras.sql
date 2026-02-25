-- Redefine optional score to reward candidate skills outside required ones.
-- This aligns optional scoring with "extra skills candidate has beyond required".

create or replace function public.calculate_optional_skill_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with job_required as (
  select distinct skill_id
  from public.job_skills
  where job_id = p_job_id
    and required = true
    and skill_id is not null
),
candidate_extra as (
  select distinct
    coalesce(cs.skill_id::text, lower(trim(cs.skill))) as skill_key
  from public.candidate_skills cs
  where cs.candidate_profile_id = p_candidate_id
    and (
      cs.skill_id is null
      or cs.skill_id not in (select skill_id from job_required)
    )
    and coalesce(trim(cs.skill), '') <> ''
),
extra_count as (
  select count(*)::integer as total
  from candidate_extra
)
select coalesce(least(total * 4, 20), 0)::integer
from extra_count;
$$;

-- Recompute existing application scores/breakdowns using the new optional logic.
update public.job_applications
set job_id = job_id
where true;
