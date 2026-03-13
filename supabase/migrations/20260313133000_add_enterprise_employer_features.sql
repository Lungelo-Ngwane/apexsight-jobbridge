alter table public.employer_profiles
add column if not exists enterprise_account_manager_name text;

alter table public.employer_profiles
add column if not exists enterprise_account_manager_email text;

alter table public.employer_profiles
add column if not exists white_label_enabled boolean not null default false;

alter table public.employer_profiles
add column if not exists brand_primary_color text;

alter table public.employer_profiles
add column if not exists custom_domain text;

alter table public.employer_profiles
add column if not exists careers_page_headline text;

alter table public.employer_profiles
add column if not exists sla_tier text;

alter table public.employer_profiles
add column if not exists sla_uptime_target text;

alter table public.employer_profiles
add column if not exists sla_response_time_hours integer;

create table if not exists public.employer_integration_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'requested',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint employer_integration_requests_status_check
    check (status in ('requested', 'planned', 'in_progress', 'completed', 'declined'))
);

create index if not exists employer_integration_requests_employer_idx
  on public.employer_integration_requests (employer_id, created_at desc);

create or replace function public.set_updated_at_employer_integration_requests()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_employer_integration_requests_set_updated_at on public.employer_integration_requests;
create trigger trg_employer_integration_requests_set_updated_at
before update on public.employer_integration_requests
for each row
execute function public.set_updated_at_employer_integration_requests();

alter table public.employer_integration_requests enable row level security;

drop policy if exists employer_integration_requests_select_workspace on public.employer_integration_requests;
create policy employer_integration_requests_select_workspace
on public.employer_integration_requests
for select
to authenticated
using (public.is_employer_member(employer_id));

drop policy if exists employer_integration_requests_insert_admin on public.employer_integration_requests;
create policy employer_integration_requests_insert_admin
on public.employer_integration_requests
for insert
to authenticated
with check (
  public.is_employer_member(employer_id, array['owner', 'admin'])
  and created_by = auth.uid()
);

drop policy if exists employer_integration_requests_update_admin on public.employer_integration_requests;
create policy employer_integration_requests_update_admin
on public.employer_integration_requests
for update
to authenticated
using (public.is_employer_member(employer_id, array['owner', 'admin']))
with check (public.is_employer_member(employer_id, array['owner', 'admin']));
