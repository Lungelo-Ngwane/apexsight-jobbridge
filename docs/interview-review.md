# Interview review

This is a second review of the hardened working tree from the perspective of a skeptical Staff Engineer. These are study prompts grounded in the code, not scripted interview answers. The original audit preserves the pre-change findings; the readiness report records validation and release blockers.

## 1. Component architecture and large pages

**Question:** Where do you draw a component boundary, and why are some pages still large?

**Why an interviewer would ask it:** Candidate search and employer dashboards combine state, data, policy presentation, and substantial markup.

**What the current code does:** Candidate job cards, filters, and details are extracted into `components/candidate/jobs`; dashboard job card presentation is extracted into `components/employer/EmployerDashboardJobCard.tsx`. Containers retain orchestration.

**Strength:** The boundaries reflect separately meaningful UI responsibilities and preserve the existing stack.

**Weakness / trade-off:** Containers and several unrelated pages still combine many concerns. Some extracted components have long markup and callback-heavy interfaces.

**How it could be improved:** Extract a data lifecycle hook when a concrete repeated pattern emerges; add focused component tests before moving complex mutation behaviour.

## 2. Hooks and asynchronous cancellation

**Question:** What happens if an employer changes accounts while profile or dashboard requests are pending?

**Why an interviewer would ask it:** Private data must not overwrite the next account's UI.

**What the current code does:** `useEmployerProfile` clears state on identity changes and ignores results after cleanup. Dashboard callbacks compare the current account before writes. Auth hydration and role reads use a generation guard.

**Strength:** Stale session and role responses have explicit regression tests.

**Weakness / trade-off:** Ignoring results does not cancel network work. Other older hooks/effects still need equivalent scrutiny, and multiple same-account refreshes are not universally ordered.

**How it could be improved:** Use AbortSignal where supported and request identity for same-account refreshes; test each sensitive hook's cleanup independently.

## 3. State management

**Question:** Why retain custom caches instead of adopting a server-state library?

**Why an interviewer would ask it:** Several caches implement TTL and in-flight bookkeeping separately.

**What the current code does:** Local state holds UI choices; contexts hold auth/theme; memory caches hold server results. Query-cache invalidation prevents pending old requests from restoring removed entries.

**Strength:** The architecture remains understandable and account transitions clear private data.

**Weakness / trade-off:** Mutation invalidation and cache ownership remain manual. Saved job preferences and some profile drafts still use account-scoped local storage, which requires a retention policy.

**How it could be improved:** Consolidate cache ownership first, then evaluate a server-state library against observed mutation complexity rather than popularity.

## 4. TypeScript guarantees

**Question:** What does strict mode actually guarantee when there is still `any`?

**Why an interviewer would ask it:** Type checking can look stronger than it is at database and component boundaries.

**What the current code does:** Strict checking covers frontend and tests; Edge handlers have a separate Deno check. New projection, payment intent, and dashboard card contracts are explicit.

**Strength:** Actual baseline errors and missing-score/nullability defects are fixed.

**Weakness / trade-off:** Legacy `any`, assertions, and response overrides bypass checking. ESLint does not prohibit explicit-any yet. Generated database types are not adopted throughout.

**How it could be improved:** Generate types from the canonical local schema, then migrate sensitive services and add runtime decoders for provider/AI data.

## 5. Service/API boundaries

**Question:** Why are `candidate.ts` and `employer.ts` still large?

**Why an interviewer would ask it:** Each covers profiles, jobs, integrations, and multiple workflows.

**What the current code does:** Pure matching, saved preferences, public projections, and server payment/HTTP concerns have focused modules. Existing service exports remain compatible.

**Strength:** The separations improve testability without a repository abstraction framework.

**Weakness / trade-off:** Existing facades still contain transport retries and business orchestration alongside database reads.

**How it could be improved:** Extract cohesive billing, application, and job responsibilities with typed returns and integration fixtures; avoid one-file-per-function fragmentation.

## 6. Authentication

**Question:** How do initial hydration, auth callbacks, and role lookup avoid racing?

**Why an interviewer would ask it:** Supabase can emit auth events while an initial `getSession` call is pending.

**What the current code does:** Generation checks reject stale hydration and role results. Role fetching is deferred outside the auth callback. Inactivity continuation reschedules its timers.

**Strength:** Account switching and stale hydration are tested; callback work avoids nested auth locking.

