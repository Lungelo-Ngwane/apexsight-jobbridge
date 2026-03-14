
# Design ApexSight Talent Platform

This repository contains the SkillLink candidate experience, the JobBridge employer workspace, and the Supabase backend that powers both.

## Quick start

1. Install dependencies:
   - `npm install`
2. Create local frontend env:
   - copy `src/.env.example` to `src/.env.local`
   - fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and any OAuth values you use
3. Start the frontend:
   - `npm run dev`

## Validation

- `npm run typecheck`
- `npm run build`
- `npm run validate`

## Supabase local development

1. Start the local stack:
   - `supabase start`
2. Rebuild the local database from migrations and seed data:
   - `supabase db reset`
3. The configured local seed file is:
   - `supabase/seed/skills_seed.sql`

## Required function secrets

Set these in Supabase for edge functions that need them:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `PAYSTACK_SECRET_KEY`
- `APP_URL`
- `RESEND_API_KEY`
- `FRONTEND_URL`

## Repository notes

- `supabase/migrations/` is the database source of truth.
- `public_schema.sql` is a schema reference stub, not the canonical schema export.
- Historical database snapshots are kept in `old_public_schema_backup.sql` and `prod_before_restore_backup.sql`.

## Documentation

- `PROJECT_DOCUMENTATION.md` for architecture and implementation details
- `PRODUCT_OPS_GUIDE.md` for product/operations guidance
- `RUNBOOK_PAYMENTS_AND_WEBHOOKS.md` for billing incident response
