begin;
create or replace function public.claim_pending_employer_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare email_address text; claimed integer;
begin
  select lower(u.email) into email_address from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null;
  if email_address is null then return 0; end if;
  update public.employer_memberships set user_id = auth.uid(), status = 'active',
    accepted_at = coalesce(accepted_at, now())
    where user_id is null and status = 'invited' and email_normalized = email_address;
  get diagnostics claimed = row_count;
  return claimed;
end $$;
revoke all on function public.claim_pending_employer_invites() from public, anon;
grant execute on function public.claim_pending_employer_invites() to authenticated, service_role;
commit;
