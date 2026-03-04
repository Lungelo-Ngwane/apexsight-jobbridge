# Employer Trial Rollout Runbook

This runbook describes how the introductory employer trial works in this project after the following migrations:

- `20260304210000_add_intro_trial_for_first_employers.sql`
- `20260304210500_apply_trial_aware_job_limits.sql`
- `20260304211000_schedule_trial_expiry_job.sql`

## What the trial does

- Only the first **5** newly created employer profiles get the intro trial.
- Trial duration is **15 days**.
- Trial users get paid-tier access by being treated as:
  - `subscription_status = 'trialing'`
  - `plan = 'professional'` (effective paid access while trial is active)
- Trial-aware access is also enforced in app code via:
  - `src/lib/subscriptionAccess.ts`

## Auto-assignment rules

When a new row is inserted into `public.employer_profiles`:

1. If the profile is already marked `trial_granted = true`, trial timestamps are normalized.
2. Otherwise, the trigger checks current number of trial-granted employers.
3. If fewer than 5 are trial-granted, the new employer is granted trial.
4. Trial start/end are set and paid access is applied for active trial window.

## Expiry rules

Trials expire when `trial_ends_at <= now()` and profile is still `trialing`.

Expired trial users are downgraded to:

- `subscription_status = 'inactive'`
- `plan = 'free'`

This is handled by:

- Function: `public.expire_elapsed_employer_trials()`
- Daily cron (if `pg_cron` is available): `expire-employer-trials-daily`
- Schedule: `00:15 UTC` daily (`15 0 * * *`)

## Operational checks

### 1) See current trial cohort

```sql
select
  id,
  user_id,
  trial_granted,
  trial_started_at,
  trial_ends_at,
  subscription_status,
  plan
from public.employer_profiles
where trial_granted = true
order by trial_started_at asc;
```

### 2) See active trials right now

```sql
select
  count(*) as active_trials
from public.employer_profiles
where trial_granted = true
  and trial_started_at is not null
  and trial_ends_at is not null
  and now() >= trial_started_at
  and now() < trial_ends_at;
```

### 3) Manually run expiry job

```sql
select public.expire_elapsed_employer_trials();
```

### 4) Verify cron job exists (if pg_cron enabled)

```sql
select jobid, jobname, schedule, command
from cron.job
where jobname = 'expire-employer-trials-daily';
```

## How to change rollout size or duration

In `20260304210000_add_intro_trial_for_first_employers.sql`, function
`public.assign_intro_trial_to_first_employers()` currently sets:

- `v_trial_limit := 5`
- `v_trial_days := 15`

To change these in future:

1. Create a new migration.
2. `create or replace function public.assign_intro_trial_to_first_employers() ...`
3. Update only those variables.
4. Deploy via `supabase db push`.

Do not edit already-applied migration files directly in production.

## Frontend behavior

Paid access checks are centralized in:

- `src/lib/subscriptionAccess.ts`

Trial users are treated as paid only while trial is active.

This influences:

- Sidebar/menu gating
- Route protection for employer candidates/messages
- Dashboard premium actions

## Notes / caveats

- If `pg_cron` is unavailable in an environment, scheduling migration safely skips job creation.
- In that case, run `select public.expire_elapsed_employer_trials();` from an external scheduler (or manually).
- Existing employers are not backfilled automatically into the trial cohort; only new inserts are auto-assigned.
