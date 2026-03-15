create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

create or replace function public.write_admin_audit_log(
  p_action text,
  p_target_user_id uuid default null,
  p_target_email text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    target_user_id,
    target_email,
    details
  )
  values (
    auth.uid(),
    coalesce(nullif(trim(p_action), ''), 'unknown'),
    p_target_user_id,
    nullif(trim(coalesce(p_target_email, '')), ''),
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

create or replace function public.list_admin_users()
returns table (
  user_id uuid,
  email text,
  notes text,
  created_at timestamptz,
  created_by uuid,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    au.user_id,
    coalesce(nullif(trim(au.email), ''), auth_user.email) as email,
    au.notes,
    au.created_at,
    au.created_by,
    au.user_id = auth.uid() as is_current_user
  from public.admin_users au
  left join auth.users auth_user on auth_user.id = au.user_id
  where public.is_admin_user(auth.uid())
  order by au.created_at asc, au.user_id asc;
$$;

create or replace function public.add_admin_user(
  p_user_id uuid,
  p_email text default null,
  p_notes text default null
)
returns public.admin_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.admin_users;
  v_existing_email text;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  if p_user_id is null then
    raise exception 'user id is required';
  end if;

  select email
  into v_existing_email
  from auth.users
  where id = p_user_id;

  if v_existing_email is null and coalesce(nullif(trim(coalesce(p_email, '')), ''), '') = '' then
    raise exception 'Provide an email or use a valid existing user id';
  end if;

  insert into public.admin_users (
    user_id,
    email,
    notes,
    created_by
  )
  values (
    p_user_id,
    coalesce(nullif(trim(coalesce(p_email, '')), ''), v_existing_email),
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  on conflict (user_id)
  do update set
    email = excluded.email,
    notes = excluded.notes
  returning * into v_row;

  perform public.write_admin_audit_log(
    'admin_added',
    v_row.user_id,
    v_row.email,
    jsonb_build_object(
      'notes', v_row.notes
    )
  );

  return v_row;
end;
$$;

create or replace function public.remove_admin_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.admin_users;
  v_admin_count integer;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  if p_user_id is null then
    raise exception 'user id is required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own admin access from the UI';
  end if;

  select count(*)::int
  into v_admin_count
  from public.admin_users;

  if coalesce(v_admin_count, 0) <= 1 then
    raise exception 'At least one admin must remain';
  end if;

  select *
  into v_target
  from public.admin_users
  where user_id = p_user_id;

  if v_target.user_id is null then
    return;
  end if;

  delete from public.admin_users
  where user_id = p_user_id;

  perform public.write_admin_audit_log(
    'admin_removed',
    v_target.user_id,
    v_target.email,
    jsonb_build_object(
      'notes', v_target.notes
    )
  );
end;
$$;

create or replace function public.list_admin_audit_logs(p_limit integer default 25)
returns table (
  id uuid,
  actor_user_id uuid,
  actor_email text,
  action text,
  target_user_id uuid,
  target_email text,
  details jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    aal.id,
    aal.actor_user_id,
    coalesce(actor_user.email, 'Unknown admin') as actor_email,
    aal.action,
    aal.target_user_id,
    aal.target_email,
    aal.details,
    aal.created_at
  from public.admin_audit_logs aal
  left join auth.users actor_user on actor_user.id = aal.actor_user_id
  where public.is_admin_user(auth.uid())
  order by aal.created_at desc
  limit greatest(coalesce(p_limit, 25), 1);
$$;

grant execute on function public.write_admin_audit_log(text, uuid, text, jsonb) to authenticated;
grant execute on function public.list_admin_users() to authenticated;
grant execute on function public.add_admin_user(uuid, text, text) to authenticated;
grant execute on function public.remove_admin_user(uuid) to authenticated;
grant execute on function public.list_admin_audit_logs(integer) to authenticated;
