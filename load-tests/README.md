# Backend Load Testing (k6)

This folder contains a production-style load test suite for your Supabase backend.

## Prerequisites

1. Install k6 (Windows):

```powershell
choco install k6
```

2. Deploy latest migrations + edge functions first.

## Required Test Inputs

You need real IDs and JWTs from your environment:

- `SUPABASE_URL`: e.g. `https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY`: project anon key
- `EMPLOYER_JWTS`: comma-separated employer access JWTs
- `JOB_IDS`: comma-separated job UUIDs owned by those employers

Optional (recommended for fuller coverage):

- `CANDIDATE_JWTS`: comma-separated candidate JWTs
- `APPLICATION_IDS`: comma-separated application UUIDs
- `CONVERSATION_IDS`: comma-separated conversation UUIDs

## 1) Smoke Test First

Run one-iteration connectivity test:

```powershell
k6 run .\load-tests\smoke.js `
  -e SUPABASE_URL=https://<project-ref>.supabase.co `
  -e SUPABASE_ANON_KEY=<anon-key> `
  -e EMPLOYER_JWT=<single-employer-jwt> `
  -e JOB_ID=<single-job-id> `
  -e APPLICATION_ID=<optional-application-id>
```

## Generate Env Automatically (Seeded Data)

Use this helper to fetch IDs from your seeded DB and sign in test users to generate JWTs.

Required env vars:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TEST_EMPLOYER_PASSWORD`

Optional:

- `TEST_CANDIDATE_PASSWORD` (defaults to employer password)
- `MAX_EMPLOYER_USERS` (default `5`)
- `MAX_CANDIDATE_USERS` (default `5`)
- `MAX_JOB_IDS` (default `30`)
- `MAX_APPLICATION_IDS` (default `50`)
- `MAX_CONVERSATION_IDS` (default `30`)
- `WRITE_ENV_FILE` (`true` by default)

```powershell
$env:SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_ANON_KEY="<anon-key>"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
$env:TEST_EMPLOYER_PASSWORD="<seed-password>"
$env:TEST_CANDIDATE_PASSWORD="<seed-password>"

node .\load-tests\generate-loadtest-env.mjs
```

It prints generated values and writes:

- `load-tests/.env.generated`

Then load those values into your shell (manual copy/paste is safest on Windows PowerShell for long JWTs).

## 2) Full Load Test

This runs 5 scenarios in parallel:

- `auto-match` (edge function)
- `authorize-candidate-view` (edge function)
- `feature-job` (edge function)
- `generate-ai-report` (edge function)
- `rest_reads` (jobs/messages/conversations reads)

```powershell
k6 run .\load-tests\supabase-backend.js `
  -e SUPABASE_URL=https://<project-ref>.supabase.co `
  -e SUPABASE_ANON_KEY=<anon-key> `
  -e EMPLOYER_JWTS=<jwt1,jwt2,jwt3> `
  -e CANDIDATE_JWTS=<jwt4,jwt5> `
  -e JOB_IDS=<job-id-1,job-id-2,job-id-3> `
  -e APPLICATION_IDS=<app-id-1,app-id-2,app-id-3> `
  -e CONVERSATION_IDS=<conv-id-1,conv-id-2>
```

## Current Thresholds

- `http_req_failed < 1%`
- Edge-function latency: `p95 < 2500ms`, `p99 < 5000ms`
- REST read latency: `p95 < 600ms`, `p99 < 1200ms`

Edit thresholds in `supabase-backend.js` as your SLA tightens.

## How To Interpret Results

Focus on:

1. `http_req_failed`
2. `http_req_duration` by tag (`kind:edge`, `kind:rest`)
3. `scenario_errors`

If failures spike:

1. Check Supabase logs for function errors/timeouts.
2. Run `EXPLAIN (ANALYZE, BUFFERS)` on top slow queries.
3. Verify that the new scaling indexes migration is applied.

## Notes

- Edge scenarios accept expected business statuses (`402`, `404`, `409`) as non-fatal where appropriate.
- To stress only one flow, disable other scenarios in `options.scenarios`.
