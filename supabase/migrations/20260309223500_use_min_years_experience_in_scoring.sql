create or replace function public.calculate_experience_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with job_exp as (
  select
    experience_level::text as level,
    min_years_experience
  from public.jobs
  where id = p_job_id
),
cand_exp as (
  select
    coalesce(years_experience, 0) as years_experience,
    case
      when coalesce(years_experience, 0) < 2 then 'junior'
      when coalesce(years_experience, 0) < 5 then 'mid'
      else 'senior'
    end as level
  from public.candidate_profiles
  where id = p_candidate_id
)
select coalesce(
  case
    when job_exp.min_years_experience is not null and cand_exp.years_experience >= job_exp.min_years_experience then 15
    when job_exp.min_years_experience is not null and cand_exp.years_experience >= greatest(job_exp.min_years_experience - 2, 0) then 10
    when job_exp.min_years_experience is not null then 0
    when job_exp.level = cand_exp.level then 15
    when (
      job_exp.level = 'mid'
      and cand_exp.level in ('junior', 'senior')
    ) or (
      job_exp.level = 'junior'
      and cand_exp.level = 'mid'
    ) or (
      job_exp.level = 'senior'
      and cand_exp.level = 'mid'
    ) then 8
    else 0
  end,
  0
)::integer
from job_exp, cand_exp;
$$;

update public.job_applications
set job_id = job_id
where true;
