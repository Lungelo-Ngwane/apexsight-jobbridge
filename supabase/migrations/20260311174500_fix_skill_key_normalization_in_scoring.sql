create or replace function public.normalize_skill_key(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9+#]', '', 'g');
$$;

create or replace function public.calculate_required_skill_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with job_req as (
  select distinct
    js.skill_id,
    public.normalize_skill_key(s.name) as skill_key
  from public.job_skills js
  left join public.skills s on s.id = js.skill_id
  where js.job_id = p_job_id
    and js.required = true
),
candidate_skills_dedup as (
  select distinct
    cs.skill_id,
    public.normalize_skill_key(coalesce(s.name, cs.skill, '')) as skill_key
  from public.candidate_skills cs
  left join public.skills s on s.id = cs.skill_id
  where cs.candidate_profile_id = p_candidate_id
),
matched_required as (
  select count(*)::numeric as matched
  from job_req jr
  join candidate_skills_dedup cs
    on (
      jr.skill_id is not null
      and cs.skill_id = jr.skill_id
    )
    or (
      jr.skill_key <> ''
      and jr.skill_key = cs.skill_key
    )
),
total_required as (
  select count(*)::numeric as total
  from job_req
)
select coalesce(
  case
    when total = 0 then 50
    else least(round((matched / total) * 50), 50)
  end,
  0
)::integer
from matched_required, total_required;
$$;

create or replace function public.calculate_optional_skill_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with job_optional as (
  select distinct
    js.skill_id,
    public.normalize_skill_key(s.name) as skill_key
  from public.job_skills js
  left join public.skills s on s.id = js.skill_id
  where js.job_id = p_job_id
    and js.required = false
),
candidate_skills_dedup as (
  select distinct
    cs.skill_id,
    public.normalize_skill_key(coalesce(s.name, cs.skill, '')) as skill_key
  from public.candidate_skills cs
  left join public.skills s on s.id = cs.skill_id
  where cs.candidate_profile_id = p_candidate_id
),
matched_optional as (
  select count(*)::numeric as matched
  from job_optional jo
  join candidate_skills_dedup cs
    on (
      jo.skill_id is not null
      and cs.skill_id = jo.skill_id
    )
    or (
      jo.skill_key <> ''
      and jo.skill_key = cs.skill_key
    )
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

create or replace function public.calculate_skill_proficiency_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with job_skill_keys as (
  select distinct
    js.skill_id,
    js.min_score,
    public.normalize_skill_key(s.name) as skill_key
  from public.job_skills js
  left join public.skills s on s.id = js.skill_id
  where js.job_id = p_job_id
),
candidate_skill_keys as (
  select distinct
    cs.skill_id,
    cs.level,
    public.normalize_skill_key(coalesce(s.name, cs.skill, '')) as skill_key
  from public.candidate_skills cs
  left join public.skills s on s.id = cs.skill_id
  where cs.candidate_profile_id = p_candidate_id
),
matched_skills as (
  select
    js.min_score,
    case cs.level
      when 'beginner' then 45
      when 'intermediate' then 65
      when 'advanced' then 85
      when 'expert' then 100
      else 55
    end as candidate_strength
  from job_skill_keys js
  join candidate_skill_keys cs
    on (
      js.skill_id is not null
      and cs.skill_id = js.skill_id
    )
    or (
      js.skill_key <> ''
      and js.skill_key = cs.skill_key
    )
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

update public.candidate_skills cs
set skill_id = s.id
from public.skills s
where cs.skill_id is null
  and public.normalize_skill_key(cs.skill) = public.normalize_skill_key(s.name);

select public.recompute_job_application_scores();
