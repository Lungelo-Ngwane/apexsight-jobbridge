-- Reset user-generated app data while preserving reference tables such as:
-- - public.plans
-- - public.addons
-- - public.skills
--
-- Intended use:
-- - local/dev resets
-- - controlled staging cleanup
--
-- This script preserves admin allowlist rows by default.
-- This script also preserves auth.users by default.
-- If you run this alone, existing logins will remain valid but their app
-- profiles will be gone, which will cause "profile not found" errors until
-- you either sign up again or clear auth with reset_auth_users.sql.
-- Uncomment the optional sections if you want a fully blank environment.

begin;

do $$
declare
  tables_to_truncate text[] := array[
    'admin_audit_logs',
    'applications',
    'billing_invoices',
    'candidate_certifications',
    'candidate_profiles',
    'candidate_skills',
    'conversations',
    'employer_addon_purchases',
    'employer_credit_usage',
    'employer_integration_requests',
    'employer_memberships',
    'employer_profiles',
    'interviews',
    'job_ai_reports',
    'job_applications',
    'job_matches',
    'job_skills',
    'job_views',
    'jobs',
    'messages',
    'payment_webhook_events',
    'profiles'
  ];
  table_name text;
  existing_tables text[];
begin
  select array_agg(t)
  into existing_tables
  from unnest(tables_to_truncate) as t
  where exists (
    select 1
    from information_schema.tables ist
    where ist.table_schema = 'public'
      and ist.table_name = t
  );

  if coalesce(array_length(existing_tables, 1), 0) > 0 then
    execute 'truncate table ' || (
      select string_agg(format('public.%I', t), ', ')
      from unnest(existing_tables) as t
    ) || ' restart identity cascade';
  end if;
end
$$;

-- Normalize any leftover employer billing state after the truncate.
update public.employer_profiles
set
  plan = 'free',
  selected_plan = null,
  subscription_status = 'inactive',
  onboarding_step = 0
where true;

-- Optional: also wipe admin access.
-- truncate table public.admin_users restart identity cascade;

-- Optional: clear Supabase storage objects created by the app.
-- Adjust bucket names if your project uses different ones.
-- delete from storage.objects
-- where bucket_id in (
--   'candidate-cvs',
--   'employer-assets',
--   'billing-documents'
-- );

-- Optional: fully remove signed-in users as well.
-- Run only if you want a completely blank auth state.
-- delete from auth.identities;
-- delete from auth.users;

commit;
