--
-- PostgreSQL database dump
--

\restrict GjJlYDleYCF1ia5K1jnbCm3AQQ1lv7zJln9bnA1nnNA8gFdxwPC2mt6oxhe5yRU

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: experience_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.experience_level_enum AS ENUM (
    'junior',
    'mid',
    'senior'
);


--
-- Name: apply_job_application_scoring(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_job_application_scoring() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_required integer := 0;
  v_optional integer := 0;
  v_experience integer := 0;
  v_skill_level integer := 0;
  v_total integer := 0;
begin
  if new.job_id is null or new.candidate_profile_id is null then
    return new;
  end if;

  v_required := coalesce(public.calculate_required_skill_score(new.job_id, new.candidate_profile_id), 0);
  v_optional := coalesce(public.calculate_optional_skill_score(new.job_id, new.candidate_profile_id), 0);
  v_experience := coalesce(public.calculate_experience_score(new.job_id, new.candidate_profile_id), 0);
  v_skill_level := coalesce(public.calculate_skill_proficiency_score(new.job_id, new.candidate_profile_id), 0);

  v_total := least(v_required + v_optional + v_experience + v_skill_level, 100);

  new.score := v_total;
  new.score_breakdown := jsonb_build_object(
    'required', v_required,
    'optional', v_optional,
    'experience', v_experience,
    'skill_level', v_skill_level
  );

  new.match_label := case
    when v_total >= 90 then 'Elite'
    when v_total >= 75 then 'Strong'
    when v_total >= 60 then 'Good'
    when v_total >= 40 then 'Potential'
    else 'Weak'
  end;

  new.hiring_recommendation := case
    when v_total >= 75 then 'Interview Recommended'
    when v_total >= 50 then 'Consider'
    else 'Not Recommended'
  end;

  return new;
end;
$$;


--
-- Name: assign_intro_trial_to_first_employers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_intro_trial_to_first_employers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_trial_limit integer := 5;
  v_trial_days integer := 15;
  v_current_trial_count integer := 0;
begin
  if coalesce(new.trial_granted, false) then
    if new.trial_started_at is null then
      new.trial_started_at := now();
    end if;

    if new.trial_ends_at is null then
      new.trial_ends_at := new.trial_started_at + make_interval(days => v_trial_days);
    end if;

    if public.is_employer_trial_active(new.trial_granted, new.trial_started_at, new.trial_ends_at) then
      new.subscription_status := 'trialing';
      new.plan := 'professional';
    end if;

    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.assign_intro_trial_to_first_employers', 0));

  select count(*)::integer
  into v_current_trial_count
  from public.employer_profiles ep
  where ep.trial_granted = true;

  if v_current_trial_count < v_trial_limit then
    new.trial_granted := true;
    new.trial_started_at := coalesce(new.trial_started_at, now());
    new.trial_ends_at := coalesce(
      new.trial_ends_at,
      new.trial_started_at + make_interval(days => v_trial_days)
    );

    if public.is_employer_trial_active(new.trial_granted, new.trial_started_at, new.trial_ends_at) then
      new.subscription_status := 'trialing';
      new.plan := 'professional';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: calculate_application_score(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_application_score(application_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE

  v_job_id uuid;
  v_candidate_profile_id uuid;

  required_score int := 0;
  optional_score int := 0;
  experience_score int := 0;
  skill_level_score int := 0;

  total_score int := 0;

  v_match_label text;
  v_hiring_recommendation text;

BEGIN


  SELECT job_id, candidate_profile_id
  INTO v_job_id, v_candidate_profile_id
  FROM public.job_applications
  WHERE id = application_id;



  required_score :=
  COALESCE(
    calculate_required_skill_score(
      v_job_id,
      v_candidate_profile_id
    ), 0
  );


  optional_score :=
  COALESCE(
    calculate_optional_skill_score(
      v_job_id,
      v_candidate_profile_id
    ), 0
  );


  experience_score :=
  COALESCE(
    calculate_experience_score(
      v_job_id,
      v_candidate_profile_id
    ), 0
  );


  skill_level_score :=
  COALESCE(
    calculate_skill_proficiency_score(
      v_job_id,
      v_candidate_profile_id
    ), 0
  );



  total_score :=
    required_score +
    optional_score +
    experience_score +
    skill_level_score;



  v_match_label :=

  CASE

    WHEN total_score >= 90 THEN 'Elite'
    WHEN total_score >= 75 THEN 'Strong'
    WHEN total_score >= 60 THEN 'Good'
    WHEN total_score >= 40 THEN 'Potential'
    ELSE 'Weak'

  END;



  v_hiring_recommendation :=

  CASE

    WHEN total_score >= 75 THEN 'Interview Recommended'
    WHEN total_score >= 50 THEN 'Consider'
    ELSE 'Not Recommended'

  END;



  UPDATE public.job_applications

  SET

    score = total_score,


    score_breakdown = jsonb_build_object(

      'required', required_score,

      'optional', optional_score,

      'experience', experience_score,

      'skill_level', skill_level_score

    ),


    match_label = v_match_label,


    hiring_recommendation = v_hiring_recommendation


  WHERE id = application_id;



  UPDATE public.job_applications ja

  SET rank = ranked.rank

  FROM (

    SELECT

      id,

      RANK() OVER (

        PARTITION BY job_id

        ORDER BY score DESC

      ) AS rank

    FROM public.job_applications

    WHERE job_id = v_job_id

  ) ranked

  WHERE ja.id = ranked.id;



END;
$$;


--
-- Name: calculate_experience_score(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_experience_score(p_job_id uuid, p_candidate_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
with job_exp as (
  select experience_level::text as level
  from public.jobs
  where id = p_job_id
),
cand_exp as (
  select
    case
      when coalesce(years_experience, 0) < 2 then 'junior'
      when coalesce(years_experience, 0) < 5 then 'mid'
      else 'senior'
    end as level
  from public.candidate_profiles
  where id = p_candidate_id
)
select coalesce(
  case
    when job_exp.level = cand_exp.level then 15
    when (
      job_exp.level = 'mid'
      and cand_exp.level in ('junior', 'senior')
    ) or (
      job_exp.level = 'junior'
      and cand_exp.level = 'mid'
    ) or (
      job_exp.level = 'senior'
      and cand_exp.level = 'mid'
    ) then 8
    else 0
  end,
  0
)::integer
from job_exp, cand_exp;
$$;


--
-- Name: calculate_final_match_score(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_final_match_score(p_job_id uuid, p_candidate_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
SELECT
  LEAST(
    ROUND(
      calculate_required_skill_score(p_job_id, p_candidate_id)
    + calculate_optional_skill_score(p_job_id, p_candidate_id)
    + calculate_skill_proficiency_score(p_job_id, p_candidate_id)
    + calculate_experience_score(p_job_id, p_candidate_id)
    ),
    100
  )::integer;
$$;


--
-- Name: calculate_optional_skill_score(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_optional_skill_score(p_job_id uuid, p_candidate_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
with job_required as (
  select distinct skill_id
  from public.job_skills
  where job_id = p_job_id
    and required = true
    and skill_id is not null
),
candidate_extra as (
  select distinct
    coalesce(cs.skill_id::text, lower(trim(cs.skill))) as skill_key
  from public.candidate_skills cs
  where cs.candidate_profile_id = p_candidate_id
    and (
      cs.skill_id is null
      or cs.skill_id not in (select skill_id from job_required)
    )
    and coalesce(trim(cs.skill), '') <> ''
),
extra_count as (
  select count(*)::integer as total
  from candidate_extra
)
select coalesce(least(total * 4, 20), 0)::integer
from extra_count;
$$;


--
-- Name: calculate_required_skill_score(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_required_skill_score(p_job_id uuid, p_candidate_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
with job_req as (
  select distinct skill_id
  from public.job_skills
  where job_id = p_job_id
    and required = true
),
candidate_skills_dedup as (
  select distinct skill_id
  from public.candidate_skills
  where candidate_profile_id = p_candidate_id
),
matched_required as (
  select count(*)::numeric as matched
  from job_req jr
  join candidate_skills_dedup cs
    on cs.skill_id = jr.skill_id
),
total_required as (
  select count(*)::numeric as total
  from job_req
)
select coalesce(
  case
    when total = 0 then 50
    else least(round((matched / total) * 50), 50)
  end,
  0
)::integer
from matched_required, total_required;
$$;


--
-- Name: calculate_skill_match(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_skill_match(p_job_id uuid, p_candidate_profile_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
select least(
  coalesce(public.calculate_required_skill_score(p_job_id, p_candidate_profile_id), 0) +
  coalesce(public.calculate_optional_skill_score(p_job_id, p_candidate_profile_id), 0) +
  coalesce(public.calculate_skill_proficiency_score(p_job_id, p_candidate_profile_id), 0) +
  coalesce(public.calculate_experience_score(p_job_id, p_candidate_profile_id), 0),
  100
)::integer;
$$;


--
-- Name: calculate_skill_proficiency_score(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_skill_proficiency_score(p_job_id uuid, p_candidate_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
with matched_skills as (
  select cs.level
  from public.job_skills js
  join public.candidate_skills cs
    on cs.skill_id = js.skill_id
  where js.job_id = p_job_id
    and cs.candidate_profile_id = p_candidate_id
),
weighted as (
  select
    case level
      when 'beginner' then 0.5
      when 'intermediate' then 0.8
      when 'advanced' then 1.0
      when 'expert' then 1.0
      else 0.5
    end as weight
  from matched_skills
)
select coalesce(least(round(coalesce(avg(weight), 0) * 15), 15), 0)::integer
from weighted;
$$;


--
-- Name: close_expired_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_expired_jobs() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_updated integer := 0;
begin
  update public.jobs
  set status = 'closed'
  where status = 'open'
    and expires_at <= now();

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;


--
-- Name: create_or_get_conversation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_or_get_conversation(p_candidate_profile_id uuid DEFAULT NULL::uuid, p_employer_profile_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_employer_profile_id uuid;
  v_candidate_profile_id uuid;
  v_conversation_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ep.id
  into v_employer_profile_id
  from public.employer_profiles ep
  where ep.user_id = v_auth_user_id
  limit 1;

  select cp.id
  into v_candidate_profile_id
  from public.candidate_profiles cp
  where cp.user_id = v_auth_user_id
  limit 1;

  if v_employer_profile_id is not null then
    if p_candidate_profile_id is null then
      raise exception 'Candidate profile is required';
    end if;

    insert into public.conversations (employer_id, candidate_profile_id, created_by)
    values (v_employer_profile_id, p_candidate_profile_id, v_auth_user_id)
    on conflict (employer_id, candidate_profile_id)
    do update set employer_id = excluded.employer_id
    returning id into v_conversation_id;

    return v_conversation_id;
  end if;

  if v_candidate_profile_id is not null then
    if p_employer_profile_id is null then
      raise exception 'Employer profile is required';
    end if;

    insert into public.conversations (employer_id, candidate_profile_id, created_by)
    values (p_employer_profile_id, v_candidate_profile_id, v_auth_user_id)
    on conflict (employer_id, candidate_profile_id)
    do update set employer_id = excluded.employer_id
    returning id into v_conversation_id;

    return v_conversation_id;
  end if;

  raise exception 'No employer or candidate profile found for current user';
end;
$$;


--
-- Name: enforce_job_plan_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_job_plan_limits() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_plan text;
  v_open_jobs integer;
  v_job_limit integer;
  v_effective_limit integer;
  v_credit_id uuid;
  v_trial_granted boolean := false;
  v_trial_started_at timestamptz;
  v_trial_ends_at timestamptz;
  v_trial_active boolean := false;
begin
  if new.employer_id is null then
    return new;
  end if;

  if coalesce(new.status, 'open') <> 'open' then
    return new;
  end if;

  select
    lower(coalesce(ep.plan, 'free')),
    coalesce(ep.trial_granted, false),
    ep.trial_started_at,
    ep.trial_ends_at
  into
    v_plan,
    v_trial_granted,
    v_trial_started_at,
    v_trial_ends_at
  from public.employer_profiles ep
  where ep.id = new.employer_id;

  if v_plan is null then
    v_plan := 'free';
  end if;

  v_trial_active := public.is_employer_trial_active(
    v_trial_granted,
    v_trial_started_at,
    v_trial_ends_at
  );

  if v_trial_active then
    v_plan := 'professional';
  end if;

  if v_plan = 'enterprise' then
    return new;
  end if;

  select p.job_limit
  into v_job_limit
  from public.plans p
  where lower(p.name) = v_plan
  limit 1;

  v_effective_limit := case
    when v_job_limit is not null and v_job_limit > 0 then v_job_limit
    when v_plan = 'starter' then 5
    when v_plan = 'professional' then 20
    else 1
  end;

  select count(*)::integer
  into v_open_jobs
  from public.jobs j
  where j.employer_id = new.employer_id
    and j.status = 'open'
    and (tg_op <> 'UPDATE' or j.id <> new.id);

  if v_open_jobs >= v_effective_limit then
    update public.employer_credits ec
    set remaining = ec.remaining - 1
    where ec.employer_id = new.employer_id
      and ec.credit_type = 'job_slot'
      and ec.remaining > 0
    returning ec.id into v_credit_id;

    if v_credit_id is null then
      raise exception 'PLAN_LIMIT_REACHED'
        using errcode = 'P0001',
              detail = format('Plan %s allows %s open jobs and no job_slot credits are available.', v_plan, v_effective_limit);
    end if;

    insert into public.employer_credit_usage (
      employer_id,
      credit_type,
      amount,
      context_type,
      context_id,
      metadata
    )
    values (
      new.employer_id,
      'job_slot',
      1,
      'job',
      new.id,
      jsonb_build_object(
        'reason', 'plan_limit_overflow',
        'plan', v_plan,
        'limit', v_effective_limit
      )
    );
  end if;

  return new;
end;
$$;


--
-- Name: enforce_messages_read_receipt_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_messages_read_receipt_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Allow only read_at to change.
  if new.conversation_id is distinct from old.conversation_id
     or new.sender_user_id is distinct from old.sender_user_id
     or new.sender_role is distinct from old.sender_role
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read receipts can be updated on messages';
  end if;

  -- read_at can only transition once from null to non-null.
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Message read_at cannot be changed once set';
  end if;

  if old.read_at is null and new.read_at is null then
    raise exception 'Message update must set read_at';
  end if;

  -- Sender cannot mark their own message as read.
  if new.sender_user_id = auth.uid() then
    raise exception 'Cannot mark your own message as read';
  end if;

  return new;
end;
$$;


--
-- Name: enforce_premium_job_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_premium_job_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.role() = 'authenticated'
     and (
       new.is_featured is distinct from old.is_featured
       or new.featured_until is distinct from old.featured_until
     ) then
    raise exception 'FEATURED_JOB_REQUIRES_CREDIT'
      using errcode = 'P0001',
            detail = 'Use the feature-job edge function to set featured fields.';
  end if;

  return new;
end;
$$;


--
-- Name: expire_elapsed_employer_trials(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_elapsed_employer_trials() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_updated integer := 0;
begin
  update public.employer_profiles ep
  set
    subscription_status = 'inactive',
    plan = 'free'
  where ep.subscription_status = 'trialing'
    and ep.trial_granted = true
    and ep.trial_ends_at is not null
    and ep.trial_ends_at <= now();

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;


--
-- Name: get_current_candidate_profile_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_candidate_profile_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select cp.id
  from public.candidate_profiles cp
  where cp.user_id = auth.uid()
  limit 1
$$;


--
-- Name: get_current_employer_profile_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_employer_profile_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select ep.id
  from public.employer_profiles ep
  where ep.user_id = auth.uid()
  limit 1
$$;


--
-- Name: grant_addon_credits(text, uuid, uuid, integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_addon_credits(p_reference text, p_employer_id uuid, p_addon_id uuid, p_amount_paid integer, p_credit_type text, p_credits_to_add integer) RETURNS TABLE(purchase_id uuid, credits_added integer, already_processed boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_purchase_id uuid;
  v_existing_credits integer;
  v_purchase_employer_id uuid;
  v_purchase_addon_id uuid;
  v_credit_delta integer;
begin
  if coalesce(trim(p_reference), '') = '' then
    raise exception 'reference is required';
  end if;

  if p_employer_id is null then
    raise exception 'employer id is required';
  end if;

  if p_addon_id is null then
    raise exception 'addon id is required';
  end if;

  if coalesce(trim(p_credit_type), '') = '' then
    raise exception 'credit type is required';
  end if;

  if coalesce(p_credits_to_add, 0) <= 0 then
    raise exception 'credits_to_add must be greater than zero';
  end if;

  insert into public.employer_addon_purchases (
    employer_id,
    addon_id,
    reference,
    amount_paid,
    status,
    credits_added
  )
  values (
    p_employer_id,
    p_addon_id,
    p_reference,
    greatest(coalesce(p_amount_paid, 0), 0),
    'success',
    0
  )
  on conflict (reference) do nothing;

  select
    id,
    employer_id,
    addon_id,
    coalesce(credits_added, 0)
  into
    v_purchase_id,
    v_purchase_employer_id,
    v_purchase_addon_id,
    v_existing_credits
  from public.employer_addon_purchases
  where reference = p_reference
  for update;

  if v_purchase_id is null then
    raise exception 'failed to resolve purchase row for reference %', p_reference;
  end if;

  if v_purchase_employer_id <> p_employer_id then
    raise exception 'reference % belongs to a different employer', p_reference;
  end if;

  if v_purchase_addon_id <> p_addon_id then
    raise exception 'reference % belongs to a different add-on', p_reference;
  end if;

  if v_existing_credits >= p_credits_to_add then
    return query
    select v_purchase_id, v_existing_credits, true;
    return;
  end if;

  v_credit_delta := p_credits_to_add - v_existing_credits;

  insert into public.employer_credits (
    employer_id,
    credit_type,
    remaining
  )
  values (
    p_employer_id,
    p_credit_type,
    v_credit_delta
  )
  on conflict (employer_id, credit_type)
  do update
  set remaining = public.employer_credits.remaining + excluded.remaining;

  update public.employer_addon_purchases
  set
    status = 'success',
    amount_paid = greatest(coalesce(amount_paid, 0), greatest(coalesce(p_amount_paid, 0), 0)),
    credits_added = p_credits_to_add
  where id = v_purchase_id;

  return query
  select v_purchase_id, p_credits_to_add, false;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- create profile (always)
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'role'
  );

  -- create employer profile ONLY if role = employer
  IF NEW.raw_user_meta_data->>'role' = 'employer' THEN
    INSERT INTO public.employer_profiles (user_id, company_name)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'company_name'
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: is_conversation_participant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_conversation_participant(conversation_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.conversations c
    join public.employer_profiles ep on ep.id = c.employer_id
    join public.candidate_profiles cp on cp.id = c.candidate_profile_id
    where c.id = conversation_uuid
      and (ep.user_id = auth.uid() or cp.user_id = auth.uid())
  )
$$;


--
-- Name: is_current_user_candidate_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_current_user_candidate_profile(p_candidate_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = p_candidate_profile_id
      and cp.user_id = auth.uid()
  );
$$;


--
-- Name: is_current_user_employer_for_job(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_current_user_employer_for_job(p_job_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = p_job_id
      and ep.user_id = auth.uid()
  );
$$;


--
-- Name: is_employer_trial_active(boolean, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_employer_trial_active(p_trial_granted boolean, p_trial_started_at timestamp with time zone, p_trial_ends_at timestamp with time zone) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select
    coalesce(p_trial_granted, false)
    and p_trial_started_at is not null
    and p_trial_ends_at is not null
    and now() >= p_trial_started_at
    and now() < p_trial_ends_at
$$;


--
-- Name: match_candidates(extensions.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_candidates(job_embedding extensions.vector, match_threshold double precision, match_count integer) RETURNS TABLE(id uuid, full_name text, headline text, similarity double precision)
    LANGUAGE sql STABLE
    AS $$
  select
    candidate_profiles.id,
    candidate_profiles.full_name,
    candidate_profiles.headline,
    1 - (candidate_profiles.embedding <=> job_embedding) as similarity
  from candidate_profiles
  where candidate_profiles.embedding is not null
  and 1 - (candidate_profiles.embedding <=> job_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;


--
-- Name: match_candidates_with_scores(uuid, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_candidates_with_scores(p_job_id uuid, p_match_threshold double precision DEFAULT 0.4, p_match_count integer DEFAULT 20) RETURNS TABLE(id uuid, similarity double precision, skill_score integer, hybrid_score integer, match_label text, hiring_recommendation text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_job_embedding vector;
begin
  select j.embedding
  into v_job_embedding
  from public.jobs j
  where j.id = p_job_id;

  if v_job_embedding is null then
    raise exception 'Job embedding not found for job %', p_job_id;
  end if;

  return query
  with matched as (
    select
      m.id,
      m.similarity
    from public.match_candidates(
      job_embedding => v_job_embedding,
      match_threshold => p_match_threshold,
      match_count => p_match_count
    ) m
  ),
  scored as (
    select
      matched.id,
      matched.similarity,
      public.calculate_skill_match(p_job_id, matched.id) as skill_score
    from matched
  ),
  final_scores as (
    select
      scored.id,
      scored.similarity,
      scored.skill_score,
      least(
        100,
        greatest(
          0,
          round((scored.skill_score * 0.7) + ((scored.similarity * 100) * 0.3))
        )
      )::integer as hybrid_score
    from scored
  )
  select
    fs.id,
    fs.similarity,
    fs.skill_score,
    fs.hybrid_score,
    case
      when fs.hybrid_score >= 90 then 'Elite'
      when fs.hybrid_score >= 75 then 'Strong'
      when fs.hybrid_score >= 60 then 'Good'
      when fs.hybrid_score >= 40 then 'Potential'
      else 'Weak'
    end as match_label,
    case
      when fs.hybrid_score >= 75 then 'Interview Recommended'
      when fs.hybrid_score >= 50 then 'Consider'
      else 'Not Recommended'
    end as hiring_recommendation
  from final_scores fs
  order by fs.hybrid_score desc, fs.similarity desc;
end;
$$;


--
-- Name: on_candidate_profile_scoring_fields_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_candidate_profile_scoring_fields_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.recompute_candidate_application_scores(new.id);
  return new;
end;
$$;


--
-- Name: on_candidate_skill_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_candidate_skill_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_candidate_application_scores(old.candidate_profile_id);
    return old;
  end if;

  perform public.recompute_candidate_application_scores(new.candidate_profile_id);
  return new;
end;
$$;


--
-- Name: recompute_candidate_application_scores(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompute_candidate_application_scores(p_candidate_profile_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.job_applications
  set job_id = job_id
  where candidate_profile_id = p_candidate_profile_id;
$$;


--
-- Name: refresh_job_application_rankings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_job_application_rankings(p_job_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.job_applications ja
  set rank = ranked.rank
  from (
    select
      id,
      rank() over (
        partition by job_id
        order by score desc nulls last, created_at asc
      ) as rank
    from public.job_applications
    where job_id = p_job_id
  ) ranked
  where ja.id = ranked.id;
$$;


--
-- Name: refresh_rank_after_job_application_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_rank_after_job_application_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_job_application_rankings(old.job_id);
    return old;
  end if;

  perform public.refresh_job_application_rankings(new.job_id);
  return new;
end;
$$;


--
-- Name: set_application_score(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_application_score() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.score :=
    calculate_final_match_score(NEW.job_id, NEW.candidate_profile_id);
  RETURN NEW;
END;
$$;


--
-- Name: set_employer_credit_usage_month(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_employer_credit_usage_month() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.usage_month := date_trunc(
    'month',
    coalesce(new.created_at, now()) at time zone 'UTC'
  )::date;
  return new;
end;
$$;


--
-- Name: sync_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.users (
    id,
    email,
    password_hash,
    is_active,
    email_verified,
    created_at,
    updated_at
  ) values (
    new.id,
    new.email,
    new.password_hash,
    true,                   -- default active
    new.email_confirmed,    -- or false if you want
    now(),
    now()
  );
  return new;
end;
$$;


--
-- Name: sync_conversation_on_message_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_conversation_on_message_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_preview = left(new.body, 240),
    last_message_sender_role = new.sender_role
  where id = new.conversation_id;

  return new;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: trigger_auto_match(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_auto_match() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin

perform net.http_post(

  url := 'https://vhvmblkezqkbjbwburko.supabase.co/functions/v1/auto-match',

  headers := jsonb_build_object(
    'Content-Type', 'application/json'
  ),

  body := jsonb_build_object(
    'job_id', new.id
  )

);

return new;

end;
$$;


--
-- Name: update_application_score(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_application_score(application_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  required_score int := 0;
  optional_score int := 0;
  experience_score int := 0;
  skill_level_score int := 0;
  total_score int;
BEGIN
  -- REQUIRED SKILLS (max 50)
  SELECT LEAST(
    (COUNT(*)::float / NULLIF(COUNT(js.skill_id), 0)) * 50,
    50
  )::int
  INTO required_score
  FROM job_skills js
  JOIN candidate_skills cs ON cs.skill_id = js.skill_id
  JOIN job_applications ja ON ja.job_id = js.job_id
  WHERE js.required = true
    AND ja.id = application_id;

  -- OPTIONAL SKILLS (max 20)
  SELECT LEAST(COUNT(*) * 5, 20)
  INTO optional_score
  FROM job_skills js
  JOIN candidate_skills cs ON cs.skill_id = js.skill_id
  JOIN job_applications ja ON ja.job_id = js.job_id
  WHERE js.required = false
    AND ja.id = application_id;

  -- EXPERIENCE (max 15)
  SELECT CASE
    WHEN cp.years_experience >= j.min_years_experience THEN 15
    ELSE 0
  END
  INTO experience_score
  FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  JOIN candidate_profiles cp ON cp.id = ja.candidate_profile_id
  WHERE ja.id = application_id;

  -- SKILL LEVEL (max 15)
  SELECT LEAST(COUNT(*) * 5, 15)
  INTO skill_level_score
  FROM candidate_skills cs
  JOIN job_skills js ON js.skill_id = cs.skill_id
  JOIN job_applications ja ON ja.job_id = js.job_id
  WHERE ja.id = application_id
    AND cs.level IN ('intermediate', 'advanced');

  total_score :=
    required_score +
    optional_score +
    experience_score +
    skill_level_score;

  UPDATE job_applications
  SET
    score = total_score,
    score_breakdown = jsonb_build_object(
      'required', required_score,
      'optional', optional_score,
      'experience', experience_score,
      'skill_level', skill_level_score
    )
  WHERE id = application_id;
END;
$$;


--
-- Name: update_application_score(uuid, integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_application_score(p_application_id uuid, p_total_score integer, p_required_score integer, p_optional_score integer, p_experience_score integer, p_skill_level_score integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE job_applications
  SET
    score = p_total_score,
    score_breakdown = jsonb_build_object(
      'required', p_required_score,
      'optional', p_optional_score,
      'experience', p_experience_score,
      'skill_level', p_skill_level_score
    )
  WHERE id = p_application_id;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price integer NOT NULL,
    type text NOT NULL,
    credits integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(200) NOT NULL,
    skill_id uuid,
    difficulty character varying(50),
    duration_minutes integer,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: billing_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employer_id uuid NOT NULL,
    provider text DEFAULT 'paystack'::text NOT NULL,
    provider_reference text,
    invoice_number text NOT NULL,
    kind text NOT NULL,
    status text NOT NULL,
    currency text DEFAULT 'ZAR'::text NOT NULL,
    amount_kobo bigint DEFAULT 0 NOT NULL,
    vat_kobo bigint DEFAULT 0 NOT NULL,
    total_kobo bigint DEFAULT 0 NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    storage_path text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_invoices_kind_check CHECK ((kind = ANY (ARRAY['subscription'::text, 'addon'::text]))),
    CONSTRAINT billing_invoices_status_check CHECK ((status = ANY (ARRAY['paid'::text, 'pending'::text, 'failed'::text, 'refunded'::text, 'void'::text])))
);


--
-- Name: candidate_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    name text NOT NULL,
    progress integer,
    status text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT candidate_assessments_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT candidate_assessments_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: candidate_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    name text NOT NULL,
    issuer text,
    issued_at date,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: candidate_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    headline text,
    bio text,
    location text,
    years_experience integer,
    cv_url text,
    created_at timestamp with time zone DEFAULT now(),
    experience_level public.experience_level_enum NOT NULL,
    availability text,
    preferred_job_type text,
    work_mode text,
    updated_at timestamp with time zone DEFAULT now(),
    embedding extensions.vector(1536),
    resume_text text,
    resume_summary text,
    professional_bio_ai text,
    resume_analysis jsonb DEFAULT '{}'::jsonb NOT NULL,
    resume_last_analyzed_at timestamp with time zone
);


--
-- Name: candidate_resumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_resumes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_profile_id uuid NOT NULL,
    file_path text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: candidate_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_profile_id uuid NOT NULL,
    skill text NOT NULL,
    level text,
    created_at timestamp with time zone DEFAULT now(),
    skill_id uuid NOT NULL,
    CONSTRAINT candidate_skills_level_check CHECK ((level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'expert'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employer_id uuid NOT NULL,
    candidate_profile_id uuid NOT NULL,
    job_application_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone,
    last_message_preview text,
    last_message_sender_role text,
    CONSTRAINT conversations_last_message_sender_role_check CHECK ((last_message_sender_role = ANY (ARRAY['employer'::text, 'candidate'::text])))
);


--
-- Name: employer_addon_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employer_addon_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employer_id uuid NOT NULL,
    addon_id uuid NOT NULL,
    reference text NOT NULL,
    amount_paid integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'success'::text NOT NULL,
    credits_added integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employer_credit_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employer_credit_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employer_id uuid NOT NULL,
    credit_type text NOT NULL,
    amount integer DEFAULT 1 NOT NULL,
    context_type text,
    context_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    usage_month date NOT NULL
);


--
-- Name: employer_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employer_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employer_id uuid NOT NULL,
    credit_type text NOT NULL,
    remaining integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT employer_credits_remaining_non_negative CHECK ((remaining >= 0))
);


--
-- Name: employer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employer_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_name text NOT NULL,
    industry text,
    company_size text,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    onboarding_step integer DEFAULT 0,
    plan text DEFAULT 'free'::text,
    subscription_status text DEFAULT 'inactive'::text NOT NULL,
    paystack_customer_code text,
    paystack_subscription_code text,
    paystack_subscription_email_token text,
    current_period_end timestamp with time zone,
    description text,
    website text,
    contact_email text,
    phone text,
    address text,
    logo_url text,
    show_on_platform boolean DEFAULT true NOT NULL,
    public_company_page boolean DEFAULT true NOT NULL,
    trial_granted boolean DEFAULT false NOT NULL,
    trial_started_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    selected_plan text,
    CONSTRAINT employer_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'starter'::text, 'professional'::text, 'enterprise'::text]))),
    CONSTRAINT employer_selected_plan_check CHECK (((selected_plan IS NULL) OR (selected_plan = ANY (ARRAY['free'::text, 'starter'::text, 'professional'::text, 'enterprise'::text])))),
    CONSTRAINT employer_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['inactive'::text, 'active'::text, 'past_due'::text, 'cancelled'::text, 'trialing'::text, 'pending_payment'::text])))
);


--
-- Name: job_ai_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_ai_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    employer_id uuid NOT NULL,
    report jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    candidate_profile_id uuid NOT NULL,
    status text DEFAULT 'applied'::text,
    score integer,
    created_at timestamp with time zone DEFAULT now(),
    score_breakdown jsonb DEFAULT '{}'::jsonb,
    match_label text,
    hiring_recommendation text,
    rank integer,
    CONSTRAINT job_applications_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100)))),
    CONSTRAINT job_applications_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'shortlisted'::text, 'rejected'::text, 'hired'::text])))
);


--
-- Name: job_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    candidate_id uuid,
    similarity double precision,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: job_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_skills (
    job_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    min_score integer,
    required boolean DEFAULT true,
    CONSTRAINT job_skills_min_score_check CHECK (((min_score >= 0) AND (min_score <= 100)))
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employer_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    location text,
    employment_type text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    experience_level public.experience_level_enum NOT NULL,
    embedding extensions.vector(1536),
    is_featured boolean DEFAULT false NOT NULL,
    featured_until timestamp with time zone,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    sender_role text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT messages_body_check CHECK ((length(TRIM(BOTH FROM body)) > 0)),
    CONSTRAINT messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['employer'::text, 'candidate'::text])))
);


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'paystack'::text NOT NULL,
    event_key text NOT NULL,
    event_name text NOT NULL,
    reference text,
    status text DEFAULT 'received'::text NOT NULL,
    last_error text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_webhook_events_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'failed'::text])))
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price_monthly integer NOT NULL,
    job_limit integer,
    user_limit integer,
    candidate_view_limit integer,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    price_yearly integer,
    paystack_plan_code text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role text,
    full_name text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['candidate'::text, 'employer'::text, 'admin'::text])))
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(50) NOT NULL,
    description text
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(150) NOT NULL,
    category character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: addons addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_pkey PRIMARY KEY (id);


--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);


--
-- Name: billing_invoices billing_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_pkey PRIMARY KEY (id);


--
-- Name: candidate_assessments candidate_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_assessments
    ADD CONSTRAINT candidate_assessments_pkey PRIMARY KEY (id);


--
-- Name: candidate_certifications candidate_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_certifications
    ADD CONSTRAINT candidate_certifications_pkey PRIMARY KEY (id);


--
-- Name: candidate_profiles candidate_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_profiles
    ADD CONSTRAINT candidate_profiles_pkey PRIMARY KEY (id);


--
-- Name: candidate_profiles candidate_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_profiles
    ADD CONSTRAINT candidate_profiles_user_id_key UNIQUE (user_id);


--
-- Name: candidate_resumes candidate_resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_resumes
    ADD CONSTRAINT candidate_resumes_pkey PRIMARY KEY (id);


--
-- Name: candidate_skills candidate_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_skills
    ADD CONSTRAINT candidate_skills_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_unique_participants; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_unique_participants UNIQUE (employer_id, candidate_profile_id);


--
-- Name: employer_addon_purchases employer_addon_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_addon_purchases
    ADD CONSTRAINT employer_addon_purchases_pkey PRIMARY KEY (id);


--
-- Name: employer_addon_purchases employer_addon_purchases_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_addon_purchases
    ADD CONSTRAINT employer_addon_purchases_reference_key UNIQUE (reference);


--
-- Name: employer_credit_usage employer_credit_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_credit_usage
    ADD CONSTRAINT employer_credit_usage_pkey PRIMARY KEY (id);


--
-- Name: employer_credits employer_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_credits
    ADD CONSTRAINT employer_credits_pkey PRIMARY KEY (id);


--
-- Name: employer_profiles employer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_profiles
    ADD CONSTRAINT employer_profiles_pkey PRIMARY KEY (id);


--
-- Name: employer_profiles employer_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_profiles
    ADD CONSTRAINT employer_profiles_user_id_key UNIQUE (user_id);


--
-- Name: job_ai_reports job_ai_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_ai_reports
    ADD CONSTRAINT job_ai_reports_pkey PRIMARY KEY (id);


--
-- Name: job_applications job_applications_job_id_candidate_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_candidate_profile_id_key UNIQUE (job_id, candidate_profile_id);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (id);


--
-- Name: job_matches job_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_matches
    ADD CONSTRAINT job_matches_pkey PRIMARY KEY (id);


--
-- Name: job_skills job_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_skills
    ADD CONSTRAINT job_skills_pkey PRIMARY KEY (job_id, skill_id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_event_key_key UNIQUE (event_key);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: plans plans_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_name_unique UNIQUE (name);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: skills skills_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_name_key UNIQUE (name);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: candidate_skills unique_candidate_skill; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_skills
    ADD CONSTRAINT unique_candidate_skill UNIQUE (candidate_profile_id, skill);


--
-- Name: job_skills unique_job_skill; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_skills
    ADD CONSTRAINT unique_job_skill UNIQUE (job_id, skill_id);


--
-- Name: billing_invoices_employer_issued_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX billing_invoices_employer_issued_at_idx ON public.billing_invoices USING btree (employer_id, issued_at DESC);


--
-- Name: billing_invoices_invoice_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX billing_invoices_invoice_number_key ON public.billing_invoices USING btree (invoice_number);


--
-- Name: billing_invoices_provider_ref_kind_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX billing_invoices_provider_ref_kind_key ON public.billing_invoices USING btree (provider, provider_reference, kind) WHERE (provider_reference IS NOT NULL);


--
-- Name: billing_invoices_provider_reference_kind_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX billing_invoices_provider_reference_kind_key ON public.billing_invoices USING btree (provider, provider_reference, kind) WHERE (provider_reference IS NOT NULL);


--
-- Name: candidate_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_profiles_user_id_idx ON public.candidate_profiles USING btree (user_id);


--
-- Name: candidate_skills_candidate_skill_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_skills_candidate_skill_idx ON public.candidate_skills USING btree (candidate_profile_id, skill_id);


--
-- Name: candidate_skills_skill_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_skills_skill_candidate_idx ON public.candidate_skills USING btree (skill_id, candidate_profile_id);


--
-- Name: conversations_candidate_last_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_candidate_last_message_idx ON public.conversations USING btree (candidate_profile_id, last_message_at DESC NULLS LAST, created_at DESC);


--
-- Name: conversations_employer_last_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_employer_last_message_idx ON public.conversations USING btree (employer_id, last_message_at DESC NULLS LAST, created_at DESC);


--
-- Name: employer_credit_usage_employer_context_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employer_credit_usage_employer_context_created_at_idx ON public.employer_credit_usage USING btree (employer_id, context_type, created_at DESC);


--
-- Name: employer_credit_usage_unique_candidate_view_monthly; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employer_credit_usage_unique_candidate_view_monthly ON public.employer_credit_usage USING btree (employer_id, context_id, usage_month) WHERE ((context_type = 'candidate_profile_view'::text) AND (context_id IS NOT NULL));


--
-- Name: employer_credits_employer_credit_type_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employer_credits_employer_credit_type_unique ON public.employer_credits USING btree (employer_id, credit_type);


--
-- Name: employer_profiles_paystack_customer_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employer_profiles_paystack_customer_code_key ON public.employer_profiles USING btree (paystack_customer_code) WHERE (paystack_customer_code IS NOT NULL);


--
-- Name: employer_profiles_paystack_subscription_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employer_profiles_paystack_subscription_code_key ON public.employer_profiles USING btree (paystack_subscription_code) WHERE (paystack_subscription_code IS NOT NULL);


--
-- Name: employer_profiles_trial_ends_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employer_profiles_trial_ends_at_idx ON public.employer_profiles USING btree (trial_ends_at) WHERE (subscription_status = 'trialing'::text);


--
-- Name: employer_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employer_profiles_user_id_idx ON public.employer_profiles USING btree (user_id);


--
-- Name: idx_candidate_profiles_experience_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_profiles_experience_level ON public.candidate_profiles USING btree (experience_level);


--
-- Name: idx_jobs_experience_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_experience_level ON public.jobs USING btree (experience_level);


--
-- Name: job_ai_reports_job_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_ai_reports_job_id_created_at_idx ON public.job_ai_reports USING btree (job_id, created_at DESC);


--
-- Name: job_applications_candidate_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_applications_candidate_profile_idx ON public.job_applications USING btree (candidate_profile_id, created_at DESC);


--
-- Name: job_applications_job_score_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_applications_job_score_created_at_idx ON public.job_applications USING btree (job_id, score DESC, created_at DESC);


--
-- Name: job_applications_job_status_score_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_applications_job_status_score_created_at_idx ON public.job_applications USING btree (job_id, status, score DESC, created_at DESC);


--
-- Name: job_matches_job_candidate_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX job_matches_job_candidate_unique ON public.job_matches USING btree (job_id, candidate_id) WHERE ((job_id IS NOT NULL) AND (candidate_id IS NOT NULL));


--
-- Name: job_skills_job_required_skill_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_skills_job_required_skill_idx ON public.job_skills USING btree (job_id, required, skill_id);


--
-- Name: jobs_employer_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_employer_created_at_idx ON public.jobs USING btree (employer_id, created_at DESC);


--
-- Name: jobs_employer_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_employer_status_created_at_idx ON public.jobs USING btree (employer_id, status, created_at DESC);


--
-- Name: jobs_open_featured_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_open_featured_created_at_idx ON public.jobs USING btree (status, is_featured DESC, created_at DESC) WHERE (status = 'open'::text);


--
-- Name: jobs_status_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_status_expires_at_idx ON public.jobs USING btree (status, expires_at DESC);


--
-- Name: messages_conversation_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_created_at_idx ON public.messages USING btree (conversation_id, created_at);


--
-- Name: messages_conversation_sender_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_sender_unread_idx ON public.messages USING btree (conversation_id, sender_role, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: messages_unread_by_conversation_sender_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_unread_by_conversation_sender_user_idx ON public.messages USING btree (conversation_id, sender_user_id) WHERE (read_at IS NULL);


--
-- Name: payment_webhook_events_provider_event_received_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_webhook_events_provider_event_received_idx ON public.payment_webhook_events USING btree (provider, event_name, received_at DESC);


--
-- Name: payment_webhook_events_status_received_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_webhook_events_status_received_idx ON public.payment_webhook_events USING btree (status, received_at DESC);


--
-- Name: plans_name_lower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plans_name_lower_idx ON public.plans USING btree (lower(name));


--
-- Name: jobs auto_match_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_match_trigger AFTER INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_match();


--
-- Name: job_applications job_application_score_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER job_application_score_trigger BEFORE INSERT ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.set_application_score();


--
-- Name: messages messages_after_insert_sync_conversation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_after_insert_sync_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_on_message_insert();


--
-- Name: messages messages_before_update_enforce_read_receipt; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_before_update_enforce_read_receipt BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.enforce_messages_read_receipt_update();


--
-- Name: payment_webhook_events payment_webhook_events_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_webhook_events_touch_updated_at BEFORE UPDATE ON public.payment_webhook_events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: job_applications trg_apply_job_application_scoring; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apply_job_application_scoring BEFORE INSERT OR UPDATE OF job_id, candidate_profile_id ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.apply_job_application_scoring();


--
-- Name: employer_profiles trg_assign_intro_trial_to_first_employers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_intro_trial_to_first_employers BEFORE INSERT ON public.employer_profiles FOR EACH ROW EXECUTE FUNCTION public.assign_intro_trial_to_first_employers();


--
-- Name: jobs trg_enforce_job_plan_limits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_job_plan_limits BEFORE INSERT OR UPDATE OF status ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.enforce_job_plan_limits();


--
-- Name: jobs trg_enforce_premium_job_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_premium_job_fields BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.enforce_premium_job_fields();


--
-- Name: candidate_profiles trg_recompute_scores_on_candidate_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recompute_scores_on_candidate_profile AFTER UPDATE OF years_experience, experience_level ON public.candidate_profiles FOR EACH ROW WHEN (((old.years_experience IS DISTINCT FROM new.years_experience) OR (old.experience_level IS DISTINCT FROM new.experience_level))) EXECUTE FUNCTION public.on_candidate_profile_scoring_fields_changed();


--
-- Name: candidate_skills trg_recompute_scores_on_candidate_skill; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recompute_scores_on_candidate_skill AFTER INSERT OR DELETE OR UPDATE ON public.candidate_skills FOR EACH ROW EXECUTE FUNCTION public.on_candidate_skill_changed();


--
-- Name: job_applications trg_refresh_job_application_rank_after_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_job_application_rank_after_write AFTER INSERT OR DELETE OR UPDATE OF score, job_id, candidate_profile_id ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.refresh_rank_after_job_application_write();


--
-- Name: employer_credit_usage trg_set_employer_credit_usage_month; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_employer_credit_usage_month BEFORE INSERT ON public.employer_credit_usage FOR EACH ROW EXECUTE FUNCTION public.set_employer_credit_usage_month();


--
-- Name: assessments assessments_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: billing_invoices billing_invoices_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employer_profiles(id) ON DELETE CASCADE;


--
-- Name: candidate_assessments candidate_assessments_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_assessments
    ADD CONSTRAINT candidate_assessments_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(id) ON DELETE CASCADE;


--
-- Name: candidate_certifications candidate_certifications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_certifications
    ADD CONSTRAINT candidate_certifications_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(id) ON DELETE CASCADE;


--
-- Name: candidate_profiles candidate_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_profiles
    ADD CONSTRAINT candidate_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: candidate_resumes candidate_resumes_candidate_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_resumes
    ADD CONSTRAINT candidate_resumes_candidate_profile_id_fkey FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles(id) ON DELETE CASCADE;


--
-- Name: candidate_skills candidate_skills_candidate_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_skills
    ADD CONSTRAINT candidate_skills_candidate_profile_id_fkey FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles(id) ON DELETE CASCADE;


--
-- Name: candidate_skills candidate_skills_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_skills
    ADD CONSTRAINT candidate_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: conversations conversations_candidate_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_candidate_profile_id_fkey FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: conversations conversations_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employer_profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_job_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_job_application_id_fkey FOREIGN KEY (job_application_id) REFERENCES public.job_applications(id) ON DELETE SET NULL;


--
-- Name: employer_addon_purchases employer_addon_purchases_addon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_addon_purchases
    ADD CONSTRAINT employer_addon_purchases_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.addons(id) ON DELETE RESTRICT;


--
-- Name: employer_addon_purchases employer_addon_purchases_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_addon_purchases
    ADD CONSTRAINT employer_addon_purchases_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employer_profiles(id) ON DELETE CASCADE;


--
-- Name: employer_credit_usage employer_credit_usage_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_credit_usage
    ADD CONSTRAINT employer_credit_usage_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employer_profiles(id) ON DELETE CASCADE;


--
-- Name: employer_credits employer_credits_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_credits
    ADD CONSTRAINT employer_credits_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employer_profiles(id) ON DELETE CASCADE;


--
-- Name: employer_profiles employer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employer_profiles
    ADD CONSTRAINT employer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: job_ai_reports job_ai_reports_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_ai_reports
    ADD CONSTRAINT job_ai_reports_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employer_profiles(id) ON DELETE CASCADE;


--
-- Name: job_ai_reports job_ai_reports_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_ai_reports
    ADD CONSTRAINT job_ai_reports_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_candidate_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_candidate_profile_id_fkey FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_matches job_matches_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_matches
    ADD CONSTRAINT job_matches_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(id) ON DELETE CASCADE;


--
-- Name: job_matches job_matches_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_matches
    ADD CONSTRAINT job_matches_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_skills job_skills_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_skills
    ADD CONSTRAINT job_skills_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_skills job_skills_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_skills
    ADD CONSTRAINT job_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: jobs jobs_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employer_profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: candidate_profiles Candidates can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view own profile" ON public.candidate_profiles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: candidate_profiles Employers can view candidates via jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employers can view candidates via jobs" ON public.candidate_profiles FOR SELECT USING ((id IN ( SELECT job_applications.candidate_profile_id
   FROM public.job_applications
  WHERE (job_applications.job_id IN ( SELECT jobs.id
           FROM public.jobs
          WHERE (jobs.employer_id IN ( SELECT employer_profiles.id
                   FROM public.employer_profiles
                  WHERE (employer_profiles.user_id = auth.uid()))))))));


--
-- Name: jobs Employers can view own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employers can view own jobs" ON public.jobs FOR SELECT USING ((employer_id = ( SELECT employer_profiles.id
   FROM public.employer_profiles
  WHERE (employer_profiles.user_id = auth.uid()))));


--
-- Name: jobs Employers manage own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employers manage own jobs" ON public.jobs USING ((employer_id = ( SELECT employer_profiles.id
   FROM public.employer_profiles
  WHERE (employer_profiles.user_id = auth.uid())))) WITH CHECK ((employer_id = ( SELECT employer_profiles.id
   FROM public.employer_profiles
  WHERE (employer_profiles.user_id = auth.uid()))));


