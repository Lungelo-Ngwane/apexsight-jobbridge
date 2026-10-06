# JobBridge hardening report

Date: 2026-10-06. Scope: the approved local hardening following [the pre-implementation audit](audit-report.md), against baseline commit `80e4317`. Changes remain uncommitted. No push, publication, production migration/function deployment, credential reset, or history rewrite was performed.

## 1. Executive summary

The highest-risk local weaknesses were addressed: private candidate/profile access, browser-controlled billing fields, callable credit-grant routines, unauthenticated AI/notification operations, payment amount/currency trust, duplicate fulfillment, concurrent credit deductions, and account-switch races. The application keeps React/Vite/Supabase and its existing product boundaries.

The repository now has strict frontend/test and Edge type checks, lint, 34 Vitest tests, 3 Deno lifecycle tests, 3 browser smoke tests, current/history/bundle secret scans, and validation gates in CI/deployment. The migration chain executes in isolated PostgreSQL tests, and the production build succeeds.

**Recommendation: NOT PUBLIC-READY.** A confirmed historical authentication export remains reachable in Git. Local checks also do not establish production compatibility or live provider/OAuth/Storage correctness. The changes are reviewable locally; do not publish or deploy them before the owner actions below.

## 2. Security findings and fixes

| Finding | Local remediation | Outstanding action |
| --- | --- | --- |
| Authentication export containing one password hash, identity data, and four session/refresh records | Deleted the tracked export; ignored exports/crash artifacts; added scans that suppress matched values | Reset affected account password, revoke its sessions/refresh credentials, and coordinate all-ref history cleanup. |
| March grant-all migration reopened privileged routines | New forward migration revokes broad privileges and grants only reviewed browser RPCs; financial mutations are service-only | Verify effective grants on the actual staging schema and review future migrations for privilege changes. |
| Broad candidate/employer reads | Replaced private profile SELECT policies; introduced safe company/applicant projections and paid discovery; documents require authorized candidate access | Exercise anonymous, owner, unrelated employer, workspace member, and admin paths through the real gateway/Storage service. |
| Browser could update roles/subscription fields | Protected identity, ownership, billing, and derived AI fields; trusted signup creates profiles; candidate repair checks existing authoritative role | Reconcile legacy accounts with missing roles/profiles; validate registration and existing OAuth behaviour in staging. |
| Invitation claiming depended on email without confirmation | Shared server resolver and database RPC require a confirmed email from the Auth account | Test invited confirmed/unconfirmed accounts in staging. |
| Optional caller identity on AI/notification paths | Required verified identity and ownership/membership; shortlist notifications forward the caller token | Enforce production rate/cost budgets and verify service-to-service workflows. |
| Client-controlled credit skipping | Removed browser flags and server trust of the flag; authorized job embedding remains an included operation | Included/self-service AI endpoints still need operational rate limits and cost monitoring. |
| Optimistic deductions ignored row-count failure | Atomic SQL deduction checks balance and positive amount; candidate unlock combines usage/allowance/credit under a lock | Run multi-connection concurrency tests; define request idempotency and compensation for later AI/workflow failure. |
| Payment metadata/amount/currency trust and replay | Frozen server checkout intents, provider verification, raw-body HMAC verification, locked fulfillment, and leased durable webhook receipts | Replay real sandbox first-charge/renewal/cancellation/error events and reconcile old payments/subscriptions without intents. |
| Error/log disclosure | Generic public server errors, bounded JSON/raw webhook bodies, scrubbed persisted webhook reconciliation fields, no printed load-test JWTs, removed unused unrestricted logger | Older client console/error patterns and platform telemetry still need a consistent redaction/retention policy. |
| Unsafe/private persisted server results | Memory-only query cache, auth invalidation, stale-response guards, no new persisted employer activity | Existing account-scoped candidate drafts/preferences need a documented retention policy; clean obsolete activity keys on shared devices. |
| File upload boundary | Private resume bucket, MIME/size constraints, browser PDF size/extension/signature checks, restricted document reads | Validate actual Storage enforcement and existing CV/certificate paths. Browser checks alone cannot validate hostile file content. |

