import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const allowedPlans = new Set(["free", "starter", "professional", "enterprise"]);

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatInvoiceNumber(reference: string) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const safeRef = reference.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `INV-${stamp}-${safeRef}`;
}

async function requireAdminUser(token: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) throw new Error("Not authenticated.");

  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminRow?.user_id) throw new Error("Admin access required.");

  return user;
}

async function writeAdminAuditLog(params: {
  actorUserId: string;
  action: string;
  targetEmail?: string | null;
  details?: Record<string, unknown>;
}) {
  await supabase.from("admin_audit_logs").insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    target_email: params.targetEmail ?? null,
    details: params.details ?? {},
  });
}

async function markWebhookEvent(eventId: string, status: "processed" | "failed", errorMessage?: string) {
  await supabase
    .from("payment_webhook_events")
    .update({
      status,
      processed_at: status === "processed" ? new Date().toISOString() : null,
      last_error: status === "failed" ? String(errorMessage ?? "Unknown webhook error") : null,
    })
    .eq("id", eventId);
}

async function resolvePlanName(planCode: string | null | undefined, metadataTargetPlan: string | null | undefined) {
  const target = String(metadataTargetPlan ?? "").trim().toLowerCase();
  if (allowedPlans.has(target)) return target;

  const code = String(planCode ?? "").trim();
  if (!code) return null;

  const { data } = await supabase
    .from("plans")
    .select("name, paystack_plan_code, paystack_test_plan_code")
    .or(`paystack_plan_code.eq.${code},paystack_test_plan_code.eq.${code}`)
    .maybeSingle();

  const resolved = String(data?.name ?? "").trim().toLowerCase();
  return allowedPlans.has(resolved) ? resolved : null;
}