--
-- Name: employer_profiles Employers manage own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employers manage own profile" ON public.employer_profiles USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: employer_profiles Public can view employer company name; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view employer company name" ON public.employer_profiles FOR SELECT USING (true);


--
-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

--
-- Name: addons addons_select_active_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY addons_select_active_authenticated ON public.addons FOR SELECT TO authenticated USING ((active = true));


--
-- Name: assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_profiles candidate owns profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "candidate owns profile" ON public.candidate_profiles USING ((user_id = auth.uid()));


--
-- Name: candidate_skills candidate owns skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "candidate owns skills" ON public.candidate_skills USING ((candidate_profile_id = ( SELECT candidate_profiles.id
   FROM public.candidate_profiles
  WHERE (candidate_profiles.user_id = auth.uid()))));


--
-- Name: candidate_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_assessments candidate_assessments_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_assessments_select_own ON public.candidate_assessments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = candidate_assessments.candidate_id) AND (cp.user_id = auth.uid())))));


--
-- Name: candidate_certifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_certifications candidate_certifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_certifications_select_own ON public.candidate_certifications FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = candidate_certifications.candidate_id) AND (cp.user_id = auth.uid())))));


--
-- Name: candidate_profiles candidate_insert_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_insert_own_profile ON public.candidate_profiles FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: candidate_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_profiles candidate_profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_profiles_insert_own ON public.candidate_profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: candidate_profiles candidate_profiles_select_for_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_profiles_select_for_authenticated ON public.candidate_profiles FOR SELECT TO authenticated USING (true);


