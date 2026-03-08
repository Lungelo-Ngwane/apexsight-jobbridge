# Production Cutover Checklist (Copy/Paste)

## 1) Point Frontend To Prod Supabase

Set these in your hosting provider (Production env vars):

```env
VITE_SUPABASE_URL=https://YOUR_PROD_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PROD_ANON_KEY
VITE_APP_URL=https://jobbridge.apexsight.co.za
VITE_ENFORCE_JOB_EXPIRY=true
GOOGLE_AUTH_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
```

## 2) Supabase Auth URL Configuration (Prod Project)

Set in Supabase Dashboard -> Auth -> URL Configuration:

- Site URL: `https://jobbridge.apexsight.co.za`
- Redirect URLs:
  - `https://jobbridge.apexsight.co.za`
  - `https://jobbridge.apexsight.co.za/`
  - `https://jobbridge.apexsight.co.za/*`

## 3) Link CLI To Prod Project

```powershell
supabase login
supabase link --project-ref YOUR_PROD_PROJECT_REF
```

## 4) Apply Migrations To Prod

```powershell
supabase db push
```

## 5) Set Supabase Function Secrets (Prod)

```powershell
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
supabase secrets set PAYSTACK_SECRET_KEY=YOUR_PAYSTACK_SECRET_KEY
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set APP_URL=https://jobbridge.apexsight.co.za
supabase secrets set FRONTEND_URL=https://jobbridge.apexsight.co.za
```

## 6) Deploy Functions (Prod)

```powershell
supabase functions deploy analyze-candidate-profile
supabase functions deploy auto-match
supabase functions deploy authorize-candidate-view
supabase functions deploy buy-addon
supabase functions deploy cancel-subscription
supabase functions deploy confirm-addon
supabase functions deploy confirm-subscription
supabase functions deploy consume-credit
supabase functions deploy feature-job
supabase functions deploy generate-ai-report
supabase functions deploy generate-embedding
supabase functions deploy generate-job-embedding
supabase functions deploy get-invoice-download-url
supabase functions deploy initialize-subscription
supabase functions deploy match-candidates
supabase functions deploy paystack-webhook
supabase functions deploy send-notification-email
```

## 7) Verify Core Data

Run in SQL Editor (Prod):

```sql
select count(*) as skills_count from public.skills;
select status, count(*) from public.jobs group by status order by status;
```

## 8) Smoke Test On Live URL

1. Register candidate
2. Register employer
3. Employer posts job
4. Candidate sees job list
5. Candidate applies
6. Employer shortlists candidate
7. Check shortlist email delivered
8. Check messaging works both ways

## 9) Final Guardrail

After successful cutover, verify no production deployment uses old Supabase project URL.
