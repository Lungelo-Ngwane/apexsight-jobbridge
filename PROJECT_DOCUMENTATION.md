# Design ApexSight Talent Platform - Project Documentation

## 1. Project Overview

Design ApexSight Talent Platform is a two-sided hiring system with:

- `SkillLink` candidate-facing experience
- `JobBridge` employer-facing experience

Core capabilities:

- Candidate profiles, CV uploads, skills, applications
- Employer onboarding, job posting, applicant management
- Rule-based + AI-assisted candidate-job matching
- Messaging between employers and candidates
- Subscription billing (plans) + add-ons/credits
- Usage limits and paid feature enforcement

---

## 2. Technology Stack

### Frontend

- React + TypeScript (`Vite`)
- React Router
- Tailwind CSS + component primitives (`Radix UI`, custom UI components)
- Supabase JS client

### Backend

- Supabase Postgres (tables, RLS, SQL functions, triggers)
- Supabase Edge Functions (Deno)
- OpenAI (embeddings/report generation)
- Paystack (subscription/add-on checkout and webhooks)
- Resend (notification email)

---

## 3. Repository Structure

- `src/app/App.tsx` - route composition and app shell
- `src/app/context/AuthContext.tsx` - auth/session + role resolution
- `src/app/components/*` - UI pages/components
- `src/lib/*` - data/service layer for frontend to backend operations
- `supabase/migrations/*` - schema + RLS + SQL functions/triggers
- `supabase/functions/*` - edge functions
- `supabase/config.toml` - local Supabase config and function settings

---

## 4. Frontend Routing Model

Defined in `src/app/App.tsx`.

Public:

- `/`
- `/skilllink`
- `/jobbridge`

Candidate:

- `/candidate/dashboard`
- `/candidate/jobs`
- `/candidate/messages`
- `/candidate/profile`

Employer:

- `/employer/dashboard`
- `/employer/jobs`
- `/employer/candidates`
- `/employer/messages`
- `/employer/addons`
- `/employer/billing`
- `/employer/settings`
- `/employer/profile`

Employer routes are wrapped via `EmployerApp` + `EmployerLayout`, with onboarding gate based on `employer_profiles.onboarding_step`.

---

## 5. Authentication and Roles

### Auth Source

- Supabase Auth (`auth.users`)
- App roles resolved from `public.profiles.role`

### Role Handling

- `AuthContext` loads session and queries `profiles.role`
- Role types: `candidate | employer`

### Registration/Login

- `src/lib/auth.ts`
- `registerUser(...)`: signs up and sets metadata (`full_name`, `role`, optional `company_name`)
- `loginUser(...)`: signs in and resolves role from `profiles`

---

## 6. Core Domain Flows

## 6.1 Candidate Flow

Key file: `src/lib/candidate.ts`

- Get dashboard profile + related sections
- Manage skills and profile
- Upload CV (`resume` storage bucket path)
- Apply for jobs (`job_applications`)
- Trigger profile enrichment + embedding refresh (`refreshCandidateMatchingProfile`)

### CV Enrichment Pipeline

1. `analyze-candidate-profile` edge function:
   - Auth checks candidate owner
   - Reads profile + CV text
   - Uses AI extraction + direct CV text skill detection
   - Normalizes skills and attempts mapping to `skills.id`
   - Inserts missing candidate skills
   - Saves `resume_text`, `resume_summary`, `professional_bio_ai`, `resume_analysis`, `resume_last_analyzed_at`
2. `generate-embedding`:
   - Rebuilds candidate embedding from profile + skills + resume-derived fields

## 6.2 Employer Flow

Key file: `src/lib/employer.ts`

- Create/update/close jobs
- Fetch applicants and candidate deep view
- Update application statuses
- Run auto-match / AI report / featured jobs
- Billing plans/invoices
- Add-ons and credits
- Usage snapshot and candidate-view credit consumption

---

## 7. Matching and Scoring System

Primary SQL logic in `20260222000000_sync_application_scoring_and_ai_matching.sql` + later migrations.

### Rule-Based Score (`calculate_skill_match`)

Composed from:

- Required skills: up to 50
- Optional skills: up to 20
- Skill proficiency: up to 15
- Experience fit: up to 15

Total capped at 100.

### Current Optional Skill Logic

Updated in `20260225114500_redefine_optional_skill_score_from_candidate_extras.sql`:

- Rewards candidate skills outside required skills
- Approx. `4 points per extra skill` up to `20`

### AI Similarity + Hybrid

- Embedding similarity from `job_matches.similarity`
- Hybrid score in app layer combines:
  - rule score (`70%`)
  - AI similarity (`30%`)

### Auto-Match

- Edge function `auto-match` generates/uses embeddings and calls SQL RPC `match_candidates_with_scores`
- Writes/updates `job_matches`