--
-- Name: candidate_profiles candidate_profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_profiles_select_own ON public.candidate_profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: candidate_profiles candidate_profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_profiles_update_own ON public.candidate_profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: candidate_resumes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_resumes ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_resumes candidate_resumes_select_own_or_related_employer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_resumes_select_own_or_related_employer ON public.candidate_resumes FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = candidate_resumes.candidate_profile_id) AND (cp.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM ((public.job_applications ja
     JOIN public.jobs j ON ((j.id = ja.job_id)))
     JOIN public.employer_profiles ep ON ((ep.id = j.employer_id)))
  WHERE ((ja.candidate_profile_id = candidate_resumes.candidate_profile_id) AND (ep.user_id = auth.uid()))))));


--
-- Name: candidate_profiles candidate_select_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_select_own_profile ON public.candidate_profiles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: candidate_skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_skills candidate_skills_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_skills_delete_own ON public.candidate_skills FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = candidate_skills.candidate_profile_id) AND (cp.user_id = auth.uid())))));


--
-- Name: candidate_skills candidate_skills_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_skills_insert_own ON public.candidate_skills FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = candidate_skills.candidate_profile_id) AND (cp.user_id = auth.uid())))));


--
-- Name: candidate_skills candidate_skills_select_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_skills_select_all_authenticated ON public.candidate_skills FOR SELECT TO authenticated USING (true);


