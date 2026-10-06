# JobBridge production and interview readiness audit

Date: 6 October 2026. Baseline: `80e4317`. Recommendation: **NOT PUBLIC-READY**.

This is the pre-implementation audit. No application, database, or payment changes have been applied. The requested implementation must pause at the behaviour-changing security decisions below, under constraint 18 of the supplied request. This document is not a claim that the subsequent hardening phases are complete.

## Scope and evidence limits

Inventoried 306 tracked files, 85 migrations, 24 Edge Function handlers, frontend pages/services/hooks, assets, dependency configuration, deployment workflows, operational documentation, seeds, reset scripts and backups. Performed repository-wide static searches and scanned all locally reachable Git blobs for common credential patterns, with values suppressed. Read the main authentication, authorization, payment, storage, AI, cache and workflow paths and migration security declarations. This is a static repository audit, not a live penetration test or a line-by-line certification of every component.

No production credentials were used, no remote database was queried, no production data was modified, and no Git history was rewritten. Live schema drift, provider configuration, remote branches not present locally, deleted/unreachable Git objects, hosting settings, and deployed function behaviour remain unverified. Pattern searches cannot prove absence of secrets or personal data.

## Architecture and state strategy

React and TypeScript run as a Vite browser SPA. `src/main.tsx` installs BrowserRouter, theme context and auth context. `src/app/App.tsx` owns route definitions, lazy route imports and login/recovery orchestration. Candidate and employer pages call `src/lib/candidate.ts`, `employer.ts`, `messages.ts`, and `admin.ts`. Browser data access uses the Supabase public key; privileged work runs in Deno Edge Functions using environment-provided service credentials. PostgreSQL migrations implement RLS, membership checks, matching/scoring, billing and administrative RPCs. Storage holds CVs, certificates, logos and invoices. Paystack handles checkout; OpenAI processes resume/job text and generates embeddings and reports; Resend sends notifications.

UI state is predominantly component-local. Authentication and theme use context. Server state uses service-local TTL caches, a generic memory/sessionStorage query cache, and employer/admin hooks. Filters and pagination are derived from fetched arrays. Some activity and saved-job state persists in browser storage. This strategy is reasonable at the current scale, but cache ownership, invalidation and stale requests need correction. There is no demonstrated need to add a global state library merely to improve interview presentation.

## CRITICAL

### C1. A tracked backup contains real authentication data

- **Files/evidence:** `backups/target-precutover-backup.json`, introduced in commit `185a423` on 18 March 2026. Contains one `auth.users` record, one identity, four sessions and four refresh-token records; password-hash and populated auth-token patterns were detected. Email addresses and identity metadata are also present. Values intentionally omitted.
- **Why:** Password hashes enable offline attacks; session/refresh data and personal identifiers must not be published. Deleting the working-tree file does not remove history.
- **Proposed fix:** Remove this backup from the repository tip; retain any operational backup only in controlled external storage. Ignore backup/dump outputs and add automated secret/privacy checks. No fixture requires these real records.
- **Behaviour:** Removing the backup has no runtime effect. History cleanup changes commit identities and must be coordinated separately.
- **Manual action:** Reset the affected account's password, revoke its sessions/refresh tokens using supported Auth administration, and inspect access logs. Determine whether its password was reused. Rewrite all affected published refs before making the repository public; inspect forks, PR refs, CI artifacts and clones. Do not use the dumped tokens to test whether they still work. Provider/API-key rotation is not established by this finding alone.

### C2. A later migration undoes privileged function restrictions

- **Files:** `supabase/migrations/20260318140000_restore_public_schema_grants.sql`; earlier restrictions in `20260304143000_harden_rls_function_access_and_message_update.sql` and `20260310011500_fix_grant_addon_credits_ambiguity.sql`.
- **What:** The later migration grants ALL on all public routines to `anon` and `authenticated`, including `grant_addon_credits`. That SECURITY DEFINER function accepts caller-supplied employer, reference, payment amount and credit quantity without verifying payment or caller identity.
- **Why:** If deployed as written, a direct RPC caller can mint credits without paying. Table RLS does not protect a privileged function executing with its owner's privileges.
- **Proposed fix:** Add a forward migration restoring service-only execution for payment mutation functions and an explicit allowlist for browser RPCs; review all SECURITY DEFINER routines and default privileges. Add anonymous/authenticated allow/deny database tests. Do not edit away previously deployed migration history.
- **Behaviour:** Client calls to previously exposed privileged RPCs will fail. Legitimate Edge Functions retain service-role execution; any undocumented integrations need staging verification.

