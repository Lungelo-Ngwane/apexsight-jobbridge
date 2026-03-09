insert into public.skills (name, category)
select 'Visual Studio Code', 'Tool'
where not exists (
  select 1
  from public.skills
  where lower(trim(name)) = lower(trim('Visual Studio Code'))
);
