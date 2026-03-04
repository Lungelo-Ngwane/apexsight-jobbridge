# ApexSight JobBridge - MVP Release Readiness Checklist

Use this sheet as the single source of truth for go-live.  
Status options: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `PASS`, `FAIL`, `N/A`.

## Release Gate Summary

| Gate | Status | Owner | Notes |
|---|---|---|---|
| Product UX complete for MVP scope | NOT_STARTED | Product + Engineering | Remove placeholders, clarify disabled features |
| Security baseline complete | NOT_STARTED | Backend + Security | RLS + edge function auth audit |
| Payments reliability complete | NOT_STARTED | Backend | Webhook + reconciliation hardening |
| Performance baseline complete | NOT_STARTED | Backend | 10k+ concurrency targets validated |
| Monitoring + incident response ready | NOT_STARTED | DevOps/Backend | Alerts, dashboards, runbooks |
| QA regression + edge cases complete | NOT_STARTED | QA + Engineering | Session expiry, retries, duplicate actions |

## Implemented Fix Log

### 2026-03-04 - Dashboard Placeholder Cleanup (In Progress)

| Fix | What Changed | Issue Solved | Files | Status |
|---|---|---|---|---|
| Candidate dashboard static trend copy removed | Replaced fake trend text with profile-based explanation | Prevents misleading growth claims to real users | `src/app/components/CandidateDashboard.tsx` | DONE |
| Candidate readiness milestone text made dynamic | Milestone copy now calculates remaining % to 90% | Removes hardcoded certification guidance that could be false | `src/app/components/CandidateDashboard.tsx` | DONE |
| Candidate “job roles ready” made data-driven estimate | Replaced static `34 Job Roles` with skills/certifications-based estimate | Avoids fake precision in readiness claims | `src/app/components/CandidateDashboard.tsx` | DONE |
| Candidate assessment list switched to real profile data | Removed hardcoded demo assessments and mapped `candidate_assessments` from DB | Eliminates fake assessment records on production accounts | `src/app/components/CandidateDashboard.tsx` | DONE |
| Candidate skill score bars no longer fixed at 60% | Score now derives from skill level (beginner/intermediate/advanced) | Prevents every skill from showing identical placeholder score | `src/app/components/CandidateDashboard.tsx` | DONE |
| Employer dashboard fake trend labels removed | Replaced `+3 this month`, `+124 this week`, and similar static copy | Ensures KPI cards reflect actual data context only | `src/app/components/EmployerDashboard.tsx` | DONE |
| Employer billing payment method placeholder removed | Replaced fake card details (`Visa ending in 4242`) with real provider/customer/invoice-derived info | Prevents fake payment data from being shown to real customers | `src/app/components/employer/EmployerBillingPage.tsx` | DONE |
| Employer time-to-hire placeholder removed | Replaced hardcoded `1 days` with `N/A` until real hires exist | Prevents inaccurate hiring analytics in MVP | `src/app/components/EmployerDashboard.tsx` | DONE |

### 2026-03-04 - Disabled “Soon” UX Cleanup (In Progress)

| Fix | What Changed | Issue Solved | Files | Status |
|---|---|---|---|---|
| Removed disabled “Soon” tabs from employer settings header | Hid Team/Notifications/Security disabled tab triggers | Removes dead-end controls and confusion for paying customers | `src/app/components/employer/EmployerSettingsPage.tsx` | DONE |

### 2026-03-04 - Payment Reliability Hardening (In Progress)

| Fix | What Changed | Issue Solved | Files | Status |
|---|---|---|---|---|
| Added webhook receipt tracking table | Introduced `payment_webhook_events` with unique `event_key`, status, payload, and timestamps | Enables dedupe, retry tracking, and webhook auditability | `supabase/migrations/20260304123000_harden_payment_idempotency_and_reconciliation.sql` | DONE |
| Added DB transactional credit grant function | Added `grant_addon_credits(...)` to atomically insert/lock purchase + increment credits + finalize `credits_added` | Prevents race conditions and ensures idempotent add-on credit application | `supabase/migrations/20260304123000_harden_payment_idempotency_and_reconciliation.sql` | DONE |
| Hardened add-on confirmation flow | Replaced manual purchase/credit updates with one transactional RPC call | Fixes partial-failure state where purchase exists but credits are missing | `supabase/functions/confirm-addon/index.ts` | DONE |
| Added webhook idempotency processing guards | Webhook now stores receipt, skips already processed duplicates, and tracks processed/failed state | Prevents duplicate side effects from replayed webhook events | `supabase/functions/paystack-webhook/index.ts` | DONE |

