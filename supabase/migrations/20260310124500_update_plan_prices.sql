update public.plans
set price_monthly = 99900
where lower(trim(name)) = 'starter';

update public.plans
set price_monthly = 299900
where lower(trim(name)) = 'professional';

update public.plans
set price_monthly = 999900
where lower(trim(name)) = 'enterprise';