### C3. Candidate data and employer private fields have broad authenticated reads

- **Files:** `20260221233000_enable_rls_for_used_tables.sql`, subsequent team policies in `20260311120000_add_employer_team_collaboration.sql`, `src/lib/employer.ts`, `src/lib/candidate.ts`.
- **What:** Candidate profiles and skills have authenticated SELECT policies using `true`; employer profiles also retain a broad authenticated SELECT policy. Adding narrower policies does not cancel an existing permissive one. Resume text, personal details and payment-related employer columns share these rows; the browser employer profile loader uses `select("*")`.
- **Why:** Any signed-in account can request columns omitted by the UI. Paid candidate-view controls cannot protect information already readable through the Data API. Employer subscription email tokens must not be a public company-profile attribute.
- **Proposed fix:** Separate explicitly public discovery/company fields from private records via safe projections/RPCs and restrict private reads to owner/authorized workspace relationships. Define exactly what employer talent-pool discovery is intended to reveal before replacing these policies. Test unrelated users, candidates, employer owners/recruiters and admins.
- **Behaviour:** This affects discovery, public company pages, matching and profile joins. A blanket policy deletion could break legitimate product flows; design and approval are required first.

### C4. Profile ownership policies do not protect privileged columns or account roles

- **Files:** `20260221233000_enable_rls_for_used_tables.sql`, `20260311120000_add_employer_team_collaboration.sql`, `20260320110000_backfill_and_sync_auth_profiles.sql`, `20260317143000_add_auto_shortlist_addon_and_plan_bonus.sql`.
- **What:** Own-profile INSERT/UPDATE checks restrict row identity, but not role or billing columns. The signup trigger accepts user metadata role `admin`. Employer owner/admin workspace updates are not limited to presentation fields; no sufficient billing-column guard was found in the migration chain. Plan bonus credits are granted by a trigger when the row claims an active paid plan.
- **Why:** A manually crafted request can bypass UI restrictions on account role/paid state and may trigger credit bonuses. The separate `admin_users` checks protect actual admin RPCs, so metadata role `admin` alone is not proof of full admin access.
- **Proposed fix:** Allow only candidate/employer public signup; protect role, ownership and subscription/bonus/provider columns with column grants and server-side guards. Use trusted billing operations to change paid state. Restrict creation of candidate/employer profiles by validated account role.
- **Behaviour:** Removes currently available direct writes and may affect onboarding, settings and profile creation. Audit those payloads before applying.

### C5. Privileged AI and notification endpoints fail open without a valid actor

- **Files:** `supabase/functions/generate-embedding/index.ts`, `analyze-candidate-profile/index.ts`, `generate-job-embedding/index.ts`, `send-notification-email/index.ts`; `supabase/config.toml`.
- **What:** Candidate embedding/analysis checks ownership only when `userId` is truthy; missing or invalid tokens leave it null. Job embedding performs service-role mutations without verifying identity/ownership. Notification application/interview checks are conditional on a non-null actor; welcome email has stronger checks. Gateway JWT verification is disabled for these endpoints.
- **Why:** Anonymous callers can trigger billable AI, alter candidate/job records or send notifications for resources they do not own. Analysis sends sensitive resume content to an external processor.
- **Proposed fix:** Fail closed on missing/invalid identity; authorize resource ownership/workspace membership before reading private data or invoking providers. If internal jobs need access, provide a separately authenticated internal path. Require notifications to match stored workflow state and add abuse controls.
- **Behaviour:** Unauthenticated automation will stop working. Identify internal callers and replace them with explicitly authenticated calls before rollout.

## HIGH

### H8. Dependency audit reports unresolved advisories