--
-- Name: candidate_skills candidate_skills_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_skills_update_own ON public.candidate_skills FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = candidate_skills.candidate_profile_id) AND (cp.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = candidate_skills.candidate_profile_id) AND (cp.user_id = auth.uid())))));


--
-- Name: candidate_profiles candidate_update_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_update_own_profile ON public.candidate_profiles FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_insert_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert_participants ON public.conversations FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = conversations.employer_id) AND (ep.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = conversations.candidate_profile_id) AND (cp.user_id = auth.uid())))))));


--
-- Name: conversations conversations_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select_participants ON public.conversations FOR SELECT TO authenticated USING (public.is_conversation_participant(id));


--
-- Name: jobs employer manages own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "employer manages own jobs" ON public.jobs USING ((employer_id = ( SELECT employer_profiles.id
   FROM public.employer_profiles
  WHERE (employer_profiles.user_id = auth.uid()))));


--
-- Name: employer_profiles employer updates own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "employer updates own profile" ON public.employer_profiles FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: employer_addon_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employer_addon_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: employer_addon_purchases employer_addon_purchases_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employer_addon_purchases_select_own ON public.employer_addon_purchases FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = employer_addon_purchases.employer_id) AND (ep.user_id = auth.uid())))));


--
-- Name: employer_credit_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employer_credit_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: employer_credit_usage employer_credit_usage_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employer_credit_usage_select_own ON public.employer_credit_usage FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = employer_credit_usage.employer_id) AND (ep.user_id = auth.uid())))));


