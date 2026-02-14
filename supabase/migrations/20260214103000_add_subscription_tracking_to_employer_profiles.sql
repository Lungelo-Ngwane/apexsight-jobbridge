alter table public.employer_profiles
add column if not exists subscription_status text not null default 'inactive';

alter table public.employer_profiles
add column if not exists paystack_customer_code text;

alter table public.employer_profiles
add column if not exists paystack_subscription_code text;

alter table public.employer_profiles
add column if not exists paystack_subscription_email_token text;

alter table public.employer_profiles
add column if not exists current_period_end timestamptz;

alter table public.employer_profiles
drop constraint if exists employer_subscription_status_check;

alter table public.employer_profiles
add constraint employer_subscription_status_check
check (
  subscription_status = any (
    array['inactive'::text, 'active'::text, 'past_due'::text, 'cancelled'::text]
  )
);

create unique index if not exists employer_profiles_paystack_customer_code_key
  on public.employer_profiles (paystack_customer_code)
  where paystack_customer_code is not null;

create unique index if not exists employer_profiles_paystack_subscription_code_key
  on public.employer_profiles (paystack_subscription_code)
  where paystack_subscription_code is not null;