**Weakness / trade-off:** Role retries and session error presentation remain custom. The client inactivity timer is a UI/session convenience, not server-side session expiry enforcement.

**How it could be improved:** Extend the existing fake-timer inactivity test to failed logout and visibility changes; add explicit auth error/retry UI and staging OAuth/password recovery checks with server session settings.

## 7. Authorization and route guards

**Question:** Can a user bypass a restricted page by calling the API directly?

**Why an interviewer would ask it:** Conditional rendering alone is not protection.

**What the current code does:** Database RLS, protected columns, and authenticated Edge ownership checks enforce access. Application navigation also redirects unauthenticated users.

**Strength:** SQL tests use actual anonymous and authenticated roles and attempt forbidden updates/RPCs.

**Weakness / trade-off:** The older standalone `ProtectedRoute` is unused and points to `/login`, which is not a declared page. Guard logic lives primarily in App and feature components.

**How it could be improved:** Consolidate navigation guards around actual route contracts and test candidate/employer/admin mismatches, while keeping database enforcement independent.

## 8. Supabase and RLS

**Question:** How do you know a later migration cannot silently reopen a restricted RPC?

**Why an interviewer would ask it:** A historical grant-all migration did exactly that.

**What the current code does:** Forward migrations revoke broad privileges, apply a reviewed RPC allowlist, restrict profile reads, and make payment/credit mutations service-only.

**Strength:** Migration-chain tests demonstrate the final privilege state rather than inspecting an isolated old migration.

**Weakness / trade-off:** Schema bootstrap was reconstructed because the historical migration chain lacked its base schema. PGlite's platform adapters are incomplete. A new migration can still introduce a permission defect.

**How it could be improved:** Add real Supabase CI, schema/grant diff review, policy tests for every tenant table, and checks for new functions' default privileges.

## 9. Financial correctness

**Question:** What prevents duplicate payment fulfillment or negative credit balances?

**Why an interviewer would ask it:** Payments require stronger invariants than ordinary UI updates.

**What the current code does:** Locked checkout intents and atomic SQL balance updates serialize mutations. Candidate unlock combines allowance/credit and usage recording under a workspace lock.

**Strength:** Amount/currency mismatch, duplicate fulfillment, overspend, and repeated unlock tests execute real application SQL.

**Weakness / trade-off:** PGlite queues requests on one connection. This is not proof of two-session locking behaviour. AI work and other subsequent effects can fail after a credit is charged.

**How it could be improved:** Multi-connection concurrency tests, operation identifiers, an explicit refund policy, and a durable ledger/outbox where billing complexity warrants it.

## 10. Webhook ordering and renewal

**Question:** What happens if subscription creation arrives before charge success, or an old failure arrives after a successful renewal?

**Why an interviewer would ask it:** Provider event order and retry are not reliable application transactions.

**What the current code does:** Raw-body signatures establish authenticity. Leases protect processing. Payment/subscription data is reverified. Subscription binding requires a verified checkout; missing prerequisites fail for retry. Failure/cancellation consults current provider state.

**Strength:** Browser metadata cannot directly confer an entitlement; duplicate grant protection remains in SQL.

**Weakness / trade-off:** Provider response shapes, signed renewal invoice correlation, and old subscriptions require sandbox replay/reconciliation. A long-lived lease is not a complete reconciliation system.

**How it could be improved:** Recorded sanitized provider contract fixtures, retry dashboards, periodic reconciliation, and alerts for unmatched references and failed invoice generation.

## 11. Repository secrets and privacy

**Question:** Why isn't deleting a leaked dump sufficient?

**Why an interviewer would ask it:** Git retains old objects and authentication material can remain usable independently of the working tree.

**What the current code does:** The export is removed, backup patterns are ignored, current/history scanning suppresses values, and owner remediation is documented.

**Strength:** The finding is explicitly acknowledged rather than hidden behind a clean current-source scan.

**Weakness / trade-off:** The historical authentication export is still present until the owner coordinates rewriting/removal. Scan patterns are not proof that no other secret exists.

**How it could be improved:** Revoke affected sessions, reset the affected account password, complete all-ref cleanup, inspect hosted copies, and enable independent secret scanning/branch controls.

## 12. Performance and pagination

**Question:** What happens with 100,000 jobs or thousands of applicants?

**Why an interviewer would ask it:** Browser pagination is not database pagination.

**What the current code does:** Lazy routes, vendor chunks, in-flight deduplication, TTLs, parallel independent reads, and batched projection calls reduce overhead. Applicant/discovery paths have explicit limits.

