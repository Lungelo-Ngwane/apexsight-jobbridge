-- Enable RLS and policies for tables currently used by the frontend codebase.
-- Idempotent: safe to re-run.

-- profiles
alter table if exists public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- employer_profiles
alter table if exists public.employer_profiles enable row level security;
drop policy if exists employer_profiles_select_own on public.employer_profiles;
create policy employer_profiles_select_own
on public.employer_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists employer_profiles_select_for_authenticated on public.employer_profiles;
create policy employer_profiles_select_for_authenticated
on public.employer_profiles
for select
to authenticated
using (true);

drop policy if exists employer_profiles_insert_own on public.employer_profiles;
create policy employer_profiles_insert_own
on public.employer_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists employer_profiles_update_own on public.employer_profiles;
create policy employer_profiles_update_own
on public.employer_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- candidate_profiles
alter table if exists public.candidate_profiles enable row level security;
drop policy if exists candidate_profiles_select_own on public.candidate_profiles;
create policy candidate_profiles_select_own
on public.candidate_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists candidate_profiles_select_for_authenticated on public.candidate_profiles;
create policy candidate_profiles_select_for_authenticated
on public.candidate_profiles
for select
to authenticated
using (true);

drop policy if exists candidate_profiles_insert_own on public.candidate_profiles;
create policy candidate_profiles_insert_own
on public.candidate_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists candidate_profiles_update_own on public.candidate_profiles;
create policy candidate_profiles_update_own
on public.candidate_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- candidate_skills
alter table if exists public.candidate_skills enable row level security;
drop policy if exists candidate_skills_select_all_authenticated on public.candidate_skills;
create policy candidate_skills_select_all_authenticated
on public.candidate_skills
for select
to authenticated
using (true);

drop policy if exists candidate_skills_insert_own on public.candidate_skills;
create policy candidate_skills_insert_own
on public.candidate_skills
for insert
to authenticated
with check (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_skills.candidate_profile_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists candidate_skills_update_own on public.candidate_skills;
create policy candidate_skills_update_own
on public.candidate_skills
for update
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_skills.candidate_profile_id
      and cp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_skills.candidate_profile_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists candidate_skills_delete_own on public.candidate_skills;
create policy candidate_skills_delete_own
on public.candidate_skills
for delete
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_skills.candidate_profile_id
      and cp.user_id = auth.uid()
  )
);

-- candidate_assessments
alter table if exists public.candidate_assessments enable row level security;
drop policy if exists candidate_assessments_select_own on public.candidate_assessments;
create policy candidate_assessments_select_own
on public.candidate_assessments
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_assessments.candidate_id
      and cp.user_id = auth.uid()
  )
);

-- candidate_resumes
alter table if exists public.candidate_resumes enable row level security;
drop policy if exists candidate_resumes_select_own_or_related_employer on public.candidate_resumes;
create policy candidate_resumes_select_own_or_related_employer
on public.candidate_resumes
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_resumes.candidate_profile_id
      and cp.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.job_applications ja
    join public.jobs j on j.id = ja.job_id
    join public.employer_profiles ep on ep.id = j.employer_id
    where ja.candidate_profile_id = candidate_resumes.candidate_profile_id
      and ep.user_id = auth.uid()
  )
);

-- candidate_certifications
alter table if exists public.candidate_certifications enable row level security;
drop policy if exists candidate_certifications_select_own on public.candidate_certifications;
create policy candidate_certifications_select_own
on public.candidate_certifications
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = candidate_certifications.candidate_id
      and cp.user_id = auth.uid()
  )
);

-- skills
alter table if exists public.skills enable row level security;
drop policy if exists skills_select_all_authenticated on public.skills;
create policy skills_select_all_authenticated
on public.skills
for select
to authenticated
using (true);

-- plans
alter table if exists public.plans enable row level security;
drop policy if exists plans_select_active_authenticated on public.plans;
create policy plans_select_active_authenticated
on public.plans
for select
to authenticated
using (active = true);

-- addons
alter table if exists public.addons enable row level security;
drop policy if exists addons_select_active_authenticated on public.addons;
create policy addons_select_active_authenticated
on public.addons
for select
to authenticated
using (active = true);

