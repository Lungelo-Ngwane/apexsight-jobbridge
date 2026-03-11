create table if not exists public.employer_memberships (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  role text not null default 'recruiter'
    check (role in ('owner', 'admin', 'recruiter')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'revoked')),
  invited_by uuid null references auth.users(id) on delete set null,
  accepted_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists employer_memberships_employer_user_unique
  on public.employer_memberships (employer_id, user_id)
  where user_id is not null;

create unique index if not exists employer_memberships_employer_email_unique
  on public.employer_memberships (employer_id, email_normalized);

create index if not exists employer_memberships_user_idx
  on public.employer_memberships (user_id, status, created_at desc);

create or replace function public.set_updated_at_employer_memberships()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_employer_memberships_set_updated_at on public.employer_memberships;
create trigger trg_employer_memberships_set_updated_at
before update on public.employer_memberships
for each row
execute function public.set_updated_at_employer_memberships();

create or replace function public.get_plan_user_limit(p_plan text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text := lower(coalesce(trim(p_plan), 'free'));
  v_limit integer;
begin
  select p.user_limit
  into v_limit
  from public.plans p
  where lower(p.name) = v_plan
  limit 1;

  if v_limit is not null then
    return v_limit;
  end if;

  if v_plan = 'starter' then
    return 2;
  end if;

  if v_plan = 'professional' then
    return 5;
  end if;

  if v_plan = 'enterprise' then
    return null;
  end if;

  return 1;
end;
$$;

create or replace function public.is_employer_member(
  p_employer_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employer_memberships em
    where em.employer_id = p_employer_id
      and em.user_id = auth.uid()
      and em.status = 'active'
      and (
        p_roles is null
        or array_length(p_roles, 1) is null
        or em.role = any (p_roles)
      )
  );
$$;

create or replace function public.claim_pending_employer_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_claimed integer := 0;
begin
  if v_auth_user_id is null or v_email = '' then
    return 0;
  end if;

  with claimable as (
    select em.id
    from public.employer_memberships em
    where em.user_id is null
      and em.status = 'invited'
      and em.email_normalized = v_email
    order by em.created_at asc
  )
  update public.employer_memberships em
  set
    user_id = v_auth_user_id,
    status = 'active',
    accepted_at = coalesce(em.accepted_at, timezone('utc', now()))
  from claimable
  where em.id = claimable.id;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

create or replace function public.get_current_employer_context()
returns table (
  employer_id uuid,
  membership_id uuid,
  membership_role text,
  membership_status text,
  company_name text,
  plan text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
begin
  if v_auth_user_id is null then
    return;
  end if;

  perform public.claim_pending_employer_invites();

  return query
  select
    ep.id,
    em.id,
    em.role,
    em.status,
    ep.company_name,
    ep.plan
  from public.employer_memberships em
  join public.employer_profiles ep on ep.id = em.employer_id
  where em.user_id = v_auth_user_id
    and em.status = 'active'
  order by
    case em.role
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    em.created_at asc
  limit 1;
end;
$$;

create or replace function public.get_current_employer_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employer_id
  from public.get_current_employer_context()
  limit 1
$$;

create or replace function public.ensure_owner_membership_for_employer_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.employer_memberships (
    employer_id,
    user_id,
    email,
    role,
    status,
    invited_by,
    accepted_at
  )
  values (
    new.id,
    new.user_id,
    coalesce(
      (
        select au.email
        from auth.users au
        where au.id = new.user_id
        limit 1
      ),
      new.contact_email,
      new.user_id::text || '@placeholder.local'
    ),
    'owner',
    'active',
    new.user_id,
    timezone('utc', now())
  )
  on conflict (employer_id, email_normalized)
  do update set
    user_id = excluded.user_id,
    role = 'owner',
    status = 'active',
    accepted_at = coalesce(public.employer_memberships.accepted_at, excluded.accepted_at);

  return new;
end;
$$;

drop trigger if exists trg_ensure_owner_membership_for_employer_profile on public.employer_profiles;
create trigger trg_ensure_owner_membership_for_employer_profile
after insert on public.employer_profiles
for each row
execute function public.ensure_owner_membership_for_employer_profile();

insert into public.employer_memberships (
  employer_id,
  user_id,
  email,
  role,
  status,
  invited_by,
  accepted_at
)
select
  ep.id,
  ep.user_id,
  coalesce(
    (
      select au.email
      from auth.users au
      where au.id = ep.user_id
      limit 1
    ),
    ep.contact_email,
    ep.user_id::text || '@placeholder.local'
  ),
  'owner',
  'active',
  ep.user_id,
  timezone('utc', now())
from public.employer_profiles ep
on conflict (employer_id, email_normalized)
do update set
  user_id = excluded.user_id,
  role = 'owner',
  status = 'active',
  accepted_at = coalesce(public.employer_memberships.accepted_at, excluded.accepted_at);

create or replace function public.enforce_employer_membership_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limit integer;
  v_used integer;
begin
  if new.status not in ('active', 'invited') then
    return new;
  end if;

  select ep.plan
  into v_plan
  from public.employer_profiles ep
  where ep.id = new.employer_id;

  v_limit := public.get_plan_user_limit(v_plan);

  if v_limit is null then
    return new;
  end if;

  select count(*)::integer
  into v_used
  from public.employer_memberships em
  where em.employer_id = new.employer_id
    and em.status in ('active', 'invited')
    and (tg_op <> 'UPDATE' or em.id <> new.id);

  if v_used >= v_limit then
    raise exception 'TEAM_MEMBER_LIMIT_REACHED'
      using errcode = 'P0001',
            detail = format('This plan supports up to %s team member(s).', v_limit);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_employer_membership_seat_limit on public.employer_memberships;
create trigger trg_enforce_employer_membership_seat_limit
before insert or update of status, employer_id on public.employer_memberships
for each row
execute function public.enforce_employer_membership_seat_limit();

alter table public.employer_memberships enable row level security;

drop policy if exists employer_memberships_select_member_workspace on public.employer_memberships;
create policy employer_memberships_select_member_workspace
on public.employer_memberships
for select
to authenticated
using (
  public.is_employer_member(employer_id)
  or (
    user_id is null
    and status = 'invited'
    and email_normalized = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

drop policy if exists employer_memberships_insert_admin on public.employer_memberships;
create policy employer_memberships_insert_admin
on public.employer_memberships
for insert
to authenticated
with check (
  public.is_employer_member(employer_id, array['owner', 'admin'])
  and role in ('admin', 'recruiter')
  and status in ('invited', 'active', 'revoked')
);

drop policy if exists employer_memberships_update_admin on public.employer_memberships;
create policy employer_memberships_update_admin
on public.employer_memberships
for update
to authenticated
using (
  public.is_employer_member(employer_id, array['owner', 'admin'])
)
with check (
  public.is_employer_member(employer_id, array['owner', 'admin'])
  and role in ('admin', 'recruiter', 'owner')
  and status in ('invited', 'active', 'revoked')
);

drop policy if exists employer_memberships_delete_owner_admin on public.employer_memberships;
create policy employer_memberships_delete_owner_admin
on public.employer_memberships
for delete
to authenticated
using (
  public.is_employer_member(employer_id, array['owner', 'admin'])
  and role <> 'owner'
);

grant execute on function public.claim_pending_employer_invites() to authenticated;
grant execute on function public.get_current_employer_context() to authenticated;
grant execute on function public.get_current_employer_profile_id() to authenticated;
grant execute on function public.is_employer_member(uuid, text[]) to authenticated;
grant execute on function public.get_plan_user_limit(text) to authenticated;

drop policy if exists employer_profiles_select_own on public.employer_profiles;
drop policy if exists employer_profiles_update_own on public.employer_profiles;

create policy employer_profiles_select_member_workspace
on public.employer_profiles
for select
to authenticated
using (
  public.is_employer_member(id)
  or true
);

create policy employer_profiles_update_member_workspace
on public.employer_profiles
for update
to authenticated
using (
  public.is_employer_member(id, array['owner', 'admin'])
)
with check (
  public.is_employer_member(id, array['owner', 'admin'])
);

drop policy if exists candidate_resumes_select_own_or_related_employer on public.candidate_resumes;
create policy candidate_resumes_select_own_or_related_employer
on public.candidate_resumes
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_resumes.candidate_profile_id
      and cp.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.job_applications ja
    join public.jobs j on j.id = ja.job_id
    where ja.candidate_profile_id = candidate_resumes.candidate_profile_id
      and public.is_employer_member(j.employer_id)
  )
);

drop policy if exists "employers_select_own_billing_invoices" on public.billing_invoices;
create policy "employers_select_own_billing_invoices"
on public.billing_invoices
for select
to authenticated
using (public.is_employer_member(employer_id, array['owner', 'admin']));

drop policy if exists employer_credits_select_own on public.employer_credits;
create policy employer_credits_select_own
on public.employer_credits
for select
to authenticated
using (public.is_employer_member(employer_id));

drop policy if exists employer_credit_usage_select_own on public.employer_credit_usage;
create policy employer_credit_usage_select_own
on public.employer_credit_usage
for select
to authenticated
using (public.is_employer_member(employer_id));

drop policy if exists employer_addon_purchases_select_own on public.employer_addon_purchases;
create policy employer_addon_purchases_select_own
on public.employer_addon_purchases
for select
to authenticated
using (public.is_employer_member(employer_id, array['owner', 'admin']));

drop policy if exists job_ai_reports_select_own on public.job_ai_reports;
create policy job_ai_reports_select_own
on public.job_ai_reports
for select
to authenticated
using (public.is_employer_member(employer_id));

drop policy if exists jobs_select_employer_own on public.jobs;
create policy jobs_select_employer_own
on public.jobs
for select
to authenticated
using (public.is_employer_member(employer_id));

drop policy if exists jobs_insert_employer_own on public.jobs;
create policy jobs_insert_employer_own
on public.jobs
for insert
to authenticated
with check (public.is_employer_member(employer_id));

drop policy if exists jobs_update_employer_own on public.jobs;
create policy jobs_update_employer_own
on public.jobs
for update
to authenticated
using (public.is_employer_member(employer_id))
with check (public.is_employer_member(employer_id));

drop policy if exists job_skills_insert_employer_own_job on public.job_skills;
create policy job_skills_insert_employer_own_job
on public.job_skills
for insert
to authenticated
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_skills.job_id
      and public.is_employer_member(j.employer_id)
  )
);