--
-- Name: employer_credits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employer_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: employer_credits employer_credits_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employer_credits_select_own ON public.employer_credits FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = employer_credits.employer_id) AND (ep.user_id = auth.uid())))));


--
-- Name: employer_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: employer_profiles employer_profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employer_profiles_insert_own ON public.employer_profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: employer_profiles employer_profiles_select_for_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employer_profiles_select_for_authenticated ON public.employer_profiles FOR SELECT TO authenticated USING (true);


--
-- Name: employer_profiles employer_profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employer_profiles_select_own ON public.employer_profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: employer_profiles employer_profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employer_profiles_update_own ON public.employer_profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: billing_invoices employers_select_own_billing_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employers_select_own_billing_invoices ON public.billing_invoices FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = billing_invoices.employer_id) AND (ep.user_id = auth.uid())))));


--
-- Name: job_ai_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_ai_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: job_ai_reports job_ai_reports_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_ai_reports_select_own ON public.job_ai_reports FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = job_ai_reports.employer_id) AND (ep.user_id = auth.uid())))));


--
-- Name: job_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: job_applications job_applications_insert_candidate_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_applications_insert_candidate_own ON public.job_applications FOR INSERT TO authenticated WITH CHECK (public.is_current_user_candidate_profile(candidate_profile_id));