-- billing_invoices
alter table if exists public.billing_invoices enable row level security;
drop policy if exists employers_select_own_billing_invoices on public.billing_invoices;
drop policy if exists "employers_select_own_billing_invoices" on public.billing_invoices;
create policy "employers_select_own_billing_invoices"
on public.billing_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = billing_invoices.employer_id
      and ep.user_id = auth.uid()
  )
);

-- employer_credits
alter table if exists public.employer_credits enable row level security;
drop policy if exists employer_credits_select_own on public.employer_credits;
create policy employer_credits_select_own
on public.employer_credits
for select
to authenticated
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = employer_credits.employer_id
      and ep.user_id = auth.uid()
  )
);

-- employer_credit_usage
alter table if exists public.employer_credit_usage enable row level security;
drop policy if exists employer_credit_usage_select_own on public.employer_credit_usage;
create policy employer_credit_usage_select_own
on public.employer_credit_usage
for select
to authenticated
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = employer_credit_usage.employer_id
      and ep.user_id = auth.uid()
  )
);

-- employer_addon_purchases
alter table if exists public.employer_addon_purchases enable row level security;
drop policy if exists employer_addon_purchases_select_own on public.employer_addon_purchases;
create policy employer_addon_purchases_select_own
on public.employer_addon_purchases
for select
to authenticated
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = employer_addon_purchases.employer_id
      and ep.user_id = auth.uid()
  )
);

-- job_ai_reports
alter table if exists public.job_ai_reports enable row level security;
drop policy if exists job_ai_reports_select_own on public.job_ai_reports;
create policy job_ai_reports_select_own
on public.job_ai_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = job_ai_reports.employer_id
      and ep.user_id = auth.uid()
  )
);

-- jobs (replace incorrect legacy policies if present)
alter table if exists public.jobs enable row level security;
drop policy if exists "employers_insert_jobs" on public.jobs;
drop policy if exists "employers_select_jobs" on public.jobs;
drop policy if exists "employers_update_jobs" on public.jobs;

drop policy if exists jobs_select_open_for_authenticated on public.jobs;
create policy jobs_select_open_for_authenticated
on public.jobs
for select
to authenticated
using (status = 'open');

drop policy if exists jobs_select_employer_own on public.jobs;
create policy jobs_select_employer_own
on public.jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = jobs.employer_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists jobs_insert_employer_own on public.jobs;
create policy jobs_insert_employer_own
on public.jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = jobs.employer_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists jobs_update_employer_own on public.jobs;
create policy jobs_update_employer_own
on public.jobs
for update
to authenticated
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = jobs.employer_id
      and ep.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = jobs.employer_id
      and ep.user_id = auth.uid()
  )
);

-- job_skills
alter table if exists public.job_skills enable row level security;
drop policy if exists job_skills_select_authenticated on public.job_skills;
create policy job_skills_select_authenticated
on public.job_skills
for select
to authenticated
using (true);

drop policy if exists job_skills_insert_employer_own_job on public.job_skills;
create policy job_skills_insert_employer_own_job
on public.job_skills
for insert
to authenticated
with check (
  exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = job_skills.job_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists job_skills_update_employer_own_job on public.job_skills;
create policy job_skills_update_employer_own_job
on public.job_skills
for update
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = job_skills.job_id
      and ep.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = job_skills.job_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists job_skills_delete_employer_own_job on public.job_skills;
create policy job_skills_delete_employer_own_job
on public.job_skills
for delete
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = job_skills.job_id
      and ep.user_id = auth.uid()
  )
);

-- job_applications
alter table if exists public.job_applications enable row level security;
drop policy if exists job_applications_select_candidate_own on public.job_applications;
create policy job_applications_select_candidate_own
on public.job_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = job_applications.candidate_profile_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists job_applications_select_employer_own on public.job_applications;
create policy job_applications_select_employer_own
on public.job_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = job_applications.job_id
      and ep.user_id = auth.uid()
  )
);

drop policy if exists job_applications_insert_candidate_own on public.job_applications;
create policy job_applications_insert_candidate_own
on public.job_applications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.candidate_profiles cp
    where cp.id = job_applications.candidate_profile_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists job_applications_update_employer_own on public.job_applications;
create policy job_applications_update_employer_own
on public.job_applications
for update
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = job_applications.job_id
      and ep.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    join public.employer_profiles ep on ep.id = j.employer_id
    where j.id = job_applications.job_id
      and ep.user_id = auth.uid()
  )
);