- **Files:** `package.json`, `package-lock.json`.
- **What:** `npm audit --package-lock-only --json` reports 17 findings: 1 critical, 12 high, 3 moderate and 1 low. The critical dependency is transitive `tar` through the Supabase CLI; direct affected packages include Vite, react-router-dom, Supabase CLI and uuid. Other reported dependencies include ws, lodash, Rollup, PostCSS and glob/browser tooling.
- **Why:** Build/CLI/dev-server vulnerabilities matter even when their affected server features are not present in the shipped SPA. Advisory severity alone is not proof that the deployed browser app is exploitable; assess each vulnerable call path.
- **Proposed fix:** Update compatible pinned packages and regenerate the lockfile, move CLI tooling to development dependencies, inspect transitive resolution and rerun all validation. Avoid blind `audit fix --force`. Vite's reported compatible fix is 6.4.4; the existing pnpm override also pins 6.3.5 and needs review.
- **Behaviour:** Compatible maintenance updates can still affect build, routing and CLI behaviour; validate them before deployment.

### H1. Client-controlled AI credit bypass

- **Files:** `auto-match/index.ts`, `generate-job-embedding/index.ts`, `src/lib/employer.ts` (create/update job paths pass `skip_credit: true`).
- **What/why:** Request bodies determine whether credits are charged. Authentication alone cannot justify a billing bypass.
- **Fix:** Derive entitlement from trusted plan/workflow state, including the intended free embedding-on-job-write behaviour; remove the browser's authority to choose charging.
- **Behaviour:** May charge operations that were previously free unless the server models the existing entitlement. Requires an explicit product rule and staging payment tests.

### H2. Credit deductions can report success without updating a row

- **Files:** `consume-credit`, `auto-match`, `generate-job-embedding`, `auto-shortlist`, `authorize-candidate-view` Edge Functions.
- **What/why:** Read-then-update paths use an expected remaining balance but check only database errors, not affected rows. A concurrent request can update zero rows without an error. Usage/grant side effects are not consistently in one transaction.
- **Fix:** Atomic database consumption RPC with positive integer validation, balance checks, affected-row enforcement and unique operation identifiers. Pair usage with the deduction transaction; define provider-failure refund/retry semantics.
- **Behaviour:** Conflicting requests return failure instead of success; credits and retries need reconciliation testing.

### H3. Payment verification lacks a durable expected order boundary

- **Files:** `initialize-subscription`, `buy-addon`, `confirm-subscription`, `confirm-addon`, `paystack-webhook`, `admin-retry-webhook`.
- **What:** Confirmation calls provider verification and checks success/metadata, but expected amount/currency are not consistently checked before fulfillment. Webhook fulfillment resolves employer/plan/add-on from provider metadata and current catalog. Subscription amount conversion guesses units from magnitude. Payment logic is duplicated between webhook, confirmation and admin retry.
- **Why:** Authentic provider events establish origin, not that the received amount/currency purchased the claimed entitlement. Catalog changes and stale references can change fulfillment meaning.
- **Fix:** Persist server-generated checkout intent (employer, kind, reference, expected amount in minor units, currency and entitlement), verify it consistently on every fulfillment path, and share a small payment domain layer. Specify stale subscription and catalog-change policy.
- **Behaviour:** Existing checkouts without intents need a carefully constrained migration/expiry strategy. Reconciliation and deployment sequencing are required.

### H4. Webhook receipt deduplication is not an atomic processing claim

- **Files:** `paystack-webhook/index.ts`, `admin-retry-webhook/index.ts`, `20260304123000_harden_payment_idempotency_and_reconciliation.sql`, `20260310011500_fix_grant_addon_credits_ambiguity.sql`.
- **What/why:** Duplicate receipts are ignored only after status is processed; concurrent received/failed deliveries can process together. Invoice/receipt operations sometimes ignore errors, and subscription events can arrive out of order. Add-on credit granting has useful transaction locking, but trusts the supplied credit target, so replay after catalog changes can increase delivery.
- **Fix:** Atomic claim/lease and persisted immutable fulfillment data; check every persistence error; retry failed work safely; protect newer subscriptions against stale disable events. Exercise simultaneous delivery, crash recovery and confirmation/webhook races.
- **Behaviour:** Changes retries and subscription transitions. Test against Paystack fixtures before applying.

### H5. Migration chain cannot establish a clean baseline