**Credential rotation:** The affected Auth account's password reset and session/refresh revocation are required. No committed privileged Supabase, Paystack, or AI API key was confirmed in this inspection. A historical JWT was classified as public `anon`, not a service-role credential. This evidence does not justify claiming that every possible credential is absent; perform an independent scan before publication. Rotate other credentials only if additional evidence establishes disclosure.

**History rewriting:** Required to remove the authentication export from every published branch/tag and any renamed copies. Local deletion is insufficient. The history scan still exits 1 and reports two classifications for the same historical file: password hash and authentication export.

## 3. Architecture changes

- `src/app/components/candidate/jobs/{JobCard,FilterContent,JobDetailsView,types}` separates presentation/contracts from search-page orchestration.
- `src/app/components/employer/EmployerDashboardJobCard.tsx` holds typed job-card presentation and accessible action controls; the dashboard retains mutations/navigation.
- `src/lib/employer/matching.ts` contains pure matching explanations. Tests found and fixed missing scores being converted to zero.
- `src/lib/candidate/saved-jobs.ts` separates account-scoped local preferences from candidate server operations and resolves identity once per toggle.
- `src/lib/publicProfiles.ts` centralizes safe company/applicant projections rather than reading private records directly.
- `supabase/functions/_shared/{http,payment-validation,payments}.ts` centralizes bounded input, safe failures, provider verification, invoice persistence, event processing, and replay handling. Browser confirmation, webhook, and admin retry share financial logic.
- `AppErrorBoundary` provides a root render fallback. Existing routing, local/context state, UI primitives, and lazy pages remain.

These are responsibility boundaries, not a full domain rewrite. Employer/candidate service facades and several containers remain large; further decomposition should follow actual change patterns and tests.

## 4. Testing

| Suite | Exact result | Important behaviours |
| --- | --- | --- |
| Vitest | **8 files, 34 tests passed** | 11 actual-SQL scenarios; auth hydration/account/role races and inactivity continuation; private cache dedup/expiry/reset; amount/currency/reference/ownership/HMAC; streamed body limits and safe errors; profile-save failure/retry; saved-job account isolation; missing matching scores and penalties. |
| Deno lifecycle tests | **3 passed, 0 failed** | Stale disable/failure cannot override active subscriptions; non-renewing access is retained until provider cancellation; current attention/cancellation states are applied. |
| Playwright browser smoke | **3 passed** | `/`, `/skilllink`, `/jobbridge` render without runtime errors; `/jobs` presents failure and retry; unauthenticated employer navigation redirects. |

All fixtures use fictional users/provider data. Browser tests launch with fictional public configuration and intercept external requests. They do not sign in real users or contact payment/AI/email services.

Database tests apply **all 92 migrations** to PGlite with pgvector and minimal Auth/Storage adapters. They test final RLS/grants and financial SQL rather than a mock repository. One connection queues requests: the queued credit-race scenario is not evidence of actual multi-session locking. Provider lifecycle tests stub the provider lookup and small client boundary; first checkout/renewal contract replay remains a staging requirement.

## 5. TypeScript

Enabled strict mode and fixed the baseline dialog prop error, nullability/callback errors, and session user typing. Tests are separately typechecked. All 24 Edge handler entry points pass Deno checking with pinned imports and a checked-in Edge dependency lockfile. Added explicit intent, projection, candidate summary, and dashboard card models.

Remaining weaknesses: legacy `any`, relation assertions, response overrides, and incomplete generated database types. Explicit-any lint enforcement is intentionally disabled rather than misrepresenting this debt as resolved. Types cannot substitute for runtime validation of external/provider/AI data.

## 6. Performance

Retained lazy page/modal loading, vendor chunks, parallel independent reads, short TTLs, and in-flight deduplication. Batched projection requests at 100 IDs. Stale account requests no longer write private data into the next account's UI/cache. Removed persistent copies of private query results/employer activity. Added the missing `expires_at` selection to the job visibility path.

