create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.admin_users enable row level security;

drop policy if exists admin_users_select_own on public.admin_users;
create policy admin_users_select_own
on public.admin_users
for select
using (user_id = auth.uid());

create or replace function public.is_admin_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.get_admin_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
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
      )
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
          concat(
            coalesce(ep.company_name, 'Employer'),
            ' • ',
            upper(coalesce(bi.kind, 'subscription'))
          ) as detail,
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
  )
  select jsonb_build_object(
    'metrics', metrics.payload,
    'planDistribution', plan_distribution.payload,
    'creditTotals', credit_totals.payload,
    'recentActivity', recent_activity.payload
  )
  into v_result
  from metrics, plan_distribution, credit_totals, recent_activity;

  return v_result;
end;
$$;

grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.get_admin_dashboard_snapshot() to authenticated;