drop policy if exists job_skills_update_employer_own_job on public.job_skills;
create policy job_skills_update_employer_own_job
on public.job_skills
for update
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_skills.job_id
      and public.is_employer_member(j.employer_id)
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_skills.job_id
      and public.is_employer_member(j.employer_id)
  )
);

drop policy if exists job_skills_delete_employer_own_job on public.job_skills;
create policy job_skills_delete_employer_own_job
on public.job_skills
for delete
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_skills.job_id
      and public.is_employer_member(j.employer_id)
  )
);

drop policy if exists job_applications_select_employer_own on public.job_applications;
create policy job_applications_select_employer_own
on public.job_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_applications.job_id
      and public.is_employer_member(j.employer_id)
  )
);

drop policy if exists job_applications_update_employer_own on public.job_applications;
create policy job_applications_update_employer_own
on public.job_applications
for update
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_applications.job_id
      and public.is_employer_member(j.employer_id)
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_applications.job_id
      and public.is_employer_member(j.employer_id)
  )
);

create or replace function public.is_conversation_participant(conversation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    join public.candidate_profiles cp on cp.id = c.candidate_profile_id
    where c.id = conversation_uuid
      and (
        public.is_employer_member(c.employer_id)
        or cp.user_id = auth.uid()
      )
  )