The validated build transformed 2,435 modules. Largest shared vendor chunk: approximately 480.66 kB / 153.98 kB gzip. Router: 39.66 kB / 14.35 kB gzip; Supabase: 220.57 kB / 57.38 kB gzip; charts: 289.10 kB / 65.75 kB gzip. These are build sizes, not measured load time or Web Vitals.

Remaining concerns: browse/filter logic still works on fetched job collections and API row caps; talent/applicant paths have limits; some analytics need aggregates and server pagination. No realistic-volume throughput claim is made. k6 is unavailable in this environment.

## 7. Accessibility

Profile editing now uses the existing Radix dialog with focus handling, explicit labels, input bounds, busy/disabled controls, and inline error feedback. Candidate job titles are keyboard-operable; save controls have accessible names/pressed state. Dashboard job action controls have names/expanded state. Loading/error feedback is improved for jobs and candidate detail failures.

The dialog name and labelled edit/failure/retry behaviour are tested. Full screen-reader, keyboard, contrast, mobile, and WCAG conformance testing has not been completed. Older custom drawers and complex filters remain review targets.

## 8. Repository hygiene

Removed `backups/target-precutover-backup.json`, `backups/target-public-before-cutover.sql`, `old_public_schema_backup.sql`, `prod_before_restore_backup.sql`, `bash.exe.stackdump`, empty `src/lib/jobs.ts`, and unused `_shared/observability.ts`. Schema-only backup definitions were reviewed/reconstructed into a clean bootstrap migration before removal; no Auth data was restored. The bootstrap skips existing core schemas.

Added ignore rules for exports/backups, dump/bak/stackdump files, and browser output; migrations/seeds remain tracked. Added fake frontend/server environment examples. Removed unused imports/state and selected obsolete commented UI code. The load-test env generator writes credentials only to its ignored local output, not console. Supabase CLI is a development dependency; dependency updates remediate the baseline advisory findings.

Temporary validation scripts/caches and build output remain ignored local artifacts. No credentials or personal data were printed by scans.

## 9. Documentation

The root [README](../README.md) now explains the problem/features, stack rationale, architecture, frontend/state/API strategy, security, tests, local setup, variable names, scripts, decisions, and honest limitations. Added [engineering decisions](engineering-decisions.md) and [skeptical interview review](interview-review.md). The original audit remains historical evidence rather than being rewritten to erase its findings.

## 10. Validation results

| Check | Result |
| --- | --- |
| Lockfile installation | `npm ci --ignore-scripts --cache .tmp/npm-cache` passed, 472 packages added / 473 audited. Lifecycle scripts were deliberately not executed by this install check; Deno subsequently ran successfully. Initial retry was needed because the task's preview held a Windows native-module lock. |
| Lint | Passed. |
| Strict frontend/test typecheck | Passed. |
| Edge typecheck | Passed for all 24 handlers. |
| Vitest / Edge tests | 34 / 3 passed. |
| Browser smoke | 3 passed using installed Chrome and fictional/intercepted service configuration. |
| Production build | Passed. |
| `npm run validate` | Passed (lint, frontend/test types, Vitest, Edge types/tests, source scan, build). |
| `npm audit --json` | **0 vulnerabilities** in registry advisory output. This covers npm dependencies, not a guarantee about every CDN/provider dependency. |
| Current source scan | Passed. |
| Browser bundle pattern scan | Passed; no matched privileged credential value. Public configuration remains expected in browser output. |
| Git history scan | **Failed as expected: 2 classifications for the historical Auth export. Publication blocked.** |
| Real Supabase/Docker reset | Not run: Docker unavailable. Application SQL migration chain passed through the isolated test adapter. |
| k6 load checks | Not run: k6 unavailable. |
| Live OAuth/payment/AI/email/Storage workflows | Not run; no production data or resources were changed. |

Secret scans are deliberately narrow, value-suppressing regression guards. Use a dedicated independent scanner and human review before publication. No check is claimed beyond its actual scope.

## 11. Owner manual actions

### Resolve the confirmed historical disclosure before sharing Git history

