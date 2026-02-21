create unique index if not exists job_matches_job_candidate_unique
  on public.job_matches (job_id, candidate_id)
  where job_id is not null and candidate_id is not null;