- **Files:** `supabase/migrations/`, `old_public_schema_backup.sql`, `public_schema.sql`, `README.md`.
- **What/why:** Migrations reference core tables (`profiles`, `candidate_profiles`, `employer_profiles`, `plans`, `skills`, `job_applications`) without creating them. Early jobs reference auth users while later code expects employer-profile IDs. `public_schema.sql` is a stub, not an executable baseline. A fresh `supabase db reset` is not demonstrably reproducible.
- **Fix:** Reconstruct a sanitized canonical baseline from reviewed schema definitions, reconcile it with subsequent migrations and test clean local resets. Do not restore auth backups or blindly replay the old snapshot into production.
- **Behaviour:** Baseline is for fresh environments; changing deployed history or applying resets remotely would be unsafe and is outside authorization.

### H6. No automated behaviour tests, lint gate or deployment validation gate

- **Files:** `package.json`, `.github/workflows/deploy-prod.yml`, `.github/workflows/release.yml`, `TEST_CASES_FULL.md`, `load-tests/`.
- **What/why:** Only typecheck/build validation is scripted. Manual test plans and credential-dependent k6 scenarios do not establish regression safety. Tag deployment has no repository lint/test/typecheck gate.
- **Fix:** Add frontend behavioural tests for auth/routes/application flows, cache isolation, service error states; Edge tests for denied access and payments; SQL allow/deny tests; lint and CI validation. Run load tests only on isolated fictional staging data since scenarios mutate state and consume credits.
- **Behaviour:** No intended product change; deploy failures should block release rather than publish broken code.

### H7. Authentication changes can leave stale private browser state

- **Files:** `src/lib/candidate.ts`, `src/lib/queryCache.ts`, `src/app/context/AuthContext.tsx`, `src/hooks/useEmployerProfile.ts`, `EmployerDashboard.tsx`.
- **What/why:** Candidate profile-context cache returns before resolving the current user and is not keyed by user. Generic cache invalidation cannot prevent an older request from repopulating the entry. Signout does not centrally purge server-state caches. Employer hook/dashboard async results lack consistent cancellation on account changes.
- **Fix:** Scope caches by verified session/user, reset them on auth transitions, use generation/request ownership for invalidation and hook results. Add account-switch/signout/invalidation-race tests.
- **Behaviour:** Old cached data is discarded and extra reads may occur; intentional privacy/correctness improvement.

## MEDIUM

### M1. Type checking is non-strict and database boundaries are weakly typed

- **Files:** `tsconfig.json`, `AuthContext.tsx`, `useEmployerProfile.ts`, `employer.ts`, `candidate.ts`, `admin.ts`, dashboard/pages.
- **What/why:** `strict: false`, Supabase client without generated schema types, auth user typed `any`, repeated assertions and duplicated `CandidateSkillRow` declarations. Build success cannot prove domain payload correctness.
- **Fix:** Enable strict mode, use Supabase User and explicit domain DTOs, generate database types only from a trusted sanitized schema; parse unknown provider data at boundaries.
- **Behaviour:** Mostly compile-time; fixes for null/error cases must be behaviour-tested rather than hidden by casts.

### M2. Genuine service and page responsibility boundaries need extraction

- **Files:** `employer.ts` (2,867 lines), `candidate.ts` (1,378), `CandidateJobsPage.tsx` (1,233), `EmployerDashboard.tsx` (1,133); settings/jobs/profile/billing pages and candidate analysis function are also large.
- **What/why:** Employer module combines context/team/profile, job CRUD, candidate scoring, analytics and billing; candidate module combines profile/files, jobs/applications, saved jobs and caching. Pages combine orchestration, filters, cards/details, checkout and analytics rendering.
- **Fix:** Extract employer context/profile, jobs/applications, billing and matching utilities; candidate profile/files, jobs/applications and saved jobs; page feature components/hooks at those boundaries. Keep compatibility exports initially. Do not split generated-style UI primitives just for line count.
- **Behaviour:** Intended neutral, but verify workflows before and after each extraction.

### M3. Client pagination hides unbounded data access

