# Engineering decisions

These records describe the rationale for the current architecture and the approved hardening changes. They do not claim to reconstruct motivations that cannot be established from source/history.

## 1. Retain React, Vite, and the existing UI system

**Context:** This is an existing browser application with candidate, employer, and administrator workflows.

**Decision:** Keep React Router, Vite, Tailwind, and Radix primitives. Extract candidate job presentation and employer dashboard job cards at existing responsibility boundaries.

**Why:** The pages already support lazy loading and a shared UI vocabulary. Small separations make review and behavioural tests easier without changing the product stack.

**Alternatives:** A new framework, full feature-folder rewrite, or moving all page state into a global store.

**Trade-offs:** Several pages remain large; the new components still have substantial markup. Refactoring every page would expand regression risk beyond the security work.

**When I would reconsider it:** Measured server-rendering needs, routing limitations, or repeated feature changes demonstrating a specific boundary problem.

## 2. Local/context state with memory server caches

**Context:** Forms and filters are page-local. Auth/theme are shared. Supabase requests repeat between views.

**Decision:** Retain local React state and contexts. Keep TTL/in-flight deduplication, move private query results to memory, and invalidate on identity changes.

**Why:** This fixes the observed privacy and stale-result problems directly. A generation/request identity prevents old requests from restoring invalidated cache entries.

**Alternatives:** React Query, Redux, Zustand, or no caching.

**Trade-offs:** Custom caches lack standardized mutation reconciliation, cancellation, and devtools. Candidate and employer entry points still contain separate caches. An old caller can receive its own result, so UI effects must also guard against stale writes.

**When I would reconsider it:** More shared mutations, offline support, optimistic updates, or persistent duplication of server-state lifecycle code.

## 3. TypeScript strict checking without a wholesale model rewrite

**Context:** The baseline had strict checking disabled and an actual type error. Database responses are not fully generated/typed.

**Decision:** Enable strict checking, check tests, introduce focused DTOs, and fix nullability and unsupported component props. Pin and separately check Edge dependencies with Deno.

**Why:** Strict null/argument checks catch defects now. Small models at sensitive boundaries improve contracts without inventing complex generic machinery.

**Alternatives:** Generate and adopt all Supabase schema types immediately, or retain loose checking.

**Trade-offs:** `any` remains in older service and page code; strict mode cannot verify an `any` value. ESLint's explicit-any rule is disabled rather than presenting that debt as solved. Some relation shapes still use reviewed assertions/override types.

**When I would reconsider it:** A dedicated schema/type-generation pass, with runtime decoders for external data and compile-time fixtures for joins.

## 4. PostgreSQL is the authorization boundary

**Context:** Direct browser database access is a core Supabase design. Historical grant/policy changes made private profiles and billing operations too broadly accessible.

**Decision:** Keep Supabase, enforce ownership/membership with RLS, remove broad grants, protect privileged columns, and expose explicit public/applicant projections.

**Why:** UI guards cannot prevent forged API requests. Server-side privileges must remain safe even if the browser is replaced with a custom HTTP client.

**Alternatives:** Put every read behind a bespoke API, use database views for every shape, or rely on route guards.

**Trade-offs:** Policy helpers and `SECURITY DEFINER` routines require careful privilege and search-path review. Trigger maintenance runs with trusted privileges; direct clients do not receive those RPC permissions. Forward migrations must be tested against actual Supabase as well as the isolated engine.

**When I would reconsider it:** Complex multi-tenant rules or an API contract that benefits from central server mediation; never to move authorization into the browser.

## 5. Financial invariants live in database transactions

**Context:** Optimistic credit updates ignored affected row counts. Browser/payment metadata could previously drive fulfillment. Duplicate events were not safely claimed.

**Decision:** Create immutable checkout intent snapshots before provider initialization. Verify status, reference, amount, currency, ownership, and metadata. Lock intents for fulfillment; deduct credit atomically; combine candidate unlock and usage recording in one transaction.

**Why:** Retries and races are normal payment conditions. One transaction protects the entitlement invariant regardless of how many Edge workers are running.

**Alternatives:** Application-only compare-and-swap, distributed locks, or trusting a successful browser callback.

**Trade-offs:** The webhook lease and entitlement transaction are separate: worker crashes require retry. Invoices are repeatable follow-up work rather than part of the SQL transaction. Other paid AI operations still need failure/refund and request-idempotency policy. Legacy payments without new intents require manual reconciliation.

**When I would reconsider it:** A dedicated billing ledger/outbox becomes justified by refunds, proration, reconciliation volume, or multiple payment providers.

## 6. Signed events plus current provider verification

**Context:** Subscription lifecycle events can arrive out of order. First-charge checkout data is different from renewal invoices.

**Decision:** Verify HMAC over the unmodified body. Claim a durable event lease. Verify payments with the provider; bind subscriptions only to a verified paid checkout, and verify signed recurring invoice associations before creating renewal intents. Consult current provider status before applying cancellation/failure events.

**Why:** A signed event authenticates its sender, but entitlement still depends on payment identity and current subscription state. Subscription creation alone does not establish payment.

**Alternatives:** Trust all signed metadata, reprocess every webhook unconditionally, or periodically reconcile every account instead of receiving events.

**Trade-offs:** The implementation intentionally fails closed on missing/ambiguous bindings. Old subscriptions and provider fixture differences need reconciliation. A scheduled reconciliation job is still valuable. Provider behaviour must be replayed in a sandbox before rollout.

**When I would reconsider it:** Provider events prove insufficient, requiring a durable event queue, outbox, and scheduled authoritative reconciliation.

Provider lifecycle rationale follows [Paystack subscription documentation](https://paystack.com/docs/payments/subscriptions/) and [the subscription API](https://paystack.com/docs/api/subscription/).

## 7. Separate pure explanations from employer data access

**Context:** Matching explanation calculations lived inside a large service module; saved-job preferences also mixed with server operations.

**Decision:** Extract `employer/matching.ts` and `candidate/saved-jobs.ts`, preserving the service export surface for callers. Keep public profile projections in a focused module and shared HTTP/payment logic in Edge helpers.

**Why:** Pure matching calculations can be tested independently. Local preferences and private server data have different lifecycles. Shared payment code prevents divergent trust checks between browser confirmation, webhook processing, and administrator retry.

**Alternatives:** Split every exported function by filename or introduce a generic repository framework.

**Trade-offs:** The main service modules remain large. They are compatibility facades with existing orchestration, not a complete domain-layer redesign. Frontend/server scoring still has some duplicated rules.

**When I would reconsider it:** Repeated changes expose cohesive jobs, applications, billing, or profile boundaries that can be moved with focused integration tests.

## 8. Test risk with real SQL and selected UI behaviour

**Context:** There was no baseline automated suite. Payment and authorization mistakes have higher consequences than presentation differences.

**Decision:** Use Vitest/Testing Library for client behaviours, PGlite for unchanged migration/RLS/transaction logic, Deno for Edge type validation, and Playwright for isolated public smoke checks.

**Why:** This combines fast isolated tests with actual PostgreSQL execution. Tests assert user-visible behaviour and financial invariants rather than snapshots or a coverage target.

**Alternatives:** Mock the database throughout, require Docker for every test, or write only end-to-end tests.

**Trade-offs:** PGlite uses one connection and minimal platform adapters. It does not prove gateway, OAuth, Storage service, or multi-worker concurrency behaviour. Browser smoke tests do not cover authenticated recruiting and real checkout.

**When I would reconsider it:** Docker-enabled CI/staging becomes available for full Supabase integration and multiple concurrent database sessions, alongside provider contract replay.
