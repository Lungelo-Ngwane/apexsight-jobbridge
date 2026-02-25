-- Recompute application scores when candidate skill/experience data changes.

create or replace function public.recompute_candidate_application_scores(
  p_candidate_profile_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.job_applications
  set job_id = job_id
  where candidate_profile_id = p_candidate_profile_id;
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

  perform public.recompute_candidate_application_scores(new.candidate_profile_id);
  return new;
end;
$$;

drop trigger if exists trg_recompute_scores_on_candidate_skill on public.candidate_skills;
create trigger trg_recompute_scores_on_candidate_skill
after insert or update or delete
on public.candidate_skills
for each row
execute function public.on_candidate_skill_changed();

create or replace function public.on_candidate_profile_scoring_fields_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_candidate_application_scores(new.id);
  return new;
end;
$$;

drop trigger if exists trg_recompute_scores_on_candidate_profile on public.candidate_profiles;
create trigger trg_recompute_scores_on_candidate_profile
after update of years_experience, experience_level
on public.candidate_profiles
for each row
when (
  old.years_experience is distinct from new.years_experience
  or old.experience_level is distinct from new.experience_level
)
execute function public.on_candidate_profile_scoring_fields_changed();
