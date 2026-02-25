-- Adds fields used by AI resume parsing and enriched matching context.

alter table if exists public.candidate_profiles
  add column if not exists resume_text text,
  add column if not exists resume_summary text,
  add column if not exists professional_bio_ai text,
  add column if not exists resume_analysis jsonb not null default '{}'::jsonb,
  add column if not exists resume_last_analyzed_at timestamptz;