$$;

drop policy if exists conversations_insert_participants on public.conversations;
create policy conversations_insert_participants
on public.conversations
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    (
      public.get_current_employer_profile_id() is not null
      and employer_id = public.get_current_employer_profile_id()
    )
    or
    (
      public.get_current_candidate_profile_id() is not null
      and candidate_profile_id = public.get_current_candidate_profile_id()
    )
  )
);

drop policy if exists messages_insert_participants on public.messages;
create policy messages_insert_participants
on public.messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
  and (
    (
      sender_role = 'employer'
      and exists (
        select 1
        from public.conversations c
        where c.id = conversation_id
          and public.is_employer_member(c.employer_id)
      )
    )
    or
    (
      sender_role = 'candidate'
      and exists (
        select 1
        from public.conversations c
        join public.candidate_profiles cp on cp.id = c.candidate_profile_id
        where c.id = conversation_id
          and cp.user_id = auth.uid()
      )
    )
  )
);

create or replace function public.create_or_get_conversation(
  p_candidate_profile_id uuid default null,
  p_employer_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_employer_profile_id uuid;
  v_candidate_profile_id uuid;
  v_conversation_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select employer_id
  into v_employer_profile_id
  from public.get_current_employer_context()
  limit 1;

  select cp.id
  into v_candidate_profile_id
  from public.candidate_profiles cp
  where cp.user_id = v_auth_user_id
  limit 1;

  if v_employer_profile_id is not null then
    if p_candidate_profile_id is null then
      raise exception 'Candidate profile is required';
    end if;

    insert into public.conversations (employer_id, candidate_profile_id, created_by)
    values (v_employer_profile_id, p_candidate_profile_id, v_auth_user_id)
    on conflict (employer_id, candidate_profile_id)
    do update set employer_id = excluded.employer_id
    returning id into v_conversation_id;

    return v_conversation_id;
  end if;

  if v_candidate_profile_id is not null then
    if p_employer_profile_id is null then
      raise exception 'Employer profile is required';
    end if;

    insert into public.conversations (employer_id, candidate_profile_id, created_by)
    values (p_employer_profile_id, v_candidate_profile_id, v_auth_user_id)
    on conflict (employer_id, candidate_profile_id)
    do update set employer_id = excluded.employer_id
    returning id into v_conversation_id;

    return v_conversation_id;
  end if;

  raise exception 'No employer or candidate profile found for current user';
end;
$$;

drop policy if exists interviews_select_employer_own on public.interviews;
create policy interviews_select_employer_own
on public.interviews
for select
using (public.is_employer_member(employer_id));

drop policy if exists interviews_insert_employer_own on public.interviews;
create policy interviews_insert_employer_own
on public.interviews
for insert
with check (public.is_employer_member(employer_id));

drop policy if exists interviews_update_employer_own on public.interviews;
create policy interviews_update_employer_own
on public.interviews
for update
using (public.is_employer_member(employer_id))
with check (public.is_employer_member(employer_id));
