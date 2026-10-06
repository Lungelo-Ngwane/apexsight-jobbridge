-- Forward-only hardening. Review and test in staging before production rollout.
begin;
revoke create on schema public from public, anon, authenticated;

-- The March grant-all migration overrode earlier service-only RPC restrictions.
revoke all on all routines in schema public from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- These records are authoritative financial facts, never browser-authored rows.
revoke insert, update, delete on public.employer_credits, public.employer_credit_usage,
  public.employer_addon_purchases, public.billing_invoices, public.payment_webhook_events from authenticated;
grant all on all tables in schema public to service_role;
grant all on all routines in schema public to service_role;
-- Trigger-only routines are not callable RPCs. They need privileged execution to
-- run trusted scoring/maintenance without granting clients the underlying RPCs.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype loop
    execute format('alter function %s security definer', f.signature);
    execute format('alter function %s set search_path to public, pg_temp', f.signature);
  end loop;
end $$;
-- RLS remains mandatory, including tables introduced by historical snapshots.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Only reviewed identity-checked RPCs and policy helpers are browser callable.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'is_employer_member', 'get_current_employer_context', 'get_current_employer_profile_id',
      'get_current_candidate_profile_id', 'is_current_user_candidate_profile',
      'is_current_user_employer_for_job', 'is_conversation_participant',
      'claim_pending_employer_invites', 'get_plan_user_limit', 'record_job_view',
      'create_or_get_conversation', 'is_admin_user', 'get_admin_dashboard_snapshot',
      'get_admin_entity_detail', 'list_admin_users', 'add_admin_user', 'remove_admin_user',
      'list_admin_audit_logs', 'write_admin_audit_log'
    ]) loop
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

-- Remove every legacy read policy on these private records, not only known names.
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public'
    and tablename in ('candidate_profiles', 'candidate_skills', 'employer_profiles')
    and cmd in ('SELECT', 'ALL') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create or replace function public.can_read_candidate(p_candidate_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.candidate_profiles c
    where c.id = p_candidate_id and c.user_id = auth.uid())
  or exists(select 1 from public.job_applications a join public.jobs j on j.id = a.job_id
    where a.candidate_profile_id = p_candidate_id and public.is_employer_member(j.employer_id));
$$;
revoke all on function public.can_read_candidate(uuid) from public, anon;
grant execute on function public.can_read_candidate(uuid) to authenticated, service_role;
create policy candidate_profiles_private_read on public.candidate_profiles for select to authenticated
  using (public.can_read_candidate(id));
create policy candidate_skills_private_read on public.candidate_skills for select to authenticated
  using (public.can_read_candidate(candidate_profile_id));
create policy employer_profiles_workspace_read on public.employer_profiles for select to authenticated
  using (public.is_employer_member(id));

-- Row ownership alone must not authorize billing, identity, or role changes.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = '' as $$
declare protected text[]; key text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_table_name = 'profiles' then
    protected := array['id', 'role'];
  elsif tg_table_name = 'candidate_profiles' then
    protected := array['id', 'user_id', 'embedding', 'resume_text', 'resume_summary',
      'resume_analysis', 'resume_last_analyzed_at', 'professional_bio_ai'];
  else
    protected := array['id', 'user_id', 'verified', 'plan', 'subscription_status',
      'paystack_customer_code', 'paystack_subscription_code', 'paystack_subscription_email_token',
      'current_period_end', 'trial_granted', 'trial_started_at', 'trial_ends_at',
      'starter_auto_shortlist_bonus_granted', 'professional_auto_shortlist_bonus_granted', 'last_payment_intent_at'];
  end if;
  foreach key in array protected loop
    if to_jsonb(new)->key is distinct from to_jsonb(old)->key then
      raise exception 'This field requires a trusted server operation' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
-- Name sorts before plan bonus triggers, so rejected writes cannot mint credits.
create trigger a_protect_profile_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();
create trigger a_protect_profile_columns before update on public.candidate_profiles
  for each row execute function public.protect_profile_columns();
create trigger a_protect_profile_columns before update on public.employer_profiles
  for each row execute function public.protect_profile_columns();
-- Profiles are created by the trusted signup trigger, not arbitrary Data API inserts.
revoke insert on public.profiles, public.employer_profiles, public.candidate_profiles from authenticated;

-- Signup metadata is untrusted; never turn a requested role into platform admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare role_value text := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  name_value text := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.email)), '');
begin
  if role_value not in ('candidate', 'employer') then role_value := null; end if;
  insert into public.profiles(id, full_name, role) values(new.id, name_value, role_value);
  if role_value = 'candidate' then
    insert into public.candidate_profiles(user_id, full_name, experience_level)
      values(new.id, coalesce(name_value, 'Candidate'), 'junior');
  elsif role_value = 'employer' then
    insert into public.employer_profiles(user_id, company_name)
      values(new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'), ''), 'Employer'));
  end if;
  return new;
end $$;

-- Public company discovery exposes an explicit projection, never provider tokens/contacts.
create or replace function public.get_public_employers(p_ids uuid[])
returns table(id uuid, company_name text, industry text, logo_url text, plan text,
  brand_primary_color text, custom_domain text, careers_page_headline text,
  public_company_page boolean, description text, website text, banner_image_url text, company_size text, show_on_platform boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.company_name, e.industry, e.logo_url, e.plan, e.brand_primary_color,
    e.custom_domain, e.careers_page_headline, e.public_company_page, e.description, e.website, e.banner_image_url, e.company_size, e.show_on_platform
  from public.employer_profiles e where e.id = any(p_ids[1:100])
    and e.show_on_platform and e.public_company_page;
$$;
revoke all on function public.get_public_employers(uuid[]) from public;
grant execute on function public.get_public_employers(uuid[]) to anon, authenticated, service_role;

-- The talent pool keeps discovery fields, but never includes CV paths or resume evidence.
create or replace function public.discover_candidates(p_offset integer default 0, p_limit integer default 100)
returns table(id uuid, full_name text, headline text, location text, bio text,
  years_experience integer, candidate_skills jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.employer_profiles e where public.is_employer_member(e.id)
    and e.subscription_status = 'active' and e.plan in ('starter', 'professional', 'enterprise')) then
    raise exception 'Paid employer access required' using errcode = '42501';
  end if;
  return query select c.id, c.full_name, c.headline, c.location, c.bio, c.years_experience,
    coalesce((select jsonb_agg(jsonb_build_object('skill', s.skill, 'level', s.level))
      from public.candidate_skills s where s.candidate_profile_id = c.id), '[]'::jsonb)
  from public.candidate_profiles c order by c.created_at desc, c.id
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;
revoke all on function public.discover_candidates(integer, integer) from public, anon;
grant execute on function public.discover_candidates(integer, integer) to authenticated, service_role;

-- Public jobs and their skill names are part of logged-out browsing.
grant select on public.jobs, public.job_skills, public.skills to anon;
create policy jobs_public_open on public.jobs for select to anon using (status = 'open' and expires_at > now());
create policy job_skills_public_open on public.job_skills for select to anon using
  (exists(select 1 from public.jobs j where j.id = job_id and j.status = 'open' and j.expires_at > now()));
create policy skills_public_read on public.skills for select to anon using (true);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values('resume', 'resume', false, 10485760, array['application/pdf'])
on conflict(id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];
update storage.buckets set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf']
  where id = 'candidate-certifications';
create policy resume_related_employer_read on storage.objects for select to authenticated using
  (bucket_id = 'resume' and exists(select 1 from public.candidate_profiles c
    where c.cv_url = name and public.can_read_candidate(c.id)));

commit;