--
-- Name: job_applications job_applications_select_candidate_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_applications_select_candidate_own ON public.job_applications FOR SELECT TO authenticated USING (public.is_current_user_candidate_profile(candidate_profile_id));


--
-- Name: job_applications job_applications_select_employer_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_applications_select_employer_own ON public.job_applications FOR SELECT TO authenticated USING (public.is_current_user_employer_for_job(job_id));


--
-- Name: job_applications job_applications_update_employer_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_applications_update_employer_own ON public.job_applications FOR UPDATE TO authenticated USING (public.is_current_user_employer_for_job(job_id)) WITH CHECK (public.is_current_user_employer_for_job(job_id));


--
-- Name: job_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: job_matches job_matches_select_candidate_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_matches_select_candidate_own ON public.job_matches FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.candidate_profiles cp
  WHERE ((cp.id = job_matches.candidate_id) AND (cp.user_id = auth.uid())))));


--
-- Name: job_matches job_matches_select_employer_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_matches_select_employer_own ON public.job_matches FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.jobs j
     JOIN public.employer_profiles ep ON ((ep.id = j.employer_id)))
  WHERE ((j.id = job_matches.job_id) AND (ep.user_id = auth.uid())))));


--
-- Name: job_skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: job_skills job_skills_delete_employer_own_job; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_skills_delete_employer_own_job ON public.job_skills FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.jobs j
     JOIN public.employer_profiles ep ON ((ep.id = j.employer_id)))
  WHERE ((j.id = job_skills.job_id) AND (ep.user_id = auth.uid())))));


