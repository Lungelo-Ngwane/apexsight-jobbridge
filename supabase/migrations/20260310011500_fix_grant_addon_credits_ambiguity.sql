create or replace function public.grant_addon_credits(
  p_reference text,
  p_employer_id uuid,
  p_addon_id uuid,
  p_amount_paid integer,
  p_credit_type text,
  p_credits_to_add integer
)
returns table (
  purchase_id uuid,
  credits_added integer,
  already_processed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_existing_credits integer;
  v_purchase_employer_id uuid;
  v_purchase_addon_id uuid;
  v_credit_delta integer;
begin
  if coalesce(trim(p_reference), '') = '' then
    raise exception 'reference is required';
  end if;

  if p_employer_id is null then
    raise exception 'employer id is required';
  end if;

  if p_addon_id is null then
    raise exception 'addon id is required';
  end if;

  if coalesce(trim(p_credit_type), '') = '' then
    raise exception 'credit type is required';
  end if;

  if coalesce(p_credits_to_add, 0) <= 0 then
    raise exception 'credits_to_add must be greater than zero';
  end if;

  insert into public.employer_addon_purchases (
    employer_id,
    addon_id,
    reference,
    amount_paid,
    status,
    credits_added
  )
  values (
    p_employer_id,
    p_addon_id,
    p_reference,
    greatest(coalesce(p_amount_paid, 0), 0),
    'success',
    0
  )
  on conflict (reference) do nothing;

  select
    purchase.id,
    purchase.employer_id,
    purchase.addon_id,
    coalesce(purchase.credits_added, 0)
  into
    v_purchase_id,
    v_purchase_employer_id,
    v_purchase_addon_id,
    v_existing_credits
  from public.employer_addon_purchases as purchase
  where purchase.reference = p_reference
  for update;

  if v_purchase_id is null then
    raise exception 'failed to resolve purchase row for reference %', p_reference;
  end if;

  if v_purchase_employer_id <> p_employer_id then
    raise exception 'reference % belongs to a different employer', p_reference;
  end if;

  if v_purchase_addon_id <> p_addon_id then
    raise exception 'reference % belongs to a different add-on', p_reference;
  end if;

  if v_existing_credits >= p_credits_to_add then
    return query
    select v_purchase_id, v_existing_credits, true;
    return;
  end if;

  v_credit_delta := p_credits_to_add - v_existing_credits;

  insert into public.employer_credits (
    employer_id,
    credit_type,
    remaining
  )
  values (
    p_employer_id,
    p_credit_type,
    v_credit_delta
  )
  on conflict (employer_id, credit_type)
  do update
  set remaining = public.employer_credits.remaining + excluded.remaining;

  update public.employer_addon_purchases
  set
    status = 'success',
    amount_paid = greatest(coalesce(amount_paid, 0), greatest(coalesce(p_amount_paid, 0), 0)),
    credits_added = p_credits_to_add
  where id = v_purchase_id;

  return query
  select v_purchase_id, p_credits_to_add, false;
end;
$$;

revoke execute on function public.grant_addon_credits(text, uuid, uuid, integer, text, integer)
from public;
revoke execute on function public.grant_addon_credits(text, uuid, uuid, integer, text, integer)
from anon;
revoke execute on function public.grant_addon_credits(text, uuid, uuid, integer, text, integer)
from authenticated;
grant execute on function public.grant_addon_credits(text, uuid, uuid, integer, text, integer)
to service_role;
