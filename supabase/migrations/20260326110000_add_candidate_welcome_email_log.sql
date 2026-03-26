create table if not exists public.candidate_welcome_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  candidate_profile_id uuid null references public.candidate_profiles(id) on delete set null,
  email text null,
  full_name text null,
  triggered_by_user_id uuid null references auth.users(id) on delete set null,
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists candidate_welcome_emails_sent_at_idx
  on public.candidate_welcome_emails (sent_at desc);

alter table public.candidate_welcome_emails enable row level security;
