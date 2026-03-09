create or replace function public.calculate_optional_skill_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with job_optional as (
  select distinct skill_id
  from public.job_skills
  where job_id = p_job_id
    and required = false
    and skill_id is not null
),
candidate_skills_dedup as (
  select distinct skill_id
  from public.candidate_skills
  where candidate_profile_id = p_candidate_id
    and skill_id is not null
),
matched_optional as (
  select count(*)::numeric as matched
  from job_optional jo
  join candidate_skills_dedup cs
    on cs.skill_id = jo.skill_id
),
total_optional as (
  select count(*)::numeric as total
  from job_optional
)
select coalesce(
  case
    when total = 0 then 0
    else least(round((matched / total) * 20), 20)
  end,
  0
)::integer
from matched_optional, total_optional;
$$;

update public.job_applications
set job_id = job_id
where true;
