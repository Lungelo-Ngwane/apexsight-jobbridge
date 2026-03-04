# Security & RLS Audit - 2026-03-04

Scope audited:

- Edge functions under `supabase/functions/*`
- RLS/policy migrations under `supabase/migrations/*`
- Payment, messaging, and profile access paths used by the MVP UI

## Findings and Actions

## 1) Critical: Sensitive SECURITY DEFINER RPC could be callable by client roles

- Risk: `public.grant_addon_credits(...)` is `SECURITY DEFINER`; if executable by `authenticated`, clients could potentially self-grant credits.
- Action: revoked `EXECUTE` from `public`, `anon`, `authenticated`; granted only to `service_role`.
- Status: fixed in migration `20260304143000_harden_rls_function_access_and_message_update.sql`.

## 2) High: Message updates were too broad

- Risk: policy allowed conversation participants to update message rows generally.
- Action:
  - Added trigger `enforce_messages_read_receipt_update()` to enforce read-receipt-only updates.
  - Replaced update policy with `messages_update_recipients_read_receipts` (recipient-only, unread -> read).
- Status: fixed in migration `20260304143000_harden_rls_function_access_and_message_update.sql`.

## 3) High: Missing edge auth/ownership checks in payment/email flows

- Risk: certain critical functions could be invoked without strict caller ownership checks.
- Actions already implemented:
  - `initialize-subscription`: requires authenticated user; employer resolved from `auth.uid()`.
  - `send-notification-email`: requires authenticated user; enforces candidate/employer ownership by notification type.
  - Payment/email functions now enforce `POST` method guards.
- Status: fixed in edge functions.

## 4) Medium: Payment webhook replay/idempotency

- Risk: provider retries/replays could create duplicate side effects.
- Actions already implemented:
  - Added `payment_webhook_events` receipt table with unique `event_key`.
  - Webhook duplicate processed-state skip and failed-state tracking.
  - Atomic add-on credit grant flow via transactional SQL function.
- Status: fixed/in progress (needs runtime verification in environment).

## Residual Risk Notes

1. `employer_profiles`/`candidate_profiles` include broad read access patterns to support product features.  
   Mitigation recommendation for post-MVP:
   - Move payment/provider secrets to a dedicated private table.
   - Expose public profile fields through narrow views/RPC only.

2. Remaining RLS validation should still be executed in staging with explicit abuse-case SQL tests (candidate reading unrelated private fields, employer cross-tenant writes, etc.).

## Verification Commands (Post-Deploy)

1. Run migration:
```bash
supabase db push
```

2. Re-deploy impacted functions:
```bash
supabase functions deploy send-notification-email
supabase functions deploy initialize-subscription
supabase functions deploy buy-addon
supabase functions deploy confirm-addon
supabase functions deploy confirm-subscription
supabase functions deploy paystack-webhook
```

3. Abuse-case checks:
- Attempt direct client `rpc('grant_addon_credits', ...)` as authenticated user -> must fail permission.
- Attempt message `update` changing `body` as participant -> must fail.
- Attempt marking own message as read -> must fail.
