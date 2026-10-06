begin;
create or replace function public.can_read_candidate(p_candidate_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.candidate_profiles c where c.id = p_candidate_id and c.user_id = auth.uid())
  or exists(select 1 from public.job_applications a join public.jobs j on j.id = a.job_id
    join public.employer_credit_usage u on u.employer_id = j.employer_id and u.context_id = a.id
      and u.context_type = 'candidate_profile_view' and u.usage_month = date_trunc('month', now())::date
    where a.candidate_profile_id = p_candidate_id and public.is_employer_member(j.employer_id));
$$;

create function public.get_candidate_summaries(p_ids uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'full_name', c.full_name, 'headline', c.headline,
    'location', c.location, 'bio', c.bio, 'preferred_job_type', c.preferred_job_type,
    'years_experience', c.years_experience, 'candidate_skills', coalesce((select jsonb_agg(jsonb_build_object(
      'skill_id', s.skill_id, 'skill', s.skill, 'level', s.level, 'skills', jsonb_build_object('name', s.skill)))
      from public.candidate_skills s where s.candidate_profile_id = c.id), '[]'::jsonb))), '[]'::jsonb)
  from public.candidate_profiles c where c.id = any(p_ids[1:100]) and (
    c.user_id = auth.uid() or exists(select 1 from public.job_applications a join public.jobs j on j.id = a.job_id
      where a.candidate_profile_id = c.id and public.is_employer_member(j.employer_id))
    or exists(select 1 from public.conversations co where co.candidate_profile_id = c.id and public.is_employer_member(co.employer_id))
  );
$$;
revoke all on function public.get_candidate_summaries(uuid[]) from public, anon;
grant execute on function public.get_candidate_summaries(uuid[]) to authenticated, service_role;

do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public'
    and tablename in ('candidate_certifications', 'candidate_resumes') and cmd in ('SELECT', 'ALL') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
create policy certifications_private_read on public.candidate_certifications for select to authenticated
  using(public.can_read_candidate(candidate_id));
create policy resumes_private_read on public.candidate_resumes for select to authenticated
  using(public.can_read_candidate(candidate_profile_id));
drop policy if exists candidate_certifications_files_select_own_or_related_employer on storage.objects;
create policy certificates_unlocked_read on storage.objects for select to authenticated using(
  bucket_id = 'candidate-certifications' and ((storage.foldername(name))[1] = auth.uid()::text
    or exists(select 1 from public.candidate_certifications c where c.certificate_file_path = name and public.can_read_candidate(c.candidate_id))));

-- Serialize allowance checks and credit deductions against one workspace row.
create function public.unlock_candidate(p_employer_id uuid, p_application_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.employer_profiles; allowance integer; used integer; balance integer; source text := 'plan';
  month_start date := date_trunc('month', now())::date;
begin
  select * into e from public.employer_profiles where id = p_employer_id for update;
  if e.id is null or not exists(select 1 from public.job_applications a join public.jobs j on j.id = a.job_id
    where a.id = p_application_id and j.employer_id = e.id) then raise exception 'Invalid application'; end if;
  select count(*) into used from public.employer_credit_usage where employer_id = e.id
    and context_type = 'candidate_profile_view' and usage_month = month_start;
  select candidate_view_limit into allowance from public.plans where lower(name) = lower(e.plan) and active limit 1;
  if not found then allowance := 0; end if;
  if e.subscription_status <> 'active' or e.plan = 'free' then allowance := 0; end if;
  if exists(select 1 from public.employer_credit_usage where employer_id = e.id and context_id = p_application_id
    and context_type = 'candidate_profile_view' and usage_month = month_start) then source := 'existing';
  else
    if allowance is not null and used >= allowance then
      source := 'addon';
      update public.employer_credits set remaining = remaining - 1
        where employer_id = e.id and credit_type = 'candidate_unlock' and remaining >= 1 returning remaining into balance;
      if balance is null then
        update public.employer_credits set remaining = remaining - 1
          where employer_id = e.id and credit_type = 'candidate_profile_view' and remaining >= 1 returning remaining into balance;
      end if;
      if balance is null then raise exception 'Insufficient candidate unlock credits'; end if;
    end if;
    insert into public.employer_credit_usage(employer_id, credit_type, amount, context_type, context_id, usage_month, metadata)
      values(e.id, case when source = 'plan' then 'candidate_view_plan' else 'candidate_unlock' end,
        1, 'candidate_profile_view', p_application_id, month_start, jsonb_build_object('source', source));
    used := used + 1;
  end if;
  return jsonb_build_object('success', true, 'source', source, 'candidateViewsUsedThisMonth', used, 'candidateViewLimit', allowance);
end $$;
revoke all on function public.unlock_candidate(uuid, uuid) from public, anon, authenticated;
grant execute on function public.unlock_candidate(uuid, uuid) to service_role;

create function public.validate_application_write()
returns trigger language plpgsql set search_path = '' as $$
declare c public.candidate_profiles;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    select * into c from public.candidate_profiles where id = new.candidate_profile_id and user_id = auth.uid();
    if c.id is null or not exists(select 1 from public.profiles where id = auth.uid() and role = 'candidate')
      or nullif(trim(c.full_name), '') is null or nullif(trim(c.cv_url), '') is null
      or not exists(select 1 from public.candidate_skills where candidate_profile_id = c.id)
      or not exists(select 1 from public.jobs where id = new.job_id and status = 'open' and expires_at > now()) then
      raise exception 'Application requirements not met' using errcode = '42501';
    end if;
    new.status := 'applied';
  elsif new.job_id is distinct from old.job_id or new.candidate_profile_id is distinct from old.candidate_profile_id
    or new.score is distinct from old.score or new.score_breakdown is distinct from old.score_breakdown then
    raise exception 'Application identity and scores are server controlled' using errcode = '42501';
  end if;
  return new;
end $$;
-- Scoring triggers execute after this validation on INSERT, and trusted scoring RPCs use service_role.
create trigger a_validate_application_write before insert or update on public.job_applications
  for each row execute function public.validate_application_write();
commit;
