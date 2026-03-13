alter table if exists public.plans
  add column if not exists paystack_test_plan_code text;

update public.plans
set paystack_test_plan_code = 'PLN_ov1im0jj6etcszv'
where lower(name) = 'starter';

update public.plans
set paystack_test_plan_code = 'PLN_cpg8hjzxb90hjf2'
where lower(name) in ('professional', 'proffessional plan', 'professional plan');

update public.plans
set paystack_test_plan_code = 'PLN_wx191m31z1nrc8j'
where lower(name) = 'enterprise';
