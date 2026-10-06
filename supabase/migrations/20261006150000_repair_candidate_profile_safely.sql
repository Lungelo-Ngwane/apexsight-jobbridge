begin;
-- Preserve legacy missing-profile recovery without allowing arbitrary profile inserts.
create function public.ensure_candidate_profile()
returns uuid language plpgsql security definer set search_path = '' as $$
declare account public.profiles; candidate_id uuid;
begin
  select * into account from public.profiles where id = auth.uid() for update;
  if account.id is null or account.role <> 'candidate' or account.role is null then
    raise exception 'Candidate account required' using errcode = '42501';
  end if;
  select id into candidate_id from public.candidate_profiles where user_id = account.id;
  if candidate_id is null then
    insert into public.candidate_profiles(user_id,full_name,experience_level)
      values(account.id,coalesce(account.full_name,'Candidate'),'junior') returning id into candidate_id;
  end if;
  return candidate_id;
end $$;
revoke all on function public.ensure_candidate_profile() from public, anon;
grant execute on function public.ensure_candidate_profile() to authenticated, service_role;
commit;
