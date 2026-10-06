begin;
create table public.checkout_intents (
  reference text primary key,
  employer_id uuid not null references public.employer_profiles(id),
  kind text not null check (kind in ('subscription', 'addon')),
  amount_minor bigint not null check(amount_minor > 0),
  currency text not null default 'ZAR' check(currency = 'ZAR'),
  plan_name text check(plan_name in ('starter', 'professional', 'enterprise')),
  addon_id uuid references public.addons(id),
  credit_type text,
  credits integer check(credits > 0),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  check((kind = 'subscription' and plan_name is not null and addon_id is null)
    or (kind = 'addon' and addon_id is not null and credit_type is not null and credits is not null))
);
alter table public.checkout_intents enable row level security;
revoke all on public.checkout_intents from anon, authenticated;
grant all on public.checkout_intents to service_role;
alter table public.employer_profiles add column last_payment_intent_at timestamptz;

-- Payment side effects and intent completion share one transaction/row lock.
create function public.fulfill_checkout(p_reference text, p_amount bigint, p_currency text,
  p_customer_code text default null, p_subscription_code text default null,
  p_email_token text default null, p_period_end timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare intent public.checkout_intents; result jsonb;
begin
  select * into intent from public.checkout_intents where reference = p_reference for update;
  if intent.reference is null or intent.amount_minor <> p_amount or intent.currency <> p_currency then
    raise exception 'Invalid payment intent' using errcode = '22023';
  end if;
  result := jsonb_build_object('success', true, 'reference', intent.reference, 'plan', intent.plan_name,
    'addonId', intent.addon_id, 'creditType', intent.credit_type, 'creditsAdded', intent.credits,
    'alreadyProcessed', intent.fulfilled_at is not null);
  if intent.fulfilled_at is not null then return result; end if;
  if intent.kind = 'addon' then
    perform public.grant_addon_credits(intent.reference, intent.employer_id, intent.addon_id,
      intent.amount_minor::integer, intent.credit_type, intent.credits);
  else
    -- Serialize different checkout intents against the same subscription.
    perform 1 from public.employer_profiles where id = intent.employer_id for update;
    update public.employer_profiles set plan = intent.plan_name, subscription_status = 'active',
      selected_plan = null, paystack_customer_code = coalesce(p_customer_code, paystack_customer_code),
      paystack_subscription_code = coalesce(p_subscription_code, paystack_subscription_code),
      paystack_subscription_email_token = coalesce(p_email_token, paystack_subscription_email_token),
      current_period_end = coalesce(p_period_end, current_period_end), last_payment_intent_at = intent.created_at
      where id = intent.employer_id and (last_payment_intent_at is null or last_payment_intent_at <= intent.created_at);
  end if;
  update public.checkout_intents set fulfilled_at = now() where reference = intent.reference;
  return result;
end $$;
revoke all on function public.fulfill_checkout(text, bigint, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.fulfill_checkout(text, bigint, text, text, text, text, timestamptz) to service_role;

-- Atomic balance check; every successful call changes exactly one credit row.
create function public.consume_employer_credit(p_employer_id uuid, p_credit_type text, p_amount integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare balance integer;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Invalid amount' using errcode = '22023'; end if;
  update public.employer_credits set remaining = remaining - p_amount
    where employer_id = p_employer_id and credit_type = p_credit_type and remaining >= p_amount
    returning remaining into balance;
  if balance is null then raise exception 'Insufficient credits' using errcode = 'P0001'; end if;
  return balance;
end $$;
revoke all on function public.consume_employer_credit(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_employer_credit(uuid, text, integer) to service_role;

-- Durable event receipt + a lease prevent concurrent processing; a crash can be retried.
alter table public.payment_webhook_events add column processing_token uuid;
alter table public.payment_webhook_events add column processing_until timestamptz;
create function public.claim_payment_event(p_key text, p_event text, p_reference text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare claim uuid := gen_random_uuid(); claimed uuid;
begin
  insert into public.payment_webhook_events(provider, event_key, event_name, reference, payload)
    values('paystack', p_key, p_event, p_reference, p_payload) on conflict(event_key) do nothing;
  update public.payment_webhook_events set processing_token = claim, processing_until = now() + interval '2 minutes',
    status = 'received', last_error = null
    where event_key = p_key and status <> 'processed'
      and (processing_until is null or processing_until < now()) returning processing_token into claimed;
  return claimed;
end $$;
revoke all on function public.claim_payment_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_payment_event(text, text, text, jsonb) to service_role;
commit;
