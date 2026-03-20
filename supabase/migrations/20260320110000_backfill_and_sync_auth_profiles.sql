create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role text := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  resolved_full_name text := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.email)), '');
  resolved_company_name text := nullif(trim(coalesce(new.raw_user_meta_data->>'company_name', '')), '');
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    resolved_full_name,
    case
      when resolved_role in ('candidate', 'employer', 'admin') then resolved_role
      else null
    end
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = coalesce(public.profiles.role, excluded.role);

  if resolved_role = 'candidate' then
    insert into public.candidate_profiles (user_id, full_name, experience_level)
    values (new.id, coalesce(resolved_full_name, 'Candidate'), 'junior')
    on conflict (user_id) do update
    set full_name = coalesce(public.candidate_profiles.full_name, excluded.full_name);
  elsif resolved_role = 'employer' then
    insert into public.employer_profiles (user_id, company_name)
    values (new.id, coalesce(resolved_company_name, 'Employer'))
    on conflict (user_id) do update
    set company_name = coalesce(public.employer_profiles.company_name, excluded.company_name);
  end if;

  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, role)
select
  au.id,
  nullif(trim(coalesce(au.raw_user_meta_data->>'full_name', au.email)), ''),
  case
    when lower(coalesce(au.raw_user_meta_data->>'role', '')) in ('candidate', 'employer', 'admin')
      then lower(au.raw_user_meta_data->>'role')
    else null
  end
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;

insert into public.candidate_profiles (user_id, full_name, experience_level)
select
  au.id,
  coalesce(nullif(trim(coalesce(au.raw_user_meta_data->>'full_name', au.email)), ''), 'Candidate'),
  'junior'
from auth.users au
join public.profiles p
  on p.id = au.id
 and lower(coalesce(p.role, '')) = 'candidate'
left join public.candidate_profiles cp on cp.user_id = au.id
where cp.user_id is null;

insert into public.employer_profiles (user_id, company_name)
select
  au.id,
  coalesce(nullif(trim(coalesce(au.raw_user_meta_data->>'company_name', '')), ''), 'Employer')
from auth.users au
join public.profiles p
  on p.id = au.id
 and lower(coalesce(p.role, '')) = 'employer'
left join public.employer_profiles ep on ep.user_id = au.id
where ep.user_id is null;
