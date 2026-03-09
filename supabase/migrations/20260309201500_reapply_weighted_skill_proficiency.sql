create or replace function public.calculate_skill_proficiency_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with matched_skills as (
  select cs.level
  from public.job_skills js
  join public.candidate_skills cs
    on cs.skill_id = js.skill_id
  where js.job_id = p_job_id
    and cs.candidate_profile_id = p_candidate_id
),
weighted as (
  select
    case level
      when 'beginner' then 0.5
      when 'intermediate' then 0.8
      when 'advanced' then 1.0
      when 'expert' then 1.0
      else 0.5
    end as weight
  from matched_skills
)
select coalesce(least(round(coalesce(avg(weight), 0) * 15), 15), 0)::integer
from weighted;
$$;

update public.job_applications
set job_id = job_id
where true;
