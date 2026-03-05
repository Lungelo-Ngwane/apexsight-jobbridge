-- Correct legacy job visibility dates where a prior rollout reset published_at/expires_at.
-- For jobs created before the rollout date that still carry the reset window,
-- restore published_at from created_at and recompute expires_at as +30 days.

update public.jobs
set
  published_at = created_at,
  expires_at = created_at + interval '30 days'
where created_at < timestamptz '2026-03-05 00:00:00+00'
  and published_at >= timestamptz '2026-03-05 00:00:00+00'
  and expires_at >= timestamptz '2026-04-04 00:00:00+00';
