create or replace function public.get_admin_dashboard_snapshot(p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_days integer := greatest(coalesce(p_days, 30), 1);
  v_since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 30) - 1, 0));
  v_result jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  with metrics as (
    select jsonb_build_object(
      'totalUsers', (select count(*)::int from auth.users),
      'totalCandidates', (select count(*)::int from public.candidate_profiles),
      'totalEmployers', (select count(*)::int from public.employer_profiles),
      'openJobs', (
        select count(*)::int
        from public.jobs
        where lower(coalesce(status, 'open')) = 'open'
      ),
      'totalApplications', (select count(*)::int from public.job_applications),
      'activeSubscriptions', (
        select count(*)::int
        from public.employer_profiles
        where lower(coalesce(subscription_status, 'inactive')) = 'active'
      ),
      'trialingEmployers', (
        select count(*)::int
        from public.employer_profiles
        where lower(coalesce(subscription_status, 'inactive')) = 'trialing'
      ),
      'pendingPayments', (
        select count(*)::int
        from public.employer_profiles
        where lower(coalesce(subscription_status, 'inactive')) = 'pending_payment'
      ),
      'paidInvoices', (
        select count(*)::int
        from public.billing_invoices
        where lower(coalesce(status, 'pending')) = 'paid'
      ),
      'paidRevenueKobo', (
        select coalesce(sum(total_kobo), 0)::bigint
        from public.billing_invoices
        where lower(coalesce(status, 'pending')) = 'paid'
      ),
      'failedWebhooks', (
        select count(*)::int
        from public.payment_webhook_events
        where lower(coalesce(status, 'received')) = 'failed'
      ),
      'unreadWebhookBacklog', (
        select count(*)::int
        from public.payment_webhook_events
        where lower(coalesce(status, 'received')) = 'received'
      ),
      'messagesLast7Days', (
        select count(*)::int
        from public.messages
        where created_at >= now() - interval '7 days'
      ),
      'signupsInRange', (
        select count(*)::int
        from auth.users
        where created_at >= v_since
      ),
      'applicationsInRange', (
        select count(*)::int
        from public.job_applications
        where created_at >= v_since
      ),
      'paidRevenueInRangeKobo', (
        select coalesce(sum(total_kobo), 0)::bigint
        from public.billing_invoices
        where lower(coalesce(status, 'pending')) = 'paid'
          and coalesce(paid_at, issued_at, created_at) >= v_since
      ),
      'adminActionsLast24h', (
        select count(*)::int
        from public.admin_audit_logs
        where created_at >= now() - interval '24 hours'
      ),
      'adminRetriesLast24h', (
        select count(*)::int
        from public.admin_audit_logs
        where action = 'webhook_retried'
          and created_at >= now() - interval '24 hours'
      ),
      'invoiceDownloadsLast24h', (
        select count(*)::int
        from public.admin_audit_logs
        where action = 'invoice_download_requested'
          and created_at >= now() - interval '24 hours'
      ),
      'activeAdminsLast24h', (
        select count(distinct actor_user_id)::int
        from public.admin_audit_logs
        where actor_user_id is not null
          and created_at >= now() - interval '24 hours'
      ),
      'days', v_days
    ) as payload
  ),
  plan_distribution as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'plan', plan_name,
          'count', plan_count
        )
        order by plan_count desc, plan_name asc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select
        coalesce(nullif(trim(plan), ''), 'free') as plan_name,
        count(*)::int as plan_count
      from public.employer_profiles
      group by 1
    ) grouped_plans
  ),
  credit_totals as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'creditType', credit_type,
          'remaining', remaining_total
        )
        order by remaining_total desc, credit_type asc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select
        credit_type,
        sum(coalesce(remaining, 0))::bigint as remaining_total
      from public.employer_credits
      group by 1
      having sum(coalesce(remaining, 0)) > 0
    ) grouped_credits
  ),
  recent_activity as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', entry_type,
          'title', title,
          'detail', detail,
          'status', status,
          'occurredAt', occurred_at
        )
        order by occurred_at desc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select *
      from (
        select
          'signup'::text as entry_type,
          coalesce(nullif(trim(au.email), ''), 'New user') as title,
          concat('Role: ', coalesce(nullif(trim(p.role), ''), 'unassigned')) as detail,
          'info'::text as status,
          au.created_at as occurred_at
        from auth.users au
        left join public.profiles p on p.id = au.id

        union all

        select
          'job'::text as entry_type,
          coalesce(nullif(trim(j.title), ''), 'Job posted') as title,
          coalesce(ep.company_name, 'Employer') as detail,
          lower(coalesce(j.status, 'open')) as status,
          j.created_at as occurred_at
        from public.jobs j
        left join public.employer_profiles ep on ep.id = j.employer_id

        union all

        select
          'application'::text as entry_type,
          coalesce(cp.full_name, 'Candidate application') as title,
          coalesce(j.title, 'Unknown role') as detail,
          lower(coalesce(ja.status, 'applied')) as status,
          ja.created_at as occurred_at
        from public.job_applications ja
        left join public.candidate_profiles cp on cp.id = ja.candidate_profile_id
        left join public.jobs j on j.id = ja.job_id

        union all

        select
          'invoice'::text as entry_type,
          concat('Invoice ', coalesce(nullif(trim(bi.invoice_number), ''), 'pending')) as title,
          concat(coalesce(ep.company_name, 'Employer'), ' | ', upper(coalesce(bi.kind, 'subscription'))) as detail,
          lower(coalesce(bi.status, 'pending')) as status,
          coalesce(bi.paid_at, bi.issued_at, bi.created_at) as occurred_at
        from public.billing_invoices bi
        left join public.employer_profiles ep on ep.id = bi.employer_id

        union all

        select
          'webhook'::text as entry_type,
          coalesce(nullif(trim(pwe.event_name), ''), 'Webhook event') as title,
          coalesce(nullif(trim(pwe.reference), ''), 'No reference') as detail,
          lower(coalesce(pwe.status, 'received')) as status,
          coalesce(pwe.processed_at, pwe.received_at) as occurred_at
        from public.payment_webhook_events pwe
      ) activity_feed
      order by occurred_at desc
      limit 20
    ) recent_rows
  ),
  trends as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char(day_bucket, 'YYYY-MM-DD'),
          'signups', signups,
          'applications', applications,
          'revenueKobo', revenue_kobo,
          'failedWebhooks', failed_webhooks
        )
        order by day_bucket asc
      ),
      '[]'::jsonb
    ) as payload
    from (
      with day_series as (
        select generate_series(
          date_trunc('day', now()) - make_interval(days => v_days - 1),
          date_trunc('day', now()),
          interval '1 day'
        ) as day_bucket
      ),
      signups as (
        select date_trunc('day', created_at) as day_bucket, count(*)::int as count_value
        from auth.users
        where created_at >= v_since
        group by 1
      ),
      applications as (
        select date_trunc('day', created_at) as day_bucket, count(*)::int as count_value
        from public.job_applications
        where created_at >= v_since
        group by 1
      ),
      revenue as (
        select date_trunc('day', coalesce(paid_at, issued_at, created_at)) as day_bucket, coalesce(sum(total_kobo), 0)::bigint as total_kobo
        from public.billing_invoices
        where lower(coalesce(status, 'pending')) = 'paid'
          and coalesce(paid_at, issued_at, created_at) >= v_since
        group by 1
      ),
      webhook_failures as (
        select date_trunc('day', received_at) as day_bucket, count(*)::int as count_value
        from public.payment_webhook_events
        where lower(coalesce(status, 'received')) = 'failed'
          and received_at >= v_since
        group by 1
      )
      select
        ds.day_bucket,
        coalesce(s.count_value, 0) as signups,
        coalesce(a.count_value, 0) as applications,
        coalesce(r.total_kobo, 0) as revenue_kobo,
        coalesce(w.count_value, 0) as failed_webhooks
      from day_series ds
      left join signups s on s.day_bucket = ds.day_bucket
      left join applications a on a.day_bucket = ds.day_bucket
      left join revenue r on r.day_bucket = ds.day_bucket
      left join webhook_failures w on w.day_bucket = ds.day_bucket
      order by ds.day_bucket asc
    ) trend_rows
  ),
  failed_webhooks_queue as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'eventName', event_name,
          'reference', reference,
          'status', status,
          'lastError', last_error,
          'receivedAt', received_at
        )
        order by received_at desc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select id, event_name, reference, status, last_error, received_at
      from public.payment_webhook_events
      where lower(coalesce(status, 'received')) = 'failed'
      order by received_at desc
      limit 10
    ) queue_rows
  ),
  pending_payment_queue as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'invoiceId', id,
          'invoiceNumber', invoice_number,
          'employerName', employer_name,
          'totalKobo', total_kobo,
          'issuedAt', issued_at
        )
        order by issued_at asc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select
        bi.id,
        bi.invoice_number,
        coalesce(ep.company_name, 'Employer') as employer_name,
        bi.total_kobo,
        bi.issued_at
      from public.billing_invoices bi
      left join public.employer_profiles ep on ep.id = bi.employer_id
      where lower(coalesce(bi.status, 'pending')) = 'pending'
        and bi.issued_at <= now() - interval '30 minutes'
      order by bi.issued_at asc
      limit 10
    ) pending_rows
  ),
  stalled_jobs_queue as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'jobId', job_id,
          'title', title,
          'employerName', employer_name,
          'applicants', applicants,
          'shortlisted', shortlisted,
          'createdAt', created_at
        )
        order by applicants desc, created_at asc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select
        j.id as job_id,
        j.title,
        coalesce(ep.company_name, 'Employer') as employer_name,
        count(ja.id)::int as applicants,
        count(*) filter (where lower(coalesce(ja.status, 'applied')) = 'shortlisted')::int as shortlisted,
        j.created_at
      from public.jobs j
      join public.job_applications ja on ja.job_id = j.id
      left join public.employer_profiles ep on ep.id = j.employer_id
      where lower(coalesce(j.status, 'open')) = 'open'
      group by j.id, j.title, employer_name, j.created_at
      having count(ja.id) >= 5
         and count(*) filter (where lower(coalesce(ja.status, 'applied')) = 'shortlisted') = 0
      order by applicants desc, j.created_at asc
      limit 10
    ) stalled_rows
  ),
  recent_employers as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', user_id,
          'email', email,
          'companyName', company_name,
          'createdAt', created_at
        )
        order by created_at desc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select
        au.id as user_id,
        coalesce(au.email, 'Unknown') as email,
        coalesce(ep.company_name, 'Employer') as company_name,
        au.created_at
      from auth.users au
      join public.profiles p on p.id = au.id and lower(coalesce(p.role, '')) = 'employer'
      left join public.employer_profiles ep on ep.user_id = au.id
      where au.created_at >= v_since
      order by au.created_at desc
      limit 10
    ) employer_rows
  ),
  recent_candidates as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', user_id,
          'email', email,
          'fullName', full_name,
          'createdAt', created_at
        )
        order by created_at desc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select
        au.id as user_id,
        coalesce(au.email, 'Unknown') as email,
        coalesce(cp.full_name, 'Candidate') as full_name,
        au.created_at
      from auth.users au
      join public.profiles p on p.id = au.id and lower(coalesce(p.role, '')) = 'candidate'
      left join public.candidate_profiles cp on cp.user_id = au.id
      where au.created_at >= v_since
      order by au.created_at desc
      limit 10
    ) candidate_rows
  ),
  recent_invoices as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'invoiceId', id,
          'invoiceNumber', invoice_number,
          'employerName', employer_name,
          'status', status,
          'kind', kind,
          'totalKobo', total_kobo,
          'issuedAt', issued_at
        )
        order by issued_at desc
      ),
      '[]'::jsonb
    ) as payload
    from (
      select
        bi.id,
        bi.invoice_number,
        coalesce(ep.company_name, 'Employer') as employer_name,
        bi.status,
        bi.kind,
        bi.total_kobo,
        bi.issued_at
      from public.billing_invoices bi
      left join public.employer_profiles ep on ep.id = bi.employer_id
      where bi.issued_at >= v_since
      order by bi.issued_at desc
      limit 10
    ) invoice_rows
  )
  select jsonb_build_object(
    'metrics', metrics.payload,
    'planDistribution', plan_distribution.payload,
    'creditTotals', credit_totals.payload,
    'recentActivity', recent_activity.payload,
    'trends', trends.payload,
    'queues', jsonb_build_object(
      'failedWebhooks', failed_webhooks_queue.payload,
      'pendingPayments', pending_payment_queue.payload,
      'stalledJobs', stalled_jobs_queue.payload
    ),
    'recentEmployers', recent_employers.payload,
    'recentCandidates', recent_candidates.payload,
    'recentInvoices', recent_invoices.payload
  )
  into v_result
  from metrics, plan_distribution, credit_totals, recent_activity, trends, failed_webhooks_queue, pending_payment_queue, stalled_jobs_queue, recent_employers, recent_candidates, recent_invoices;

  return v_result;
end;
$$;

create or replace function public.get_admin_dashboard_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.get_admin_dashboard_snapshot(30);
$$;

grant execute on function public.get_admin_dashboard_snapshot(integer) to authenticated;
grant execute on function public.get_admin_dashboard_snapshot() to authenticated;