async function resolveEmployerId(payloadData: Record<string, unknown>) {
  const metadata = (payloadData.metadata ?? {}) as Record<string, unknown>;
  const metadataEmployerId = String(metadata.employerId ?? "").trim();
  if (metadataEmployerId) {
    const { data } = await supabase.from("employer_profiles").select("id").eq("id", metadataEmployerId).maybeSingle();
    if (data?.id) return String(data.id);
  }

  const subscriptionCode = String(payloadData.subscription_code ?? "").trim();
  if (subscriptionCode) {
    const { data } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("paystack_subscription_code", subscriptionCode)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  const customer = (payloadData.customer ?? {}) as Record<string, unknown>;
  const customerCode = String(customer.customer_code ?? "").trim();
  if (customerCode) {
    const { data } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("paystack_customer_code", customerCode)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  return null;
}

async function applyEmployerUpdate(employerId: string, update: Record<string, unknown>) {
  const { error } = await supabase.from("employer_profiles").update(update).eq("id", employerId);
  if (error) throw new Error(`Failed to update employer profile: ${error.message}`);
}

async function upsertBillingInvoice(params: {
  employerId: string;
  reference: string;
  kind: "subscription" | "addon";
  status: "paid" | "failed";
  amountKobo: number;
  paidAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const amountKobo = Number.isFinite(params.amountKobo) ? Math.max(0, Math.round(params.amountKobo)) : 0;
  const vatKobo = Math.round((amountKobo * 15) / 115);
  const invoiceNumber = formatInvoiceNumber(params.reference);
  const paidAt = params.paidAt ?? new Date().toISOString();

  await supabase.from("billing_invoices").upsert(
    {
      employer_id: params.employerId,
      provider: "paystack",
      provider_reference: params.reference,
      invoice_number: invoiceNumber,
      kind: params.kind,
      status: params.status,
      currency: "ZAR",
      amount_kobo: amountKobo,
      vat_kobo: vatKobo,
      total_kobo: amountKobo,
      issued_at: paidAt,
      paid_at: params.status === "paid" ? paidAt : null,
      metadata: params.metadata ?? {},
    },
    { onConflict: "provider,provider_reference,kind" },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let currentEventId = "";

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Missing access token" }, 401);
    const adminUser = await requireAdminUser(token);

    const { eventId } = await req.json();
    const targetEventId = String(eventId ?? "").trim();
    currentEventId = targetEventId;
    if (!targetEventId) return json({ error: "Missing eventId" }, 400);

    const { data: eventRow, error: eventError } = await supabase
      .from("payment_webhook_events")
      .select("id, event_name, reference, payload")
      .eq("id", targetEventId)
      .maybeSingle();

    if (eventError || !eventRow) return json({ error: "Webhook event not found" }, 404);

    await supabase
      .from("payment_webhook_events")
      .update({
        status: "received",
        processed_at: null,
        last_error: null,
      })
      .eq("id", targetEventId);

    const payload = (eventRow.payload ?? {}) as { event?: string; data?: Record<string, unknown> };
    const event = String(payload.event ?? eventRow.event_name ?? "").trim().toLowerCase();
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const reference = String(data.reference ?? eventRow.reference ?? "").trim() || null;

    const employerId = await resolveEmployerId(data);
    if (!employerId) throw new Error("Employer could not be resolved from webhook payload");

    if (event === "subscription.create") {
      const planObj = (data.plan ?? {}) as Record<string, unknown>;
      const customerObj = (data.customer ?? {}) as Record<string, unknown>;
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      const resolvedPlan = await resolvePlanName(String(planObj.plan_code ?? ""), String(metadata.targetPlan ?? ""));
      const update: Record<string, unknown> = {
        subscription_status: "active",
        selected_plan: null,
        paystack_customer_code: String(customerObj.customer_code ?? "") || null,
        paystack_subscription_code: String(data.subscription_code ?? "") || null,
        paystack_subscription_email_token: String(data.email_token ?? "") || null,
      };
      if (resolvedPlan) update.plan = resolvedPlan;
      await applyEmployerUpdate(employerId, update);
      await markWebhookEvent(targetEventId, "processed");
      await writeAdminAuditLog({
        actorUserId: adminUser.id,
        action: "webhook_retried",
        details: { eventId: targetEventId, event, employerId, reference, result: "processed" },
      });
      return json({ success: true, event, employerId, retried: true });
    }

    if (event === "subscription.disable") {
      await applyEmployerUpdate(employerId, {
        plan: "free",
        subscription_status: "cancelled",
        selected_plan: null,
        paystack_subscription_code: null,
        paystack_subscription_email_token: null,
      });
      await markWebhookEvent(targetEventId, "processed");
      await writeAdminAuditLog({
        actorUserId: adminUser.id,
        action: "webhook_retried",
        details: { eventId: targetEventId, event, employerId, reference, result: "processed" },
      });
      return json({ success: true, event, employerId, retried: true });
    }

    if (event === "invoice.payment_failed") {
      await applyEmployerUpdate(employerId, { subscription_status: "past_due" });
      if (reference) {
        await upsertBillingInvoice({
          employerId,
          reference,
          kind: "subscription",
          status: "failed",
          amountKobo: Number(data.amount ?? 0),
          metadata: { event, retriedByAdmin: true },
        });
      }
      await markWebhookEvent(targetEventId, "processed");
      await writeAdminAuditLog({
        actorUserId: adminUser.id,
        action: "webhook_retried",
        details: { eventId: targetEventId, event, employerId, reference, result: "processed" },
      });
      return json({ success: true, event, employerId, retried: true });
    }

    if (event === "charge.success") {
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      const addonId = String(metadata.addonId ?? "").trim();
      const isAddon = Boolean(addonId);
      let resolvedPlan: string | null = null;

      if (isAddon) {
        const { data: addon, error: addonError } = await supabase
          .from("addons")
          .select("id, type, credits")
          .eq("id", addonId)
          .maybeSingle();
        if (addonError || !addon) throw new Error(`Webhook could not resolve add-on ${addonId}`);

        const creditsToAdd = Number(addon.credits ?? 0);
        const { error: grantError } = await supabase.rpc("grant_addon_credits", {
          p_reference: reference,
          p_employer_id: employerId,
          p_addon_id: addon.id,
          p_amount_paid: Number(data.amount ?? 0),
          p_credit_type: String(addon.type ?? ""),
          p_credits_to_add: creditsToAdd,
        });
        if (grantError) throw new Error(`Webhook credit grant failed: ${grantError.message}`);
      } else {
        const planObj = (data.plan ?? {}) as Record<string, unknown>;
        const customerObj = (data.customer ?? {}) as Record<string, unknown>;
        const subscriptionObj = (data.subscription ?? {}) as Record<string, unknown>;
        resolvedPlan = await resolvePlanName(String(planObj.plan_code ?? ""), String(metadata.targetPlan ?? ""));
        const update: Record<string, unknown> = {
          subscription_status: "active",
          selected_plan: null,
          paystack_customer_code: String(customerObj.customer_code ?? "") || null,
        };
        const subscriptionCode = String(subscriptionObj.subscription_code ?? "") || String(data.subscription_code ?? "");
        if (subscriptionCode) update.paystack_subscription_code = subscriptionCode;
        const emailToken = String(subscriptionObj.email_token ?? "");
        if (emailToken) update.paystack_subscription_email_token = emailToken;
        if (resolvedPlan) update.plan = resolvedPlan;
        await applyEmployerUpdate(employerId, update);
      }

      if (reference) {
        await upsertBillingInvoice({
          employerId,
          reference,
          kind: isAddon ? "addon" : "subscription",
          status: "paid",
          amountKobo: Number(data.amount ?? 0),
          paidAt: String(data.paid_at ?? "") || new Date().toISOString(),
          metadata: { event, targetPlan: resolvedPlan, addonId: addonId || null, retriedByAdmin: true },
        });
      }

      await markWebhookEvent(targetEventId, "processed");
      await writeAdminAuditLog({
        actorUserId: adminUser.id,
        action: "webhook_retried",
        details: { eventId: targetEventId, event, employerId, reference, result: "processed" },
      });
      return json({ success: true, event, employerId, retried: true });
    }

    throw new Error(`Unsupported webhook event for retry: ${event}`);
  } catch (error) {
    if (currentEventId) {
      await markWebhookEvent(currentEventId, "failed", String(error));
    }
    return json({ error: String(error) }, 500);
  }
});
