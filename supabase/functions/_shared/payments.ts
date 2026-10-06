import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { assertPaymentMatches,paymentReference,record,type CheckoutIntent } from "./payment-validation.ts";

export async function paystack(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) throw new Error("Payment provider unavailable");
  const response = await fetch(`https://api.paystack.co/${path}`, {
    method: body ? "POST" : "GET", signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const envelope = record(await response.json());
  if (!response.ok || envelope.status !== true) throw new Error("Payment provider request failed");
  return record(envelope.data);
}

export async function fulfillPayment(db: SupabaseClient, reference: string, employerId?: string, kind?: string) {
  const ref = paymentReference(reference);
  const { data, error } = await db.from("checkout_intents").select("*").eq("reference", ref).maybeSingle();
  if (error || !data) throw new Error("Payment intent not found; manual reconciliation required");
  const intent = data as CheckoutIntent;
  if ((employerId && intent.employer_id !== employerId) || (kind && intent.kind !== kind)) throw new Error("Forbidden");
  const transaction = await paystack(`transaction/verify/${encodeURIComponent(ref)}`);
  assertPaymentMatches(intent, transaction, employerId);
  const customer = record(transaction.customer ?? {});
  let subscription = record(transaction.subscription ?? {});
  if (intent.provider_subscription_code) {
    const current = await paystack(`subscription/${encodeURIComponent(intent.provider_subscription_code)}`);
    if (record(current.customer).customer_code !== customer.customer_code ||
      record(current.plan).plan_code !== intent.provider_plan_code) throw new Error("Recurring subscription mismatch");
    subscription = current;
  }
  const { data: result, error: fulfillError } = await db.rpc("fulfill_checkout", {
    p_reference: ref, p_amount: intent.amount_minor, p_currency: intent.currency,
    p_customer_code: customer.customer_code ?? null,
    p_subscription_code: subscription.subscription_code ?? transaction.subscription_code ?? null,
    p_email_token: subscription.email_token ?? null,
    p_period_end: subscription.next_payment_date ?? null,
  });
  if (fulfillError) throw new Error("Payment fulfillment failed");
  // Invoice generation is repeatable; if it fails a retry repairs it without regranting value.
  await writeInvoice(db, intent, transaction);
  return record(result);
}

async function writeInvoice(db: SupabaseClient, intent: CheckoutIntent, transaction: Record<string, unknown>) {
  const ref = intent.reference;
  const invoiceNumber = `INV-${ref.toUpperCase()}`;
  const storagePath = `${intent.employer_id}/${intent.kind}s/${ref}.txt`;
  const paidAt = String(transaction.paid_at ?? new Date().toISOString());
  const text = [`Invoice Number: ${invoiceNumber}`, `Type: ${intent.kind}`, "Status: Paid",
    `Reference: ${ref}`, `Amount (minor units): ${intent.amount_minor}`, `Currency: ${intent.currency}`, `Paid At: ${paidAt}`].join("\n");
  const upload = await db.storage.from("billing-invoices").upload(storagePath, new TextEncoder().encode(text),
    { contentType: "text/plain; charset=utf-8", upsert: true });
  if (upload.error) throw new Error("Invoice upload failed");
  const invoice = await db.from("billing_invoices").upsert({ employer_id: intent.employer_id, provider: "paystack",
    provider_reference: ref, invoice_number: invoiceNumber, kind: intent.kind, status: "paid",
    currency: intent.currency, amount_kobo: intent.amount_minor, total_kobo: intent.amount_minor,
    vat_kobo: Math.round(intent.amount_minor * 15 / 115), issued_at: paidAt, paid_at: paidAt, storage_path: storagePath,
    metadata: { plan: intent.plan_name, addonId: intent.addon_id } }, { onConflict: "provider,provider_reference,kind" });
  if (invoice.error) throw new Error("Invoice persistence failed");
}

export async function processPaymentEvent(db: SupabaseClient, value: unknown): Promise<Record<string, unknown>> {
  const payload = record(value), data = record(payload.data);
  const event = String(payload.event ?? "");
  if (event === "charge.success") return fulfillPayment(db, paymentReference(data.reference));
  if (event === "subscription.create") return bindSubscription(db, data);
  if (event === "invoice.update" && data.paid === true) return fulfillRenewal(db, data);
  // Lifecycle events only affect the exact subscription bound by a verified payment.
  // subscription.create is informational: it is never proof of a successful charge.
  if (!['subscription.disable', 'invoice.payment_failed'].includes(event)) return { ignored: true };
  const subscription = record(data.subscription ?? {});
  const code = String(data.subscription_code ?? subscription.subscription_code ?? "");
  if (!code) throw new Error("Missing subscription identity");
  const { data: employer, error } = await db.from("employer_profiles")
    .select("id, paystack_subscription_code").eq("paystack_subscription_code", code).maybeSingle();
  if (error) throw new Error("Subscription lookup failed");
  if (!employer) return { ignored: true }; // e.g. a stale event for a replaced subscription
  // Query provider state to avoid trusting an out-of-order failure/disable event.
  const current = await paystack(`subscription/${encodeURIComponent(code)}`);
  const state = String(current.status ?? "").toLowerCase();
  if (event === "subscription.disable" && !['complete', 'completed', 'cancelled'].includes(state)) return { ignored: true };
  if (event === "invoice.payment_failed" && state !== 'attention') return { ignored: true };
  const update = event === "subscription.disable"
    ? { plan: "free", subscription_status: "cancelled", selected_plan: null, paystack_subscription_code: null,
      paystack_subscription_email_token: null }
    : { subscription_status: "past_due" };
  const applied = await db.from("employer_profiles").update(update).eq("id", employer.id).eq("paystack_subscription_code", code);
  if (applied.error) throw new Error("Subscription update failed");
  return { applied: true };
}

async function bindSubscription(db: SupabaseClient, data: Record<string, unknown>) {
  const code = paymentReference(data.subscription_code);
  const current = await paystack(`subscription/${encodeURIComponent(code)}`);
  const customer = record(current.customer), plan = record(current.plan);
  const { data: employer, error } = await db.from("employer_profiles").select("id,last_payment_intent_at,paystack_subscription_code")
    .eq("paystack_customer_code", customer.customer_code).maybeSingle();
  if (error || !employer) throw new Error("Subscription has no verified checkout yet");
  if (employer.paystack_subscription_code === code) return { bound: true };
  const { data: intent, error: intentError } = await db.from("checkout_intents").select("*")
    .eq("employer_id", employer.id).eq("created_at", employer.last_payment_intent_at).eq("kind", "subscription").maybeSingle();
  const created = Date.parse(String(current.createdAt ?? current.created_at ?? ""));
  if (intentError || !intent?.fulfilled_at || intent.provider_plan_code !== plan.plan_code ||
    Number(current.amount) !== Number(intent.amount_minor) || !Number.isFinite(created) ||
    created < Date.parse(intent.created_at) - 60000) throw new Error("Subscription binding mismatch");
  const result = await db.from("employer_profiles").update({ paystack_subscription_code: code,
    paystack_subscription_email_token: current.email_token, current_period_end: current.next_payment_date })
    .eq("id", employer.id).eq("last_payment_intent_at", intent.created_at);
  if (result.error) throw new Error("Subscription binding failed");
  return { bound: true };
}

async function fulfillRenewal(db: SupabaseClient, data: Record<string, unknown>) {
  const subscription = record(data.subscription);
  const code = paymentReference(subscription.subscription_code);
  const transactionIdentity = record(data.transaction);
  const ref = paymentReference(transactionIdentity.reference);
  const { data: employer, error } = await db.from("employer_profiles").select("id,last_payment_intent_at,paystack_customer_code")
    .eq("paystack_subscription_code", code).maybeSingle();
  if (error) throw new Error("Subscription lookup failed");
  if (!employer) return { ignored: true };
  const { data: original, error: originalError } = await db.from("checkout_intents").select("*")
    .eq("employer_id", employer.id).eq("created_at", employer.last_payment_intent_at).eq("kind", "subscription").maybeSingle();
  if (originalError || !original?.fulfilled_at) throw new Error("Renewal has no verified subscription checkout");
  const verified = await paystack(`transaction/verify/${encodeURIComponent(ref)}`);
  const paidAt = Date.parse(String(verified.paid_at ?? ""));
  if (verified.status !== "success" || verified.reference !== ref || Number(verified.amount) !== Number(original.amount_minor) ||
    verified.currency !== original.currency || record(verified.customer).customer_code !== employer.paystack_customer_code ||
    record(verified.plan_object ?? verified.plan).plan_code !== original.provider_plan_code || !Number.isFinite(paidAt))
    throw new Error("Renewal does not match verified subscription");
  // Invoice association comes from the signed provider event. Transaction and subscription are reverified.
  const inserted = await db.from("checkout_intents").upsert({ reference: ref, employer_id: employer.id,
    kind: "subscription", amount_minor: original.amount_minor, currency: original.currency, plan_name: original.plan_name,
    provider_plan_code: original.provider_plan_code, provider_subscription_code: code, created_at: new Date(paidAt).toISOString() },
    { onConflict: "reference", ignoreDuplicates: true });
  if (inserted.error) throw new Error("Renewal intent persistence failed");
  return fulfillPayment(db, ref, employer.id, "subscription");
}

export async function processClaimedEvent(db: SupabaseClient, payload: Record<string, unknown>, eventKey: string) {
  const data = record(payload.data);
  const { data: claim, error } = await db.rpc("claim_payment_event", {
    p_key: eventKey, p_event: String(payload.event), p_reference: data.reference ?? null,
    // Store only reconciliation fields, not card authorization or customer email/phone.
    p_payload: { event: payload.event, data: { id: data.id, reference: data.reference, paid: data.paid,
      transaction: data.transaction ? { reference: record(data.transaction).reference } : undefined,
      subscription_code: data.subscription_code,
      subscription: data.subscription ? { subscription_code: record(data.subscription).subscription_code } : undefined } },
  });
  if (error) throw new Error("Webhook receipt failed");
  if (!claim) {
    const receipt = await db.from("payment_webhook_events").select("status").eq("event_key", eventKey).single();
    if (receipt.error) throw new Error("Webhook receipt lookup failed");
    if (receipt.data.status === 'processed') return { duplicate: true };
    // In-progress requests must retry; a 200 here would acknowledge a crashed worker.
    throw new Error("Webhook already being processed");
  }
  try {
    const result = await processPaymentEvent(db, payload);
    const marked = await db.from("payment_webhook_events").update({ status: "processed",
      processed_at: new Date().toISOString(), processing_until: null, processing_token: null, last_error: null })
      .eq("event_key", eventKey).eq("processing_token", claim);
    if (marked.error) throw new Error("Webhook completion failed");
    return result;
  } catch (error) {
    await db.from("payment_webhook_events").update({ status: "failed", last_error: "Processing failed; inspect server diagnostics",
      processing_until: null, processing_token: null }).eq("event_key", eventKey).eq("processing_token", claim);
    throw error;
  }
}

