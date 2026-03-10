update public.addons
set price = 99900
where lower(trim(type)) = 'job_slot';