--
-- Name: job_skills job_skills_insert_employer_own_job; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_skills_insert_employer_own_job ON public.job_skills FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.jobs j
     JOIN public.employer_profiles ep ON ((ep.id = j.employer_id)))
  WHERE ((j.id = job_skills.job_id) AND (ep.user_id = auth.uid())))));


--
-- Name: job_skills job_skills_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_skills_select_authenticated ON public.job_skills FOR SELECT TO authenticated USING (true);


--
-- Name: job_skills job_skills_update_employer_own_job; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_skills_update_employer_own_job ON public.job_skills FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.jobs j
     JOIN public.employer_profiles ep ON ((ep.id = j.employer_id)))
  WHERE ((j.id = job_skills.job_id) AND (ep.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.jobs j
     JOIN public.employer_profiles ep ON ((ep.id = j.employer_id)))
  WHERE ((j.id = job_skills.job_id) AND (ep.user_id = auth.uid())))));


--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs jobs_insert_employer_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_insert_employer_own ON public.jobs FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = jobs.employer_id) AND (ep.user_id = auth.uid())))));


--
-- Name: jobs jobs_select_employer_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_select_employer_own ON public.jobs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = jobs.employer_id) AND (ep.user_id = auth.uid())))));


--
-- Name: jobs jobs_select_open_for_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_select_open_for_authenticated ON public.jobs FOR SELECT TO authenticated USING ((status = 'open'::text));


