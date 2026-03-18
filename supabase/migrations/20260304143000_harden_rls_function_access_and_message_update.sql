-- Security hardening:
-- 1) Ensure sensitive SECURITY DEFINER RPC cannot be executed by regular client roles.
-- 2) Restrict message updates to read receipts only (no message body tampering).

-- 1) Protect grant_addon_credits from direct client execution.
revoke execute on function public.grant_addon_credits(text, uuid, uuid, integer, text, integer)
from public;
revoke execute on function public.grant_addon_credits(text, uuid, uuid, integer, text, integer)
from anon;
revoke execute on function public.grant_addon_credits(text, uuid, uuid, integer, text, integer)
from authenticated;
grant execute on function public.grant_addon_credits(text, uuid, uuid, integer, text, integer)
to service_role;

-- 2) Message update guard: only recipient can set read_at from null -> value.
create or replace function public.enforce_messages_read_receipt_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow only read_at to change.
  if new.conversation_id is distinct from old.conversation_id
     or new.sender_user_id is distinct from old.sender_user_id
     or new.sender_role is distinct from old.sender_role
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read receipts can be updated on messages';
  end if;

  -- read_at can only transition once from null to non-null.
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Message read_at cannot be changed once set';
  end if;

  if old.read_at is null and new.read_at is null then
    raise exception 'Message update must set read_at';
  end if;

  -- Sender cannot mark their own message as read.
  if new.sender_user_id = auth.uid() then
    raise exception 'Cannot mark your own message as read';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_before_update_enforce_read_receipt on public.messages;
create trigger messages_before_update_enforce_read_receipt
before update on public.messages
for each row
execute function public.enforce_messages_read_receipt_update();

-- Tighten update policy to recipients only for unread messages.
drop policy if exists messages_update_participants on public.messages;
drop policy if exists messages_update_recipients_read_receipts on public.messages;
create policy messages_update_recipients_read_receipts
on public.messages
for update
to authenticated
using (
  public.is_conversation_participant(conversation_id)
  and sender_user_id <> auth.uid()
  and read_at is null
)
with check (
  public.is_conversation_participant(conversation_id)
  and sender_user_id <> auth.uid()
  and read_at is not null
);