**Strength:** Existing code splitting is retained; no blanket memoization or unnecessary state library is added.

**Weakness / trade-off:** Job filtering still operates on fetched collections and depends on the API row cap. Some applicant/analytics reads are limited or unbounded. The shared vendor chunk remains substantial.

**How it could be improved:** Server filter/pagination contracts, cursor-based jobs/applicants, SQL aggregates/facets, query plans and indexes based on realistic volume, and measured bundle budgets.

## 13. Test strategy

**Question:** Which important behaviours do your tests actually prove?

**Why an interviewer would ask it:** Green unit tests can coexist with broken provider/gateway integration.

**What the current code does:** Real SQL authorization/entitlement tests, client state/validation tests, a labelled profile dialog test, strict type checks, and isolated public browser smoke tests.

**Strength:** Tests focus on concrete risk; no snapshot or coverage-percentage theatre.

**Weakness / trade-off:** Auth is mocked in client tests. Real OAuth, email, private Storage, provider checkout, and authenticated browser workflows are not exercised locally. Database scenarios share a controlled sequential fixture.

**How it could be improved:** Independent integration fixtures, full Supabase CI, provider sandbox replays, and authenticated end-to-end application/interview/billing flows.

## 14. Error handling

**Question:** How does a user distinguish an empty job list from a failed request?

**Why an interviewer would ask it:** Several baseline pages logged errors and kept ambiguous UI state.

**What the current code does:** Job search has an alert/retry state; profile editing retains input after failure; candidate drawer requests are guarded; the root render boundary offers reload; server failures suppress raw database/provider internals.

**Strength:** A profile-save failure/retry is tested, and public smoke tests exercise job-load failure.

**Weakness / trade-off:** Older admin and employer pages still contain inconsistent fallback handling and browser console logging. Render boundaries do not catch arbitrary asynchronous failures.

**How it could be improved:** A small typed error/result contract, consistent retry feedback, safe telemetry with request correlation, and targeted async failure tests.

## 15. Accessibility

**Question:** Can keyboard and screen-reader users complete the main workflows?

**Why an interviewer would ask it:** Clickable cards, icon-only actions, and custom modals are common failure points.

**What the current code does:** Profile editing uses Radix dialog focus behaviour, field labels, disabled saving controls, and inline alerts. Job titles have keyboard-operable buttons; save controls have names/pressed state; dashboard menu controls have names/expanded state.

**Strength:** The profile dialog's accessible name and labelled input behaviour are checked in a component test.

**Weakness / trade-off:** This is a targeted pass rather than full WCAG conformance. Older drawers, filters, tables, focus restoration, contrast, and mobile flows still need systematic manual review.

**How it could be improved:** Automated axe checks plus keyboard and screen-reader walkthroughs for candidate applications, employer review, and billing.

## 16. AI integration

**Question:** How do you limit cost and evaluate whether the ranking is fair or useful?

**Why an interviewer would ask it:** AI output is probabilistic, expensive, and may process sensitive CV data.

**What the current code does:** AI/embedding handlers require identity and resource authorization; candidate/job ownership is checked. Client-controlled credit skipping is removed. Embedding batches have limits and matching explanations expose structured signals.

**Strength:** AI is kept server-side and does not determine authorization or payment success.

**Weakness / trade-off:** Included/self-service operations still need robust rate/cost limits. Prompt/output evaluation, bias analysis, prompt-injection handling, retention/consent, and model regression testing are incomplete. Matching rules are partly duplicated across frontend/server.

**How it could be improved:** Budget/rate enforcement, source-hash reuse, bounded runtime-validated AI output, representative labelled eval data, and human decision/appeal controls.

## 17. Deployment and scalability

**Question:** What evidence separates a successful local build from a safe production release?

**Why an interviewer would ask it:** Schema, policy, provider, and Storage changes can break an existing installation.

**What the current code does:** CI and deployment validation gates are added. Forward SQL migrations and rollout/manual checks are documented; no production resources were changed.

**Strength:** The report explicitly separates local execution from external/staging validation.

**Weakness / trade-off:** Docker/Supabase integration and k6 were not available locally. Production schema drift, old subscriptions, duplicate provider bindings, and SPA host rewrites remain operational checks.

**How it could be improved:** Disposable staging databases, realistic volume tests, migration preflight checks, migration/function rollout coordination, monitoring, and a rehearsed rollback/reconciliation plan.