- **Files:** `getOpenJobs` in `candidate.ts`, employer jobs/talent-pool functions, `CandidateJobsPage.tsx`, `EmployerDashboard.tsx`.
- **What/why:** Pages slice full returned arrays; queries lack meaningful server pagination on several paths. At Supabase row caps this can silently omit jobs/candidates while looking complete. Profile reads may fetch resume/embedding fields unnecessarily.
- **Fix:** Server filtering/order/pagination with explicit projections, stable paging keys and counts; retain existing parallel independent reads and route splitting. Measure before adding memoization.
- **Behaviour:** Query pagination affects URL/filter behaviour and requires integration tests; public browsing must remain available.

### M4. Async errors often become empty data or console-only failures

- **Files:** `CandidateJobsPage.tsx`, `EmployerDashboard.tsx`, `EditProfileModal.tsx`, `useEmployerProfile.ts`, Edge Function catch responses, `_shared/observability.ts`.
- **What/why:** User-visible retry/error states are missing on several critical loads. Many server responses return `String(error)` or database messages; logs accept arbitrary error/context values without redaction. No application error boundary was found at the root.
- **Fix:** Distinguish loading/empty/error state, offer retry, add a route/application boundary, return stable safe errors and request IDs, redact token/PII/provider payload fields from logs. Preserve actionable diagnostics privately.
- **Behaviour:** Errors become visible and production detail exposure decreases.

### M5. Session lifecycle has races and inactivity continuation gaps

- **Files:** `AuthContext.tsx`, `auth.ts`.
- **What/why:** Session hydration and auth callbacks independently load roles; an older hydration may overwrite newer auth state. Profile loading uses IDs but not a generation token. `continueSession` clears inactivity timers without immediately scheduling replacements, so monitoring resumes only after another tracked activity. Supabase signout's returned error is not checked before local state is cleared.
- **Fix:** Single lifecycle/generation model, defer asynchronous auth work outside callback locks, explicitly restart inactivity timers and handle signout errors. Test initial hydration, rapid account switches, expiry and continuation with fake timers.
- **Behaviour:** Corrects timing/error handling; verify OAuth and recovery flows.

### M6. Upload and runtime payload validation is inconsistent

- **Files:** `uploadCandidateCV`/certification in `candidate.ts`, storage migrations, AI/payment/matching Edge Functions.
- **What/why:** Certificate checking relies on client filename/MIME; CV service lacks an equivalent limit/type boundary. Reviewed buckets do not consistently declare MIME/size limits. Many endpoints coerce or assert JSON rather than validate bounded objects/UUIDs/enums. Provider calls lack consistent timeouts, input limits and abuse budgets.
- **Fix:** Server/storage limits, validated payloads, bounded files/text, safe identifiers and constrained AI output. Treat prompt content as untrusted data and document resume processing/retention and user consent.
- **Behaviour:** Invalid/oversized inputs will be rejected; define limits before rollout.

### M7. Accessibility requires focused modal and form fixes

- **Files:** `EditProfileModal.tsx` (used by CandidateDashboard), large dashboard/page custom controls; `ui/dialog.tsx` and `ui/circular-loader.tsx` provide useful existing primitives.
- **What/why:** Edit-profile overlay is a div with placeholder-only fields, no dialog semantics/focus trapping, escape handling or inline error status. Icon-only and clickable card controls need a keyboard/name review.
- **Fix:** Use the existing Radix dialog, associated visible labels, form submission semantics, inline error/status feedback, accessible names and keyboard tests. Smoke-test focus return and mobile dialogs.
- **Behaviour:** Interaction/focus improves without redesign; browser testing is still needed.

### M8. Browser guards are incomplete and cannot substitute for authorization

- **Files:** `App.tsx`, `ProtectedRoute.tsx`, `EmployerApp.tsx`, admin pages/hooks.
- **What/why:** ProtectedRoute is unused; protection is distributed between App redirects and page-level checks. It checks authentication only and redirects to `/login`, which has no matching route. Admin RPCs do perform separate server checks.
- **Fix:** Explicit authenticated/role route boundaries with loading/recovery/public browsing behaviour preserved. Keep independent server/RLS checks and test direct navigation.
- **Behaviour:** Unauthorized navigation becomes consistent; OAuth and public job routes need regression checks.

## LOW

### L1. Repository hygiene and misleading setup documentation

