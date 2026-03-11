create or replace function public.recompute_job_application_scores(
  p_job_id uuid default null,
  p_candidate_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  for v_job_id in
    with computed as (
      select
        ja.id,
        ja.job_id,
        coalesce(public.calculate_required_skill_score(ja.job_id, ja.candidate_profile_id), 0) as required_score,
        coalesce(public.calculate_optional_skill_score(ja.job_id, ja.candidate_profile_id), 0) as optional_score,
        coalesce(public.calculate_experience_score(ja.job_id, ja.candidate_profile_id), 0) as experience_score,
        coalesce(public.calculate_skill_proficiency_score(ja.job_id, ja.candidate_profile_id), 0) as skill_level_score
      from public.job_applications ja
      where (p_job_id is null or ja.job_id = p_job_id)
        and (p_candidate_profile_id is null or ja.candidate_profile_id = p_candidate_profile_id)
    ),
    updated as (
      update public.job_applications ja
      set
        score = least(
          computed.required_score +
          computed.optional_score +
          computed.experience_score +
          computed.skill_level_score,
          100
        ),
        score_breakdown = jsonb_build_object(
          'required', computed.required_score,
          'optional', computed.optional_score,
          'experience', computed.experience_score,
          'skill_level', computed.skill_level_score
        ),
        match_label = case
          when least(
            computed.required_score +
            computed.optional_score +
            computed.experience_score +
            computed.skill_level_score,
            100
          ) >= 90 then 'Elite'
          when least(
            computed.required_score +
            computed.optional_score +
            computed.experience_score +
            computed.skill_level_score,
            100
          ) >= 75 then 'Strong'
          when least(
            computed.required_score +
            computed.optional_score +
            computed.experience_score +
            computed.skill_level_score,
            100
          ) >= 60 then 'Good'
          when least(
            computed.required_score +
            computed.optional_score +
            computed.experience_score +
            computed.skill_level_score,
            100
          ) >= 40 then 'Potential'
          else 'Weak'
        end,
        hiring_recommendation = case
          when least(
            computed.required_score +
            computed.optional_score +
            computed.experience_score +
            computed.skill_level_score,
            100
          ) >= 75 then 'Interview Recommended'
          when least(
            computed.required_score +
            computed.optional_score +
            computed.experience_score +
            computed.skill_level_score,
            100
          ) >= 50 then 'Consider'
          else 'Not Recommended'
        end
      from computed
      where ja.id = computed.id
      returning ja.job_id
    )
    select distinct job_id
    from updated
  loop
    perform public.refresh_job_application_rankings(v_job_id);
  end loop;
end;
$$;

create or replace function public.recompute_candidate_application_scores(
  p_candidate_profile_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  select public.recompute_job_application_scores(null, p_candidate_profile_id);
$$;

create or replace function public.on_candidate_skill_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_candidate_application_scores(old.candidate_profile_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.candidate_profile_id is distinct from new.candidate_profile_id then
    perform public.recompute_candidate_application_scores(old.candidate_profile_id);
  end if;

  perform public.recompute_candidate_application_scores(new.candidate_profile_id);
  return new;
end;
$$;

create or replace function public.recompute_scores_for_job(
  p_job_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  select public.recompute_job_application_scores(p_job_id, null);
$$;

create or replace function public.on_job_skill_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_scores_for_job(old.job_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.job_id is distinct from new.job_id then
    perform public.recompute_scores_for_job(old.job_id);
  end if;

  perform public.recompute_scores_for_job(new.job_id);
  return new;
end;
$$;

drop trigger if exists trg_recompute_scores_on_job_skill on public.job_skills;
create trigger trg_recompute_scores_on_job_skill
after insert or update or delete
on public.job_skills
for each row
execute function public.on_job_skill_changed();

create or replace function public.on_job_scoring_fields_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_scores_for_job(new.id);
  return new;
end;
$$;

drop trigger if exists trg_recompute_scores_on_job on public.jobs;
create trigger trg_recompute_scores_on_job
after update of experience_level, min_years_experience
on public.jobs
for each row
when (
  old.experience_level is distinct from new.experience_level
  or old.min_years_experience is distinct from new.min_years_experience
)
execute function public.on_job_scoring_fields_changed();

select public.recompute_job_application_scores();
