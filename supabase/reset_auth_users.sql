-- Remove all authenticated users after reset_app_data.sql or for a full clean slate.
-- Use in local/dev or controlled staging only.
--
-- Effects:
-- - Deletes auth.users and auth.identities
-- - Removes admin allowlist rows that reference those users
-- - Forces all users to sign up again

begin;

truncate table public.admin_users restart identity cascade;
truncate table public.admin_audit_logs restart identity cascade;

delete from auth.identities;
delete from auth.users;

commit;
