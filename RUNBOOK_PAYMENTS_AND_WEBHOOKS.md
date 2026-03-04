# Payments & Webhook Incident Runbook

This runbook covers payment confirmation and webhook incidents for:

- `paystack-webhook`
- `confirm-subscription`
- `confirm-addon`

## 1) Severity Levels

- `SEV-1`: New paying customers cannot unlock plans/add-ons.
- `SEV-2`: Delayed/partial unlocks, but manual recovery possible.
- `SEV-3`: Single-account or transient failure.

## 2) Required Signals

Use structured logs emitted by edge functions:

- `paystack_webhook.request_received`
- `paystack_webhook.receipt_logged`
- `paystack_webhook.duplicate_ignored`
- `paystack_webhook.*_applied`
- `paystack_webhook.unhandled_exception`
- `confirm_subscription.success`
- `confirm_subscription.*_failed`
- `confirm_addon.credit_grant_succeeded`
- `confirm_addon.credit_grant_failed`

Each event includes `requestId` and critical business identifiers (`reference`, `eventKey`, `employerId`) for tracing.

## 3) Alert Rules (Minimum)

1. Webhook processing failures
- Condition: `paystack_webhook.unhandled_exception` count > 0 in 5 minutes.
- Action: page backend on-call.

2. Confirm add-on credit grant failures
- Condition: `confirm_addon.credit_grant_failed` count > 0 in 5 minutes.
- Action: page backend on-call.

3. Confirm subscription update failures
- Condition: `confirm_subscription.plan_update_failed` count > 0 in 5 minutes.
- Action: page backend on-call.

4. Elevated duplicate webhook ratio
- Condition: `duplicate_ignored / receipt_logged > 0.3` over 15 minutes.
- Action: investigate provider replay behavior and idempotency performance.

## 4) Quick Triage Checklist

1. Identify affected payment `reference` from support ticket/provider.
2. Search logs by `reference` and `requestId`.
3. Check webhook receipt status:
```sql
select event_name, event_key, status, last_error, received_at, processed_at
from public.payment_webhook_events
where reference = '<reference>'
order by received_at desc;
```
4. Check billing invoice:
```sql
select kind, status, total_kobo, paid_at, metadata
from public.billing_invoices
where provider = 'paystack' and provider_reference = '<reference>'
order by issued_at desc;
```
5. For add-ons, verify purchase + credit consistency:
```sql
select reference, employer_id, addon_id, status, amount_paid, credits_added, created_at
from public.employer_addon_purchases
where reference = '<reference>';
```
```sql
select employer_id, credit_type, remaining
from public.employer_credits
where employer_id = '<employer_id>';
```

## 5) Recovery Actions

### A) Add-on paid but credits missing

Run `confirm-addon` again with same `reference` for the affected employer session.

- Because `grant_addon_credits(...)` is transactional + idempotent, replay is safe.
- Expected result: credits granted or `alreadyProcessed = true`.

### B) Subscription paid but plan not updated

Run `confirm-subscription` again with the same `reference` from the affected employer session.

- Expected result: plan becomes active and invoice upserted.

### C) Webhook replay storms

No data rollback needed by default.

- `paystack-webhook` dedupes via `payment_webhook_events.event_key`.
- Focus on provider reliability and rate limits.

## 6) Post-Incident Requirements

1. Record incident timeline with references and request IDs.
2. Record root cause category:
- Provider replay behavior
- Internal function failure
- Metadata mismatch
- External dependency issue
3. Add one preventive action item in MVP checklist evidence.

## 7) Deployment Note

After observability updates, deploy:

```bash
supabase db push
supabase functions deploy paystack-webhook
supabase functions deploy confirm-addon
supabase functions deploy confirm-subscription
```