--
-- Name: jobs jobs_update_employer_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_update_employer_own ON public.jobs FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = jobs.employer_id) AND (ep.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employer_profiles ep
  WHERE ((ep.id = jobs.employer_id) AND (ep.user_id = auth.uid())))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_insert_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert_participants ON public.messages FOR INSERT TO authenticated WITH CHECK (((sender_user_id = auth.uid()) AND public.is_conversation_participant(conversation_id) AND (((sender_role = 'employer'::text) AND (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.employer_profiles ep ON ((ep.id = c.employer_id)))
  WHERE ((c.id = messages.conversation_id) AND (ep.user_id = auth.uid()))))) OR ((sender_role = 'candidate'::text) AND (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.candidate_profiles cp ON ((cp.id = c.candidate_profile_id)))
  WHERE ((c.id = messages.conversation_id) AND (cp.user_id = auth.uid()))))))));


--
-- Name: messages messages_select_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select_participants ON public.messages FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id));


--
-- Name: messages messages_update_recipients_read_receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update_recipients_read_receipts ON public.messages FOR UPDATE TO authenticated USING ((public.is_conversation_participant(conversation_id) AND (sender_user_id <> auth.uid()) AND (read_at IS NULL))) WITH CHECK ((public.is_conversation_participant(conversation_id) AND (sender_user_id <> auth.uid()) AND (read_at IS NOT NULL)));


--
-- Name: payment_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: plans plans_select_active_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_select_active_authenticated ON public.plans FOR SELECT TO authenticated USING ((active = true));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: jobs public can view open jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public can view open jobs" ON public.jobs FOR SELECT USING ((status = 'open'::text));


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

--
-- Name: skills skills_select_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY skills_select_all_authenticated ON public.skills FOR SELECT TO authenticated USING (true);


--
-- PostgreSQL database dump complete
--

\unrestrict GjJlYDleYCF1ia5K1jnbCm3AQQ1lv7zJln9bnA1nnNA8gFdxwPC2mt6oxhe5yRU


