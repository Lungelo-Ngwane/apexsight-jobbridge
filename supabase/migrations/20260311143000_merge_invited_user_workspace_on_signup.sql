create or replace function public.merge_invited_user_workspace_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_target_membership_id uuid;
  v_target_employer_id uuid;
begin
  if new.user_id is null then
    return new;
  end if;

  select lower(coalesce(au.email, ''))
  into v_email
  from auth.users au
  where au.id = new.user_id
  limit 1;

  if coalesce(v_email, '') = '' then
    return new;
  end if;

  select em.id, em.employer_id
  into v_target_membership_id, v_target_employer_id
  from public.employer_memberships em
  where em.email_normalized = v_email
    and em.employer_id <> new.id
    and em.status = 'invited'
  order by em.created_at asc
  limit 1;

  if v_target_membership_id is null or v_target_employer_id is null then
    return new;
  end if;

  update public.employer_memberships
  set
    user_id = new.user_id,
    status = 'active',
    accepted_at = coalesce(accepted_at, timezone('utc', now()))
  where id = v_target_membership_id;

  delete from public.employer_profiles
  where id = new.id;

  return null;
end;
$$;

drop trigger if exists trg_merge_invited_user_workspace_on_signup on public.employer_profiles;
create trigger trg_merge_invited_user_workspace_on_signup
after insert on public.employer_profiles
for each row
execute function public.merge_invited_user_workspace_on_signup();
