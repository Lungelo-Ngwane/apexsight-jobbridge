-- Safe rollout for 30-day job visibility.
-- Phase 1: add fields + backfill only (no auto-close job).

alter table if exists public.jobs
  add column if not exists published_at timestamptz;

alter table if exists public.jobs
  add column if not exists expires_at timestamptz;

update public.jobs
set published_at = coalesce(published_at, created_at, now())
where published_at is null;

update public.jobs
set expires_at = coalesce(expires_at, coalesce(published_at, created_at, now()) + interval '30 days')
where expires_at is null;

alter table if exists public.jobs
  alter column published_at set default now();

alter table if exists public.jobs
  alter column expires_at set default (now() + interval '30 days');

create index if not exists jobs_status_expires_at_idx
  on public.jobs (status, expires_at desc);
