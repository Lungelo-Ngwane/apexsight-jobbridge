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

  select ep.id
  into v_employer_profile_id
  from public.employer_profiles ep
  where ep.user_id = v_auth_user_id
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

grant execute on function public.create_or_get_conversation(uuid, uuid) to authenticated;

