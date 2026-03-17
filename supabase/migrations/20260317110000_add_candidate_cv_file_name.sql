alter table public.candidate_profiles
  add column if not exists cv_file_name text;
