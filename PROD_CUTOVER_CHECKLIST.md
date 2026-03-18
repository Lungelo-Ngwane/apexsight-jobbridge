# Production Cutover Checklist

This runbook assumes:

- `SOURCE` = the current working Supabase project that has your live data now
- `TARGET` = the production Supabase project you want the app to use going forward
- the codebase schema source of truth is `supabase/migrations`
- frontend production env values are provided by your hosting platform, not committed secrets

Use this when you want production to contain the current database state and the current codebase.

## 1) Pre-Cutover Decisions

Confirm these before touching data:

- Decide whether the `TARGET` project is empty or already has production data.
- If `TARGET` is not empty, take a full backup first.
- Decide whether you are migrating only `public` schema data or also `auth` users and storage objects.

Recommended cutover order:

1. Make `TARGET` schema match this repo using migrations.
2. Copy the required data from `SOURCE` into `TARGET`.
3. Set production secrets and auth URLs.
4. Deploy all edge functions.
5. Point frontend production env to `TARGET`.
6. Run smoke tests.

## 2) Frontend Production Env

Create production env values from [src/.env.production.example](./src/.env.production.example) in your hosting provider:

```env
VITE_SUPABASE_URL=https://YOUR_PROD_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PROD_ANON_KEY
VITE_APP_URL=https://jobbridge.apexsight.co.za
VITE_ENFORCE_JOB_EXPIRY=true
GOOGLE_AUTH_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
```

Notes:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must point to the `TARGET` project only.
- `GOOGLE_AUTH_CLIENT_ID` must be the real production OAuth client id if Google login is enabled.

## 2.1) Frontend Test Env

If you run a tester-facing deployment such as `https://jobbridge-test.apexsight.co.za`, create a separate env set from [src/.env.test.example](./src/.env.test.example):

```env
VITE_SUPABASE_URL=https://YOUR_TEST_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_TEST_ANON_KEY
VITE_APP_URL=https://jobbridge-test.apexsight.co.za
VITE_ENFORCE_JOB_EXPIRY=true
GOOGLE_AUTH_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
```

Rules:

- do not point the test deployment at the production Supabase project
- set `VITE_APP_URL` to the exact tester domain
- use a separate hosting environment for test

## 3) Supabase Auth URL Configuration (TARGET)

Set in Supabase Dashboard -> Auth -> URL Configuration:

- Site URL: `https://jobbridge.apexsight.co.za`
- Redirect URLs:
  - `https://jobbridge.apexsight.co.za`
  - `https://jobbridge.apexsight.co.za/`
  - `https://jobbridge.apexsight.co.za/*`
  - `https://jobbridge-test.apexsight.co.za`
  - `https://jobbridge-test.apexsight.co.za/`
  - `https://jobbridge-test.apexsight.co.za/*`
  - any staging or preview URL you intentionally support

## 4) Link CLI To TARGET

```powershell
supabase login
supabase link --project-ref YOUR_PROD_PROJECT_REF
```

## 5) Backup SOURCE And TARGET Before Migration

Minimum safe requirement:

- take a full database backup of `SOURCE`
- take a full database backup of `TARGET`

If you are using direct Postgres connection strings, save them as environment variables first:

```powershell
$env:SOURCE_DB_URL="postgresql://postgres:SOURCE_PASSWORD@db.SOURCE_REF.supabase.co:5432/postgres"
$env:TARGET_DB_URL="postgresql://postgres:TARGET_PASSWORD@db.TARGET_REF.supabase.co:5432/postgres"
```

Example backups:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
pg_dump --format=custom --file .\backups\source-full.dump "$env:SOURCE_DB_URL"
pg_dump --format=custom --file .\backups\target-full-before-cutover.dump "$env:TARGET_DB_URL"
```

## 6) Apply Repo Schema To TARGET

Push all migrations from this repo to `TARGET`:

```powershell
supabase db push
```

This ensures `TARGET` has the schema expected by the app and edge functions.

## 7) Copy Current SOURCE Data Into TARGET

### Option A: Public Schema Data Only

Use this if you only need app/business data in `public` and are handling auth users separately.

Create a data-only export from `SOURCE`:

```powershell
pg_dump `
  --data-only `
  --schema=public `
  --no-owner `
  --no-privileges `
  --file .\backups\source-public-data.sql `
  "$env:SOURCE_DB_URL"
