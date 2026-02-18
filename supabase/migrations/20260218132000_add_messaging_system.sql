create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  job_application_id uuid null references public.job_applications(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamp with time zone not null default now(),
  last_message_at timestamp with time zone null,
  last_message_preview text null,
  last_message_sender_role text null check (last_message_sender_role in ('employer', 'candidate')),
  constraint conversations_unique_participants unique (employer_id, candidate_profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('employer', 'candidate')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamp with time zone not null default now(),
  read_at timestamp with time zone null
);

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end;
$$;

create index if not exists conversations_employer_last_message_idx
  on public.conversations (employer_id, last_message_at desc nulls last, created_at desc);

create index if not exists conversations_candidate_last_message_idx
  on public.conversations (candidate_profile_id, last_message_at desc nulls last, created_at desc);

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at asc);

create or replace function public.get_current_employer_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ep.id
  from public.employer_profiles ep
  where ep.user_id = auth.uid()
  limit 1
$$;

create or replace function public.get_current_candidate_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cp.id
  from public.candidate_profiles cp
  where cp.user_id = auth.uid()
  limit 1
$$;

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
    join public.employer_profiles ep on ep.id = c.employer_id
    join public.candidate_profiles cp on cp.id = c.candidate_profile_id
    where c.id = conversation_uuid
      and (ep.user_id = auth.uid() or cp.user_id = auth.uid())
  )
$$;

create or replace function public.sync_conversation_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_preview = left(new.body, 240),
    last_message_sender_role = new.sender_role
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_after_insert_sync_conversation on public.messages;
create trigger messages_after_insert_sync_conversation
after insert on public.messages
for each row execute function public.sync_conversation_on_message_insert();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_select_participants on public.conversations;
create policy conversations_select_participants
on public.conversations
for select
to authenticated
using (public.is_conversation_participant(id));

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

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants
on public.messages
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

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
        join public.employer_profiles ep on ep.id = c.employer_id
        where c.id = conversation_id
          and ep.user_id = auth.uid()
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

drop policy if exists messages_update_participants on public.messages;
create policy messages_update_participants
on public.messages
for update
to authenticated
using (public.is_conversation_participant(conversation_id))
with check (public.is_conversation_participant(conversation_id));
