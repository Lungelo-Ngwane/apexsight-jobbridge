update public.addons
set
  credits = 250,
  name = '250 AI Matching Credits'
where lower(trim(type)) = 'ai_credit'
  and credits = 150;

update public.addons
set
  credits = 1000,
  name = '1000 AI Matching Credits'
where lower(trim(type)) = 'ai_credit'
  and credits = 2000;

update public.addons
set active = false
where lower(trim(type)) = 'ai_credit'
  and credits = 500;
