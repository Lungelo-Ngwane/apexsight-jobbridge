create or replace function public.get_admin_entity_detail(p_kind text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_result jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  if p_id is null then
    raise exception 'Record id is required';
  end if;

  if v_kind = 'employer' then
    select jsonb_build_object(
      'kind', 'employer',
      'entity', jsonb_build_object(
        'userId', au.id,
        'email', au.email,
        'employerId', ep.id,
        'companyName', ep.company_name,
        'plan', ep.plan,
        'subscriptionStatus', ep.subscription_status,
        'industry', ep.industry,
        'companySize', ep.company_size,
        'website', ep.website,
        'contactEmail', ep.contact_email,
        'createdAt', au.created_at
      ),
      'metrics', jsonb_build_object(
        'totalJobs', coalesce(job_stats.total_jobs, 0),
        'openJobs', coalesce(job_stats.open_jobs, 0),
        'totalApplicants', coalesce(job_stats.total_applicants, 0),
        'totalInvoices', coalesce(invoice_stats.total_invoices, 0),
        'paidRevenueKobo', coalesce(invoice_stats.paid_revenue_kobo, 0)
      ),
      'creditBalances', coalesce(credit_rows.payload, '[]'::jsonb),
      'recentAddonPurchases', coalesce(addon_purchase_rows.payload, '[]'::jsonb),
      'recentInvoices', coalesce(invoice_rows.payload, '[]'::jsonb)
    )
    into v_result
    from auth.users au
    left join public.employer_profiles ep on ep.user_id = au.id
    left join lateral (
      select
        count(*)::int as total_jobs,
        count(*) filter (where lower(coalesce(j.status, 'open')) = 'open')::int as open_jobs,
        coalesce(sum(app_counts.applicant_count), 0)::int as total_applicants
      from public.jobs j
      left join lateral (
        select count(*)::int as applicant_count
        from public.job_applications ja
        where ja.job_id = j.id
      ) app_counts on true
      where j.employer_id = ep.id
    ) job_stats on true
    left join lateral (
      select
        count(*)::int as total_invoices,
        coalesce(sum(case when lower(coalesce(bi.status, 'pending')) = 'paid' then bi.total_kobo else 0 end), 0)::bigint as paid_revenue_kobo
      from public.billing_invoices bi
      where bi.employer_id = ep.id
    ) invoice_stats on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'creditType', ec.credit_type,
          'remaining', ec.remaining
        )
        order by ec.remaining desc, ec.credit_type asc
      ) as payload
      from public.employer_credits ec
      where ec.employer_id = ep.id
        and coalesce(ec.remaining, 0) > 0
    ) credit_rows on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'purchaseId', eap.id,
          'reference', eap.reference,
          'status', eap.status,
          'amountPaid', eap.amount_paid,
          'creditsAdded', eap.credits_added,
          'addonName', a.name,
          'creditType', a.type,
          'createdAt', eap.created_at
        )
        order by eap.created_at desc
      ) as payload
      from (
        select *
        from public.employer_addon_purchases eap
        where eap.employer_id = ep.id
        order by eap.created_at desc
        limit 5
      ) eap
      left join public.addons a on a.id = eap.addon_id
    ) addon_purchase_rows on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'invoiceId', bi.id,
          'invoiceNumber', bi.invoice_number,
          'status', bi.status,
          'kind', bi.kind,
          'totalKobo', bi.total_kobo,
          'issuedAt', bi.issued_at
        )
        order by bi.issued_at desc
      ) as payload
      from (
        select *
        from public.billing_invoices bi
        where bi.employer_id = ep.id
        order by bi.issued_at desc
        limit 5
      ) bi
    ) invoice_rows on true
    where au.id = p_id;

  elsif v_kind = 'candidate' then
    select jsonb_build_object(
      'kind', 'candidate',
      'entity', jsonb_build_object(
        'userId', au.id,
        'email', au.email,
        'candidateProfileId', cp.id,
        'fullName', cp.full_name,
        'headline', cp.headline,
        'location', cp.location,
        'yearsExperience', cp.years_experience,
        'availability', cp.availability,
        'createdAt', au.created_at
      ),
      'metrics', jsonb_build_object(
        'totalApplications', coalesce(application_stats.total_applications, 0),
        'shortlistedApplications', coalesce(application_stats.shortlisted_applications, 0),
        'interviewApplications', coalesce(application_stats.interview_applications, 0)
      ),
      'recentApplications', coalesce(application_rows.payload, '[]'::jsonb)
    )
    into v_result
    from auth.users au
    left join public.candidate_profiles cp on cp.user_id = au.id
    left join lateral (
      select
        count(*)::int as total_applications,
        count(*) filter (where lower(coalesce(ja.status, 'applied')) = 'shortlisted')::int as shortlisted_applications,
        count(*) filter (where lower(coalesce(ja.status, 'applied')) = 'interview')::int as interview_applications
      from public.job_applications ja
      where ja.candidate_profile_id = cp.id
    ) application_stats on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'applicationId', ja.id,
          'status', ja.status,
          'score', ja.score,
          'jobTitle', j.title,
          'createdAt', ja.created_at
        )
        order by ja.created_at desc
      ) as payload
      from (
        select *
        from public.job_applications ja
        where ja.candidate_profile_id = cp.id
        order by ja.created_at desc
        limit 5
      ) ja
      left join public.jobs j on j.id = ja.job_id
    ) application_rows on true
    where au.id = p_id;

  elsif v_kind = 'job' then
    select jsonb_build_object(
      'kind', 'job',
      'entity', jsonb_build_object(
        'jobId', j.id,
        'title', j.title,
        'status', j.status,
        'location', j.location,
        'employmentType', j.employment_type,
        'experienceLevel', j.experience_level,
        'createdAt', j.created_at,
        'employerId', ep.id,
        'employerName', ep.company_name
      ),
      'metrics', jsonb_build_object(
        'applicants', coalesce(application_stats.total_applications, 0),
        'shortlisted', coalesce(application_stats.shortlisted_applications, 0),
        'interview', coalesce(application_stats.interview_applications, 0),
        'hired', coalesce(application_stats.hired_applications, 0)
      ),
      'recentApplications', coalesce(application_rows.payload, '[]'::jsonb)
    )
    into v_result
    from public.jobs j
    left join public.employer_profiles ep on ep.id = j.employer_id
    left join lateral (
      select
        count(*)::int as total_applications,
        count(*) filter (where lower(coalesce(ja.status, 'applied')) = 'shortlisted')::int as shortlisted_applications,
        count(*) filter (where lower(coalesce(ja.status, 'applied')) = 'interview')::int as interview_applications,
        count(*) filter (where lower(coalesce(ja.status, 'applied')) = 'hired')::int as hired_applications
      from public.job_applications ja
      where ja.job_id = j.id
    ) application_stats on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'applicationId', ja.id,
          'candidateProfileId', cp.id,
          'candidateName', cp.full_name,
          'status', ja.status,
          'score', ja.score,
          'createdAt', ja.created_at
        )
        order by ja.created_at desc
      ) as payload
      from (
        select *
        from public.job_applications ja
        where ja.job_id = j.id
        order by ja.created_at desc
        limit 10
      ) ja
      left join public.candidate_profiles cp on cp.id = ja.candidate_profile_id
    ) application_rows on true
    where j.id = p_id;

  elsif v_kind = 'invoice' then
    select jsonb_build_object(
      'kind', 'invoice',
      'entity', jsonb_build_object(
        'invoiceId', bi.id,
        'invoiceNumber', bi.invoice_number,
        'status', bi.status,
        'kind', bi.kind,
        'provider', bi.provider,
        'providerReference', bi.provider_reference,
        'currency', bi.currency,
        'amountKobo', bi.amount_kobo,
        'vatKobo', bi.vat_kobo,
        'totalKobo', bi.total_kobo,
        'issuedAt', bi.issued_at,
        'paidAt', bi.paid_at,
        'storagePath', bi.storage_path,
        'metadata', bi.metadata,
        'employerId', ep.id,
        'employerName', ep.company_name,
        'employerUserId', ep.user_id
      ),
      'related', jsonb_build_object(
        'employerUserId', ep.user_id,
        'employerId', ep.id,
        'failedWebhookEventId', (
          select pwe.id
          from public.payment_webhook_events pwe
          where pwe.reference = bi.provider_reference
            and lower(coalesce(pwe.status, 'received')) = 'failed'
          order by pwe.received_at desc
          limit 1
        )
      )
    )
    into v_result
    from public.billing_invoices bi
    left join public.employer_profiles ep on ep.id = bi.employer_id
    where bi.id = p_id;

  else
    raise exception 'Unsupported admin entity type: %', p_kind;
  end if;

  if v_result is null then
    raise exception 'Admin record not found';
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_admin_entity_detail(text, uuid) to authenticated;
