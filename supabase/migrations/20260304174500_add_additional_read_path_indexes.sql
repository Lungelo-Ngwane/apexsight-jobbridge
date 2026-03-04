-- Additional indexes for read-heavy UI/API paths that are not fully covered
-- by existing indexes.

-- Candidate jobs feed: status filter + featured + recency sort.
create index if not exists jobs_open_featured_created_at_idx
  on public.jobs (status, is_featured desc, created_at desc)
  where status = 'open';

-- Employer jobs listing: employer filter + recency sort (without status filter).
create index if not exists jobs_employer_created_at_idx
  on public.jobs (employer_id, created_at desc);

-- Job applicants listing: job filter + score/recency sort.
create index if not exists job_applications_job_score_created_at_idx
  on public.job_applications (job_id, score desc, created_at desc);

-- Messaging unread counts and read updates.
create index if not exists messages_conversation_sender_unread_idx
  on public.messages (conversation_id, sender_role, created_at desc)
  where read_at is null;

create index if not exists messages_unread_by_conversation_sender_user_idx
  on public.messages (conversation_id, sender_user_id)
  where read_at is null;
