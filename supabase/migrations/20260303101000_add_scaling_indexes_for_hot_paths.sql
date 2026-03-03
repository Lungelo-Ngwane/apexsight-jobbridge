-- Performance indexes for high-traffic backend paths.
-- Focus: jobs, applications, skills joins, usage tracking, and plan lookups.

create index if not exists employer_profiles_user_id_idx
  on public.employer_profiles (user_id);

create index if not exists candidate_profiles_user_id_idx
  on public.candidate_profiles (user_id);

create index if not exists jobs_employer_status_created_at_idx
  on public.jobs (employer_id, status, created_at desc);

create index if not exists job_applications_job_status_score_created_at_idx
  on public.job_applications (job_id, status, score desc, created_at desc);

create index if not exists job_applications_candidate_profile_idx
  on public.job_applications (candidate_profile_id, created_at desc);

create index if not exists job_skills_job_required_skill_idx
  on public.job_skills (job_id, required, skill_id);

create index if not exists candidate_skills_candidate_skill_idx
  on public.candidate_skills (candidate_profile_id, skill_id);

create index if not exists candidate_skills_skill_candidate_idx
  on public.candidate_skills (skill_id, candidate_profile_id);

create index if not exists employer_credit_usage_employer_context_created_at_idx
  on public.employer_credit_usage (employer_id, context_type, created_at desc);

create index if not exists plans_name_lower_idx
  on public.plans (lower(name));