### 2026-03-04 - Monitoring & Incident Workflow Hardening (In Progress)

| Fix | What Changed | Issue Solved | Files | Status |
|---|---|---|---|---|
| Added shared structured observability logger | Introduced common `logInfo/logWarn/logError` helpers for edge functions | Standardizes machine-readable logs for alerting and incident triage | `supabase/functions/_shared/observability.ts` | DONE |
| Instrumented payment critical functions with structured logs | Added request lifecycle and failure logs with `requestId`, `reference`, and actor context | Improves root-cause speed and supports threshold-based alerting | `supabase/functions/paystack-webhook/index.ts`, `supabase/functions/confirm-addon/index.ts`, `supabase/functions/confirm-subscription/index.ts` | DONE |
| Added payment/webhook incident runbook | Added severity, alert rules, SQL triage queries, and recovery playbooks | Establishes repeatable incident response and customer-impact mitigation path | `RUNBOOK_PAYMENTS_AND_WEBHOOKS.md` | DONE |

### 2026-03-04 - Edge Auth & Access Control Hardening (In Progress)

| Fix | What Changed | Issue Solved | Files | Status |
|---|---|---|---|---|
| Locked subscription initialization to authenticated employer identity | `initialize-subscription` now requires bearer token and resolves employer from `user.id` only | Prevents forged checkout initialization for arbitrary employer/email payloads | `supabase/functions/initialize-subscription/index.ts` | DONE |
| Added ownership authorization for outbound notification triggers | `send-notification-email` now validates caller token and enforces candidate/employer ownership by notification type | Prevents unauthorized users from triggering email notifications on unrelated applications | `supabase/functions/send-notification-email/index.ts` | DONE |
| Added POST-only guards on payment/email endpoints | Enforced explicit method checks (`405`) on payment and notification functions | Reduces abuse surface and accidental invocation paths | `supabase/functions/initialize-subscription/index.ts`, `supabase/functions/buy-addon/index.ts`, `supabase/functions/confirm-addon/index.ts`, `supabase/functions/confirm-subscription/index.ts`, `supabase/functions/send-notification-email/index.ts` | DONE |

### 2026-03-04 - RLS & DB Security Hardening (In Progress)

| Fix | What Changed | Issue Solved | Files | Status |
|---|---|---|---|---|
| Restricted execution of sensitive SECURITY DEFINER credit RPC | Revoked `grant_addon_credits` execute from `public/anon/authenticated`, left `service_role` only | Prevents client-side privilege escalation to self-grant add-on credits | `supabase/migrations/20260304143000_harden_rls_function_access_and_message_update.sql` | DONE |
| Hardened message update path to read-receipt-only | Added trigger guard + narrowed message update policy to recipient unread->read transitions | Prevents chat message tampering while preserving read receipt behavior | `supabase/migrations/20260304143000_harden_rls_function_access_and_message_update.sql` | DONE |
| Published formal security audit artifact | Added RLS/edge findings, fixes, and abuse-case verification checklist | Creates auditable evidence for MVP security gate and QA | `SECURITY_RLS_AUDIT_2026-03-04.md` | DONE |

## Feature Matrix (Core MVP)

