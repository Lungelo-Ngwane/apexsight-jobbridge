-- Support onboarding-first paid plan intent without granting paid access until payment is confirmed.
-- - selected_plan stores the employer's chosen paid plan before checkout completion.
-- - pending_payment marks subscriptions awaiting successful payment confirmation.

alter table public.employer_profiles
add column if not exists selected_plan text;

alter table public.employer_profiles
drop constraint if exists employer_selected_plan_check;

alter table public.employer_profiles
add constraint employer_selected_plan_check
check (
  selected_plan is null
  or selected_plan = any (array['free'::text, 'starter'::text, 'professional'::text, 'enterprise'::text])
);

alter table public.employer_profiles
drop constraint if exists employer_subscription_status_check;

alter table public.employer_profiles
add constraint employer_subscription_status_check
check (
  subscription_status = any (
    array[
      'inactive'::text,
      'active'::text,
      'past_due'::text,
      'cancelled'::text,
      'trialing'::text,
      'pending_payment'::text
    ]
  )
);
