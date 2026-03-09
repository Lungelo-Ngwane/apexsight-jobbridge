create or replace function public.calculate_skill_proficiency_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with matched_skills as (
  select
    js.min_score,
    case cs.level
      when 'beginner' then 45
      when 'intermediate' then 65
      when 'advanced' then 85
      when 'expert' then 100
      else 55
    end as candidate_strength
  from public.job_skills js
  join public.candidate_skills cs
    on cs.skill_id = js.skill_id
  where js.job_id = p_job_id
    and cs.candidate_profile_id = p_candidate_id
),
weighted as (
  select
    case
      when coalesce(min_score, 0) <= 0 then least(candidate_strength::numeric / 85.0, 1.0)
      else least(candidate_strength::numeric / greatest(min_score, 1), 1.0)
    end as weight
  from matched_skills
)
select coalesce(least(round(coalesce(avg(weight), 0) * 15), 15), 0)::integer
from weighted;
$$;

update public.job_applications
set job_id = job_id
where true;