---

## 8. Billing, Plans, Credits, and Gating

### Plans

- `free`, `starter`, `professional`, `enterprise`
- Frontend constants in `src/lib/plan.ts`
- Dynamic plan data fetched from `plans` table for billing pages

### Subscriptions

- Initialize: `initialize-subscription`
- Confirm: `confirm-subscription`
- Cancel: `cancel-subscription`
- Invoices stored in `billing_invoices`

### Add-ons/Credits

- Add-on checkout: `buy-addon`, `confirm-addon`
- Credit usage: `consume-credit`, `employer_credit_usage`
- AI features and candidate profile unlocks consume credits

### Plan-based Candidate Score Visibility (current behavior)

- Starter with no `ai_credit`: score block hidden in profile drawer with upsell CTA
- Professional: score visible, breakdown hidden
- Enterprise: score + breakdown visible
- In list modal, score badges visible only for Professional/Enterprise

---

## 9. Messaging System

Key files:

- `src/lib/messages.ts`
- migrations around `20260218132000...`

Features:

- Conversations between employer profile and candidate profile
- Thread list, message history, send/read
- Realtime subscriptions on messages/conversations

Core tables:

- `conversations`
- `messages`

---

## 10. Database Model (Operational Tables)

Main tables observed in code/migrations:

- Identity/profile: `profiles`, `candidate_profiles`, `employer_profiles`
- Candidate data: `candidate_skills`, `candidate_assessments`, `candidate_resumes`, `candidate_certifications`
- Jobs/applications: `jobs`, `job_skills`, `job_applications`, `job_matches`
- Matching outputs: `job_ai_reports`
- Catalog/config: `skills`, `plans`, `addons`
- Billing/credits: `billing_invoices`, `employer_credits`, `employer_credit_usage`, `employer_addon_purchases`
- Messaging: `conversations`, `messages`

RLS is enabled broadly and reinforced via SQL helper functions/policies.

---

## 11. Edge Functions Inventory

Configured in `supabase/config.toml`:

- `send-notification-email`
- `initialize-subscription`
- `confirm-subscription`
- `cancel-subscription`
- `paystack-webhook`
- `generate-embedding`
- `generate-job-embedding`
- `match-candidates`
- `auto-match`
- `buy-addon`
- `confirm-addon`
- `consume-credit`
- `feature-job`
- `generate-ai-report`
- `authorize-candidate-view`
- `get-invoice-download-url`
- `analyze-candidate-profile`

---

## 12. Environment Variables

### Frontend (`src/.env.local`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL` (optional fallback behavior in auth flows)

### Edge Functions (Supabase secrets/env)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `PAYSTACK_SECRET_KEY`
- `APP_URL`
- `RESEND_API_KEY`
- `FRONTEND_URL` (email links; optional fallback chain in email function)

---

## 13. Local Development

1. Install deps:
   - `npm i`
2. Frontend dev:
   - `npm run dev`
3. Supabase local (if used):
   - `supabase start`
   - `supabase db reset` (or `supabase db push`)
4. Build check:
   - `npm run build`

---

## 14. Deployment Runbook

### Frontend

- Build and deploy Vite output (`dist`) via your hosting pipeline.

### Database

- Apply schema changes:
  - `supabase db push`

### Edge Functions

- Deploy only changed functions, e.g.:
  - `supabase functions deploy analyze-candidate-profile`
  - `supabase functions deploy generate-embedding`
  - `supabase functions deploy auto-match`

---

## 15. Security and Access Model

- JWT-authenticated frontend with Supabase Auth
- DB protection by RLS policies
- Edge functions use service-role but enforce user/session checks where needed
- Payment and email operations use privileged secrets in function env

Important:

- Keep `verify_jwt` aligned with function-level auth logic.
- Do not leave test bypasses (credit/jwt) in production branches.

---

## 16. Known Implementation Notes

- CV storage bucket usage appears as `resume` in candidate upload flow.
- `getCandidateCV` references `resumes` bucket in one path (`src/lib/employer.ts`); verify bucket naming consistency.
- Legacy `applications` table appears in old migrations; active application flow uses `job_applications`.

---

## 17. Maintenance Guidance

- Treat `src/lib/*.ts` as canonical frontend-backend contract layer.
- Add new business rules first in SQL (RLS/functions/triggers), then expose via edge functions/lib clients.
- For matching changes:
  - update SQL scoring functions
  - backfill/recompute existing rows where needed
  - verify deep-view and modal UI gating by plan/credits.

---

## 18. Changelog Focus Areas (Recent)

- Candidate CV analysis and enrichment pipeline added
- Candidate embedding now includes resume-derived fields
- Optional score logic changed to candidate extra-skill model
- Candidate score visibility gated by plan + AI credits
- Auto-match rerun integrated into profile viewing flow