- **Files:** `.gitignore`, `bash.exe.stackdump`, historical SQL snapshots, `src/lib/jobs.ts` (empty), `src/lib/permission.ts`, commented code in App, `guidelines/Guidelines.md`, `README.md`, trial/cutover runbooks.
- **What/why:** Backup/dump/stackdump files lack targeted ignore rules. README references missing `src/.env.example` and recommends unreproducible database reset. Historical trial docs require current-status annotations. Some stale comments/empty/template artifacts obscure the architecture.
- **Fix:** Remove understood artifacts, protect database exports without ignoring migrations/seeds, provide fake local env template and honest setup instructions; reconcile references before removing schema snapshots. Never interpret a schema-only pg_dump restrict token as an API secret.
- **Behaviour:** No intended runtime impact; preserve schema definitions needed to reconstruct the baseline before deleting them.

### L2. Secret scans need context rather than indiscriminate rotation

- **Files:** Historical `supabase/functions/generate-embedding/index.ts` in `df24c35a7b2f`; environment examples; load-test env generator.
- **What/why:** A historical JWT payload identifies the key as `anon`, not service-role. `sk_test_` detection in initialize-subscription is a mode check, not a literal credential. Env examples use placeholder Supabase values but real application URLs; they should use clearly fictional URLs. Load-test tooling prints generated JWTs.
- **Fix:** Remove hardcoded public-key history alongside privacy cleanup if desired; stop printing bearer tokens in tooling, retain ignored local env outputs, make examples fictional. Public anon keys are intentionally browser-visible; RLS is their security boundary.
- **Behaviour:** Tool output changes only. No privileged provider credential was established by the scans; rotate provider keys if independent evidence shows exposure, not merely because a public key exists.

## GOOD PRACTICE / STRENGTH

- Route-level React.lazy/Suspense and manual vendor chunks already exist (`App.tsx`, `vite.config.ts`). Retain and measure them; no architecture change proposed.
- Many employer endpoints use a shared `resolveEmployerContext` that verifies the token with Auth and checks membership roles (`functions/_shared/employer.ts`). Extend consistent use rather than replace Supabase.
- Paystack webhook uses raw-body HMAC SHA-512 verification and constant-time-style comparison before parsing; provider confirmation occurs server-side. Retain these controls while fixing order validation and atomic fulfillment.
- Add-on granting locks the purchase row and has reference ownership/add-on checks. Preserve that transactional foundation and bind it to immutable verified fulfillment data.
- Admin RPCs check the separate admin-users table; messages enforce participant policy and read-receipt-only updates. Keep these independent server checks.
- Certificates/invoices use private storage patterns; logo public access is intentional. Retain private buckets and verify live resume configuration.
- Lockfile, migration history, hot-path indexes, fake Supabase example keys, typed messaging DTOs, reusable Radix UI, delayed loaders and k6 scenarios are useful foundations. No gratuitous dependency replacement is proposed.

## Approval needed before behaviour-changing security implementation

The requested constraint says: “If a security fix could break existing production behaviour, stop and explain before applying it.” The concrete proposed changes are C2–C5 and H1–H4: least-privilege RPC/column grants; private candidate/employer reads with safe discovery projections; immutable roles/billing columns; mandatory authenticated AI/email callers; server-derived credit entitlements; and verified, atomic payment fulfillment.

These deliberately reject requests currently accepted by the code. In particular, `skip_credit: true` is used by the browser for create/edit job embeddings, so simply removing it would change charging; internal AI/email automation may currently call without user identity; discovery currently depends on broad profile reads. Proceed with local code and forward migrations only after agreeing that those behaviours should be secured. Do not deploy, execute migrations remotely, reset data, rewrite history, rotate credentials or push.

## Implementation and validation order after that decision

1. Remove the sensitive tracked backup and protect future exports; add secret/privacy regression checks. Owner performs account remediation/history cleanup separately.
2. Reconstruct and validate a clean local schema baseline. Add role/tenant/column/RPC/storage allow-and-deny tests before claiming authorization correctness.
3. Secure identity and payment trust boundaries with forward migrations and shared tested logic; exercise provider retries/concurrency and retain product entitlements.
4. Fix auth/cache lifecycle, enable strict TypeScript, establish lint/behaviour tests and CI; extract real service/page boundaries incrementally.
5. Fix critical error/loading states and accessible forms/dialogs; implement defensible query bounds and validate public routes.
6. Update README, `docs/engineering-decisions.md`, and `docs/interview-review.md` to describe the final code rather than future intentions. Perform the requested second skeptical review and final validation report.