1. Keep the repository private. Identify the affected account through restricted incident evidence; do not paste the dump or credentials into issues, chat, or public logs.
2. Reset that account's password and revoke all its Supabase sessions/refresh credentials. Review Auth logs for unexpected use and allow outstanding access tokens to expire under the actual project policy. None of these actions were performed locally.
3. Preserve necessary incident evidence outside Git under restricted access. Pause collaborator pushes and coordinate a history rewrite of the authoritative repository, including all branches/tags and any copies/forks being published.
4. In a fresh mirror, after the separate owner authorization for rewriting, use git-filter-repo to remove the private export:

   ```sh
   git filter-repo --path backups/target-precutover-backup.json --invert-paths
   ```

   Include additional paths if a fresh inspection finds renamed/copied exports. This changes commit IDs. Replace remote refs only through the coordinated owner procedure; collaborators must reclone or correctly repair their clones. Hosted caches, release attachments, and external forks may require separate removal. No rewrite/force-push was performed by this task.
5. Re-run `node scripts/security-scan.mjs --history` and an independent secret/privacy scan against the actual repository that will be shared. Confirm affected sessions are revoked; a clean scan does not revoke credentials.

### Stage the behaviour-changing backend rollout

1. Use an isolated, sanitized Supabase staging project. Compare its schema and effective grants with the repository; validate every new migration on both a fresh reset and an existing installation. The bootstrap migration is historical repair for fresh databases, not a production snapshot restore.
2. Preflight duplicate/noncanonical provider subscription bindings before the unique index; inspect legacy plans, credit/usage rows, missing account/profile records, and existing private document paths. Resolve drift deliberately rather than dropping constraints or weakening RLS.
3. Reconcile pre-change successful payments and subscriptions without server checkout intents/provider-plan bindings. Do not manufacture intents from browser metadata or replay arbitrary old references. The new handlers intentionally fail closed on unmatched/ambiguous payments.
4. Configure test provider plan codes, catalog minor-unit prices/currency, callback origin, webhook delivery, private invoice bucket, and server integration secrets. Deploy schema/functions/frontend in a coordinated staging release; rehearse failure recovery. SQL and old/new functions must not be mixed without review.
5. Exercise registration, existing Google login/recovery, confirmed/unconfirmed invites, workspace member permissions, safe applicant discovery, authorized unlocks, job creation/editing, interview notifications, and private CV/certificate downloads through the gateway.
6. Replay first payment, wrong amount/currency/workspace, duplicate/concurrent events, worker crash/lease expiry, invoice upload failure/retry, subscription creation before charge, renewal invoices, stale failure, non-renewing, cancellation, and replaced-subscription events in the provider sandbox. Add sanitized contract fixtures for the exact response shapes.
7. Run multiple concurrent database sessions for credit/unlock/payment invariants. Define compensation/request-idempotency for AI/workflow failures after debit; configure rate/cost limits for included/self-service AI operations and monitor failed reconciliation.
8. Verify SPA deep-link fallback, HTTPS, provider return routes, environment separation, operational logging/retention, and major keyboard/screen-reader flows. Run existing k6 scripts against staging with fictional accounts; never load-test production without separate authorization.

## 12. Remaining interview attack surface

See the 17 grounded challenges in [interview review](interview-review.md). Main unresolved topics: large service/container responsibilities, custom server-state caches, legacy `any` and relation assertions, incomplete server pagination, partly duplicated scoring rules, mixed async error handling/navigation guards, AI evaluation/cost/privacy controls, limited authenticated end-to-end coverage, and staging/operational reconciliation.

These are limitations to discuss and improve with evidence. Passing local tests does not erase them.

## 13. Recommendation

**NOT PUBLIC-READY.** The local hardening is implemented and validated within the stated scope, but the confirmed historical authentication export remains reachable. Owner account remediation and coordinated all-ref cleanup are required before public GitHub sharing. The changed backend also requires staging validation/reconciliation before a production deployment. Reassess readiness only after those concrete actions and independent review are complete.
