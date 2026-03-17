delete from public.job_matches
where job_id is null
   or candidate_id is null;

delete from public.job_matches jm
using public.job_matches newer
where jm.job_id = newer.job_id
  and jm.candidate_id = newer.candidate_id
  and (
    jm.created_at < newer.created_at
    or (jm.created_at = newer.created_at and jm.id < newer.id)
  );

alter table public.job_matches
  alter column job_id set not null,
  alter column candidate_id set not null;

drop index if exists public.job_matches_job_candidate_unique;

create unique index if not exists job_matches_job_candidate_unique
  on public.job_matches (job_id, candidate_id);
