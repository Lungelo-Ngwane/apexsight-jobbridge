begin;
alter table public.checkout_intents add column provider_plan_code text;
alter table public.checkout_intents add column provider_subscription_code text;
-- Provider bindings are written only by verified, privileged payment handlers.
create unique index employer_subscription_identity on public.employer_profiles(paystack_subscription_code)
  where paystack_subscription_code is not null;
commit;
