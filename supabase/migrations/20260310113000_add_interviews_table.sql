create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  job_application_id uuid not null references public.job_applications(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  stage text not null default 'screening'
    check (stage in ('screening', 'technical', 'final')),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30
    check (duration_minutes between 15 and 240),
  timezone text not null default 'Africa/Johannesburg',
  mode text not null default 'virtual'
    check (mode in ('virtual', 'phone', 'onsite')),
  location_or_meeting_link text null,
  notes text null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  created_by uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists interviews_candidate_scheduled_at_idx
  on public.interviews (candidate_profile_id, scheduled_at asc);

create index if not exists interviews_employer_scheduled_at_idx
  on public.interviews (employer_id, scheduled_at asc);

create index if not exists interviews_job_application_idx
  on public.interviews (job_application_id);

create or replace function public.set_updated_at_interviews()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_interviews_set_updated_at on public.interviews;
create trigger trg_interviews_set_updated_at
before update on public.interviews
for each row
execute function public.set_updated_at_interviews();

alter table public.interviews enable row level security;

drop policy if exists interviews_select_candidate_own on public.interviews;
create policy interviews_select_candidate_own
on public.interviews
for select
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = interviews.candidate_profile_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists interviews_select_employer_own on public.interviews;
create policy interviews_select_employer_own
on public.interviews
for select
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = interviews.employer_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists interviews_insert_employer_own on public.interviews;
create policy interviews_insert_employer_own
on public.interviews
for insert
with check (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = interviews.employer_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists interviews_update_employer_own on public.interviews;
create policy interviews_update_employer_own
on public.interviews
for update
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = interviews.employer_id
      and ep.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = interviews.employer_id
      and ep.user_id = auth.uid()
  )
);