```

Restore into `TARGET`:

```powershell
psql "$env:TARGET_DB_URL" -f .\backups\source-public-data.sql
```

Important:

- only run this into an empty or intentionally prepared `TARGET`
- if `TARGET` already has conflicting rows, restore can fail on unique constraints
- if you need a clean replacement, clear conflicting data only after taking a backup

### Option B: Full Database Migration

Use this only if you explicitly need `auth`, storage metadata, and everything else copied at once.

That requires a full database restore strategy and should be done with extreme care because it can overwrite existing production state. If you go this route, do it from backups and validate project-level settings immediately after restore.

## 8) Auth Users And Storage

Public data migration does not automatically guarantee:

- `auth.users`
- storage bucket objects/files
- dashboard-level settings
- edge-function secrets

Check these separately:

- Auth users:
  migrate separately if you need existing accounts preserved in `TARGET`
- Storage:
  copy resume files, certificates, employer logos/banners, and invoice files if they exist in `SOURCE`
- Buckets:
  verify all required buckets exist in `TARGET`

## 9) Set Supabase Function Secrets (TARGET)

```powershell
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
supabase secrets set PAYSTACK_SECRET_KEY=YOUR_PAYSTACK_SECRET_KEY
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set APP_URL=https://jobbridge.apexsight.co.za
supabase secrets set FRONTEND_URL=https://jobbridge.apexsight.co.za
```

If you use any additional provider secrets, set them before deploying functions.

## 10) Deploy Edge Functions (TARGET)

Deploy every function configured in `supabase/config.toml`:

```powershell
supabase functions deploy send-notification-email
supabase functions deploy initialize-subscription
supabase functions deploy confirm-subscription
supabase functions deploy cancel-subscription
supabase functions deploy paystack-webhook
supabase functions deploy generate-embedding
supabase functions deploy generate-job-embedding --no-verify-jwt
supabase functions deploy match-candidates
supabase functions deploy auto-match
supabase functions deploy auto-shortlist
supabase functions deploy buy-addon
supabase functions deploy confirm-addon
supabase functions deploy consume-credit
supabase functions deploy feature-job
supabase functions deploy generate-ai-report
supabase functions deploy authorize-candidate-view
supabase functions deploy get-invoice-download-url
supabase functions deploy analyze-candidate-profile
supabase functions deploy add-candidate-skill
supabase functions deploy resolve-skill
```

After deployment, confirm function secrets and JWT settings match your intended production behavior.

## 11) Verify Core Data In TARGET

Run these in SQL Editor on `TARGET`:

```sql
select count(*) as skills_count from public.skills;
select count(*) as candidates_count from public.candidate_profiles;
select count(*) as employers_count from public.employer_profiles;
select count(*) as jobs_count from public.jobs;
select status, count(*) from public.jobs group by status order by status;
select status, count(*) from public.job_applications group by status order by status;
```

## 12) Production Smoke Test

Run through these on the live app against `TARGET`:

1. Register candidate
2. Register employer
3. Employer completes onboarding
4. Employer posts a job
5. Verify `generate-job-embedding` succeeds
6. Candidate sees job list
7. Candidate applies
8. Employer opens candidate profile
9. Run AI match
10. Run auto shortlist if credits/plan allow
11. Generate AI report
12. Send a message both ways
13. Download an invoice if billing is enabled
14. Upload and read back CV/certification files

## 13) Final Cutover Guardrails

Before you announce production ready:

- confirm the hosting provider uses only `TARGET` env values
- confirm no preview or production build points to the old Supabase project
- confirm Paystack and Resend production secrets are live-mode values
- confirm Google OAuth redirect configuration matches the final production domain

## 14) Immediate Security Follow-Up

Rotate any secrets that have been exposed in local files, screenshots, logs, or chat history before final production cutover.
