alter table public.employer_profiles
add column if not exists description text;

alter table public.employer_profiles
add column if not exists website text;

alter table public.employer_profiles
add column if not exists contact_email text;

alter table public.employer_profiles
add column if not exists phone text;

alter table public.employer_profiles
add column if not exists address text;

alter table public.employer_profiles
add column if not exists logo_url text;

alter table public.employer_profiles
add column if not exists show_on_platform boolean not null default true;

alter table public.employer_profiles
add column if not exists public_company_page boolean not null default true;

update public.employer_profiles ep
set contact_email = coalesce(ep.contact_email, au.email)
from auth.users au
where au.id = ep.user_id
  and ep.contact_email is null;