| Area | Feature | Expected Behavior | Test Type | Owner | Status | Evidence |
|---|---|---|---|---|---|---|
| Auth | Email/password login/register | Candidate/employer can sign in and are routed by role | E2E | Frontend | NOT_STARTED | |
| Auth | Google sign-in | User authenticates via Google and returns to app | E2E | Frontend | NOT_STARTED | |
| Candidate | Profile edit | Candidate can save profile fields and reload with same values | E2E | Frontend | NOT_STARTED | |
| Candidate | Skills | Add/remove skills persists correctly | E2E | Frontend | NOT_STARTED | |
| Candidate | CV upload | CV stores in Supabase storage and linked in profile | E2E | Frontend/Backend | NOT_STARTED | |
| Candidate | Job browsing | Search + filters + pagination return expected jobs | Functional | Frontend | NOT_STARTED | |
| Candidate | Apply for job | Candidate applies once; duplicate apply is blocked | E2E | Frontend/Backend | NOT_STARTED | |
| Candidate | Featured jobs visibility | Featured jobs are visibly labeled in list/details | Functional | Frontend | NOT_STARTED | |
| Messaging | Candidate/employer chat | Real-time message send/receive/read works | E2E + Load | Frontend/Backend | NOT_STARTED | |
| Employer | Job CRUD | Employer can create/edit/close/archive jobs | E2E | Frontend/Backend | NOT_STARTED | |
| Employer | Candidate list | Employer can filter talent pool and open chat | E2E | Frontend | NOT_STARTED | |
| Employer | Dashboard usage stats | Stats render valid non-placeholder values | Functional | Frontend/Backend | NOT_STARTED | |
| Billing | Subscription checkout | Start/confirm subscription updates plan + limits | E2E | Backend | NOT_STARTED | |
| Billing | Cancel subscription | Cancel transitions account safely to free plan | E2E | Backend | NOT_STARTED | |
| Billing | Invoices | Invoice list loads and downloads succeed | E2E | Backend | NOT_STARTED | |
| Add-ons | Add-on purchase | Credits increase and become consumable | E2E | Backend | NOT_STARTED | |
| Add-ons | Feature job credit consumption | Featuring job consumes correct credits once | E2E | Backend | NOT_STARTED | |
| AI | Candidate/job embeddings | Background functions run without fatal errors | Functional | Backend | NOT_STARTED | |
| AI | Auto-match/report | Auto-match and report complete with bounded latency | Functional + Load | Backend | NOT_STARTED | |

## Hardening Workstream Checklist

### 1) Placeholder/Static Content Cleanup

| Task | Acceptance Criteria | Owner | Status | Evidence |
|---|---|---|---|---|
| Audit dashboards for static labels/values | No fake metrics in production views | Frontend | IN_PROGRESS | 2026-03-04 fixes in `CandidateDashboard.tsx`, `EmployerDashboard.tsx` |
| Replace static values with live queries or hide | Every metric has source query or is removed | Frontend/Backend | IN_PROGRESS | 2026-03-04 removed hardcoded trend/time values |
| Add empty/loading/error states | All KPI cards have robust states | Frontend | NOT_STARTED | |

### 2) Disabled "Soon" Sections in Settings

| Task | Acceptance Criteria | Owner | Status | Evidence |
|---|---|---|---|---|
| Decide MVP scope for settings tabs | Explicitly mark in/out-of-scope features | Product | NOT_STARTED | |
| Hide non-MVP tabs or ship minimal version | No dead-end controls for paying users | Frontend | PASS | 2026-03-04 removed disabled “Soon” tab triggers |
| Add help text for unavailable features | Users understand availability and roadmap | Frontend | NOT_STARTED | |

### 3) Payments Callback Reliability (E2E)

| Task | Acceptance Criteria | Owner | Status | Evidence |
|---|---|---|---|---|
| Validate webhook signature verification | Invalid signatures rejected; valid accepted | Backend | NOT_STARTED | |
| Idempotency for webhook events | Duplicate webhook does not double-apply credits/plans | Backend | IN_PROGRESS | 2026-03-04 added `payment_webhook_events` dedupe + processed-state checks |
| Reconciliation job/script | Missing callbacks can be repaired from provider reference | Backend | IN_PROGRESS | 2026-03-04 added recoverable add-on credit flow via `grant_addon_credits` |
| Full payment journey tests | start -> pay -> callback -> confirm -> UI reflects state | QA/Backend | NOT_STARTED | |

### 4) Monitoring, Alerting, Incident Workflow

