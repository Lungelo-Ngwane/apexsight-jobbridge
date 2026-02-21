-- Unify application scoring and AI matching integration.
-- Fixes null score_breakdown values and keeps ranking consistent.

drop function if exists public.calculate_skill_match(uuid, uuid);
drop function if exists public.calculate_required_skill_score(uuid, uuid);
drop function if exists public.calculate_optional_skill_score(uuid, uuid);
drop function if exists public.calculate_experience_score(uuid, uuid);
drop function if exists public.calculate_skill_proficiency_score(uuid, uuid);

create or replace function public.calculate_required_skill_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with job_req as (
  select distinct skill_id
  from public.job_skills
  where job_id = p_job_id
    and required = true
),
candidate_skills_dedup as (
  select distinct skill_id
  from public.candidate_skills
  where candidate_profile_id = p_candidate_id
),
matched_required as (
  select count(*)::numeric as matched
  from job_req jr
  join candidate_skills_dedup cs
    on cs.skill_id = jr.skill_id
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
  select distinct skill_id
  from public.job_skills
  where job_id = p_job_id
    and required = false
),
candidate_skills_dedup as (
  select distinct skill_id
  from public.candidate_skills
  where candidate_profile_id = p_candidate_id
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

create or replace function public.calculate_experience_score(
  p_job_id uuid,
  p_candidate_id uuid
)
returns integer
language sql
stable
as $$
with job_exp as (
  select experience_level::text as level
  from public.jobs
  where id = p_job_id
),
cand_exp as (
  select
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

create or replace function public.calculate_skill_match(
  p_job_id uuid,
  p_candidate_profile_id uuid
)
returns integer
language sql
stable
as $$
select least(
  coalesce(public.calculate_required_skill_score(p_job_id, p_candidate_profile_id), 0) +
  coalesce(public.calculate_optional_skill_score(p_job_id, p_candidate_profile_id), 0) +
  coalesce(public.calculate_skill_proficiency_score(p_job_id, p_candidate_profile_id), 0) +
  coalesce(public.calculate_experience_score(p_job_id, p_candidate_profile_id), 0),
  100
)::integer;
$$;

create or replace function public.refresh_job_application_rankings(
  p_job_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.job_applications ja
  set rank = ranked.rank
  from (
    select
      id,
      rank() over (
        partition by job_id
        order by score desc nulls last, created_at asc
      ) as rank
    from public.job_applications
    where job_id = p_job_id
  ) ranked
  where ja.id = ranked.id;
$$;

create or replace function public.apply_job_application_scoring()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required integer := 0;
  v_optional integer := 0;
  v_experience integer := 0;
  v_skill_level integer := 0;
  v_total integer := 0;
begin
  if new.job_id is null or new.candidate_profile_id is null then
    return new;
  end if;

  v_required := coalesce(public.calculate_required_skill_score(new.job_id, new.candidate_profile_id), 0);
  v_optional := coalesce(public.calculate_optional_skill_score(new.job_id, new.candidate_profile_id), 0);
  v_experience := coalesce(public.calculate_experience_score(new.job_id, new.candidate_profile_id), 0);
  v_skill_level := coalesce(public.calculate_skill_proficiency_score(new.job_id, new.candidate_profile_id), 0);

  v_total := least(v_required + v_optional + v_experience + v_skill_level, 100);

  new.score := v_total;
  new.score_breakdown := jsonb_build_object(
    'required', v_required,
    'optional', v_optional,
    'experience', v_experience,
    'skill_level', v_skill_level
  );

  new.match_label := case
    when v_total >= 90 then 'Elite'
    when v_total >= 75 then 'Strong'
    when v_total >= 60 then 'Good'
    when v_total >= 40 then 'Potential'
    else 'Weak'
  end;

  new.hiring_recommendation := case
    when v_total >= 75 then 'Interview Recommended'
    when v_total >= 50 then 'Consider'
    else 'Not Recommended'
  end;

  return new;
end;
$$;

create or replace function public.refresh_rank_after_job_application_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_job_application_rankings(old.job_id);
    return old;
  end if;

  perform public.refresh_job_application_rankings(new.job_id);
  return new;
end;
$$;

drop trigger if exists trg_apply_job_application_scoring on public.job_applications;
create trigger trg_apply_job_application_scoring
before insert or update of job_id, candidate_profile_id
on public.job_applications
for each row
execute function public.apply_job_application_scoring();

drop trigger if exists trg_refresh_job_application_rank_after_write on public.job_applications;
create trigger trg_refresh_job_application_rank_after_write
after insert or update of score, job_id, candidate_profile_id or delete
on public.job_applications
for each row
execute function public.refresh_rank_after_job_application_write();

-- Backfill current rows so score_breakdown/match labels are populated.
update public.job_applications
set job_id = job_id
where true;

-- AI + rule score integration for embedding-based matching.
create or replace function public.match_candidates_with_scores(
  p_job_id uuid,
  p_match_threshold double precision default 0.4,
  p_match_count integer default 20
)
returns table (
  id uuid,
  similarity double precision,
  skill_score integer,
  hybrid_score integer,
  match_label text,
  hiring_recommendation text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_job_embedding vector;
begin
  select j.embedding
  into v_job_embedding
  from public.jobs j
  where j.id = p_job_id;

  if v_job_embedding is null then
    raise exception 'Job embedding not found for job %', p_job_id;
  end if;

  return query
  with matched as (
    select
      m.id,
      m.similarity
    from public.match_candidates(
      job_embedding => v_job_embedding,
      match_threshold => p_match_threshold,
      match_count => p_match_count
    ) m
  ),
  scored as (
    select
      matched.id,
      matched.similarity,
      public.calculate_skill_match(p_job_id, matched.id) as skill_score
    from matched
  ),
  final_scores as (
    select
      scored.id,
      scored.similarity,
      scored.skill_score,
      least(
        100,
        greatest(
          0,
          round((scored.skill_score * 0.7) + ((scored.similarity * 100) * 0.3))
        )
      )::integer as hybrid_score
    from scored
  )
  select
    fs.id,
    fs.similarity,
    fs.skill_score,
    fs.hybrid_score,
    case
      when fs.hybrid_score >= 90 then 'Elite'
      when fs.hybrid_score >= 75 then 'Strong'
      when fs.hybrid_score >= 60 then 'Good'
      when fs.hybrid_score >= 40 then 'Potential'
      else 'Weak'
    end as match_label,
    case
      when fs.hybrid_score >= 75 then 'Interview Recommended'
      when fs.hybrid_score >= 50 then 'Consider'
      else 'Not Recommended'
    end as hiring_recommendation
  from final_scores fs
  order by fs.hybrid_score desc, fs.similarity desc;
end;
$$;