No tests have been added at this audit stage. Build/typecheck results, dependency findings and tool availability are recorded below after baseline execution. No passing assertion should be inferred from an unexecuted check.

## Baseline validation actually executed

Environment: Node 24.21.0, npm 11.19.0 on Windows. Used `npm.cmd` because PowerShell blocks the npm.ps1 wrapper. Initial sandbox installation/audit failed; the permitted escalated commands succeeded. Dependency install intentionally used `--ignore-scripts`, so this does not verify package lifecycle/install scripts.

| Check | Result |
| --- | --- |
| `npm.cmd ci --ignore-scripts --cache .tmp/npm-cache --fetch-retries=0 --fetch-timeout=20000` | Passed: 319 packages installed, 320 audited. |
| `npm.cmd run typecheck` | Failed: AuthContext passes unsupported `showCloseButton` to DialogContent. |
| `npm.cmd exec -- tsc --noEmit --strict` | Failed: 13 diagnostics across profile skill nullability, callback implicit-any, job payload nullability, auth dialog prop, nullable add-on result and permission count/indexing. |
| `npm.cmd run build` | Passed: 2,422 modules, 8.16 seconds; vendor chunk 480.25 kB (153.15 kB gzip), Supabase 166.42 kB, Recharts 289.10 kB. This is asset generation, not proof that type checking or runtime works. |
| `npm.cmd audit --package-lock-only --json --cache .tmp/npm-cache --fetch-retries=0 --fetch-timeout=20000` | Ran, exit 1: 17 advisories (1 critical, 12 high, 3 moderate, 1 low). Report stored in ignored `.tmp/dependency-audit.json`; no dependency upgrades applied. |
| Browser bundle credential pattern scan | No JWT, Paystack secret, OpenAI project-key or Supabase secret-key values detected in generated JS. This local build had no frontend `.env.local`; deployed environment substitution is not verified. |
| Lint and behaviour tests | No lint or test script/configuration exists; invocation cannot validate behaviour. |
| Deno / Docker / k6 | Executables not found on PATH; Edge checking, clean database reset, RLS integration and load scenarios not run. |
| Browser smoke | Not run: no configured local frontend environment; even a successful asset build reaches the missing-Supabase-env startup error. Hosted Auth/payment/AI flows were not exercised. |

Additional historical searches found a database connection example in `PROD_CUTOVER_CHECKLIST.md` with placeholder credentials, not an established database-password disclosure. Current environment examples have placeholder Supabase values. The auth backup remains the confirmed historical private-data exposure.

The only tracked change at this stage is this report. Installation and build produced ignored local artifacts. Sensitive backups remain tracked pending implementation; the repository is still **NOT PUBLIC-READY**.

## Owner-controlled history remediation procedure

Do not run this automatically as part of the hardening pass. First remediate the affected Auth account, pause collaborator pushes, and preserve any required incident evidence in restricted external storage. From a fresh mirror of the authoritative remote, use git-filter-repo to remove `backups/target-precutover-backup.json` from every branch/tag being published, including any renamed copies found in an additional history inspection:

```sh
git filter-repo --path backups/target-precutover-backup.json --invert-paths
```

Rescan the rewritten mirror for authentication records, hashes, refresh tokens and personal data before approving any replacement refs. Coordinate replacement of remote branches/tags with the repository owner and hosting provider, clean retained pull-request/cache/artifact copies where supported, and have collaborators re-clone rather than merge old history back. A force push, remote cleanup and credential/session remediation are separate owner actions; none were performed here. Rewriting this one local checkout cannot remove copies from forks or other people's clones.

## Reference guidance

The database privilege and column-access recommendations follow [Supabase database functions](https://supabase.com/docs/guides/database/functions) and [column security](https://supabase.com/docs/guides/database/postgres/column-level-security). Payment-origin and fulfillment checks follow [Paystack webhooks](https://paystack.com/docs/payments/webhooks/) and [payment verification](https://paystack.com/docs/payments/verify-payments/). These support the proposed controls; the repository-specific findings above come from local code inspection.