| Task | Acceptance Criteria | Owner | Status | Evidence |
|---|---|---|---|---|
| Structured logs across edge functions | Function logs include request id, actor id, outcome | Backend | IN_PROGRESS | 2026-03-04 structured logs added in payment-critical edge functions |
| Error tracking integration | Uncaught errors visible in central tool | Backend | NOT_STARTED | |
| Alert rules | Alerts for 5xx spikes, webhook failures, queue stalls | DevOps/Backend | IN_PROGRESS | 2026-03-04 runbook includes concrete alert conditions for payment paths |
| Incident runbook | Playbook with escalation + rollback steps exists | Engineering | PASS | 2026-03-04 added `RUNBOOK_PAYMENTS_AND_WEBHOOKS.md` with triage/recovery actions |

### 5) RLS/Security Audit

| Task | Acceptance Criteria | Owner | Status | Evidence |
|---|---|---|---|---|
| Table-by-table RLS review | Every public table has least-privilege policies | Backend/Security | IN_PROGRESS | 2026-03-04 audit documented in `SECURITY_RLS_AUDIT_2026-03-04.md`; critical gaps patched |
| Edge function auth audit | Every privileged call validates JWT/role/ownership | Backend/Security | IN_PROGRESS | 2026-03-04 hardened `initialize-subscription` + `send-notification-email` authorization paths |
| Secret handling audit | No service keys exposed client-side; envs scoped correctly | Backend | IN_PROGRESS | 2026-03-04 separated client-invokable auth paths from service-only DB RPC execution |
| Abuse-case test | Unauthorized read/write attempts are denied | QA/Security | IN_PROGRESS | 2026-03-04 added POST-only endpoint guards and ownership checks on critical flows |

### 6) Performance Baseline (10k+ users)

| Task | Acceptance Criteria | Owner | Status | Evidence |
|---|---|---|---|---|
| Define SLOs | p95 latency, error rate, throughput targets documented | Backend | NOT_STARTED | |
| k6 smoke baseline | Stable smoke test with 0 critical errors | Backend | NOT_STARTED | |
| k6 ramp/load/stress tests | Curves captured for bottleneck analysis | Backend | NOT_STARTED | |
| Capacity report | Max sustainable RPS + bottlenecks documented | Backend | NOT_STARTED | |

### 7) QA Edge Cases

| Task | Acceptance Criteria | Owner | Status | Evidence |
|---|---|---|---|---|
| Session expiry handling | Expired sessions trigger clean re-auth flow | Frontend/Backend | NOT_STARTED | |
| Retry safety | Retry does not duplicate critical side effects | Backend | NOT_STARTED | |
| Duplicate actions guard | Double-click/pay/apply does not duplicate state | Frontend/Backend | IN_PROGRESS | 2026-03-04 add-on purchase + webhook duplicate handling hardened |
| Network fault tolerance | User sees clear errors; recoverable retries work | Frontend | NOT_STARTED | |

## Notable Risk Validation Matrix

| Risk | Validation Method | Pass Criteria | Owner | Status | Evidence |
|---|---|---|---|---|---|
| Email deliverability + templates | Seed inbox test across providers + spam check | Delivery >= target rate, templates render correctly | Backend | NOT_STARTED | |
| Realtime messaging under load | k6 + realtime subscribe/publish scenario | No message loss; latency within SLO | Backend | NOT_STARTED | |
| Function timeout/retry at peak | Stress tests + fault injection | Retries bounded; no cascading failures | Backend | NOT_STARTED | |
| Invoice/subscription consistency after failed webhooks | Simulated callback failures + reconciliation run | State converges to correct billing outcome | Backend | NOT_STARTED | |
| Add-on credit consistency under concurrency | Concurrent purchase/consume tests | No negative or double-spent credits | Backend | IN_PROGRESS | 2026-03-04 moved credit grant to transactional SQL function with row lock + upsert increment |

## Exit Criteria (Go-Live)

All must be true:

1. No `FAIL` in any release gate row.
2. Security/RLS audit is `PASS`.
3. Payment callback reliability is `PASS`.
4. Performance baseline and SLOs are `PASS`.
5. Core E2E paths are `PASS` for candidate and employer.
6. On-call/incident workflow is documented and tested.

## Immediate Next Sprint (Recommended)

1. Placeholder/static data cleanup (highest UX risk).
2. Payment webhook idempotency + reconciliation (highest revenue risk).
3. RLS + edge auth audit (highest security risk).
4. Performance baseline with k6 and bottleneck fixes (highest scale risk).
5. QA edge-case suite and regression run (highest release stability risk).






