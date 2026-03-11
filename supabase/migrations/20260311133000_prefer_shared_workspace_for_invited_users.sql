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
    case
      when ep.user_id = v_auth_user_id then 1
      else 0
    end,
    case em.role
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    em.created_at asc
  limit 1;
end;
$$;

grant execute on function public.get_current_employer_context() to authenticated;
