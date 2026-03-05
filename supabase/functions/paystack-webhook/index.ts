import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError, logInfo, logWarn } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const allowedPlans = new Set(["free", "starter", "professional", "enterprise"]);

function formatInvoiceNumber(reference: string) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const safeRef = reference.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `INV-${stamp}-${safeRef}`;
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

  let storagePath: string | null = null;
  if (params.status === "paid") {
    storagePath = `${params.employerId}/${params.kind}s/${params.reference}.txt`;
    const invoiceText = [
      `Invoice Number: ${invoiceNumber}`,
      `Type: ${params.kind === "addon" ? "Add-on" : "Subscription"}`,
      `Status: ${params.status === "paid" ? "Paid" : "Failed"}`,
      `Reference: ${params.reference}`,
      `Amount (kobo): ${amountKobo}`,
      `VAT (kobo): ${vatKobo}`,
      `Total (kobo): ${amountKobo}`,
      `Currency: ZAR`,
      `Paid At: ${paidAt}`,
      `Generated At: ${new Date().toISOString()}`,
    ].join("\n");

    const upload = await supabase.storage
      .from("billing-invoices")
      .upload(storagePath, new TextEncoder().encode(invoiceText), {
        contentType: "text/plain; charset=utf-8",
        upsert: true,
      });

    if (upload.error) {
      storagePath = null;
    }
  }

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
      storage_path: storagePath,
      metadata: params.metadata ?? {},
    },
    { onConflict: "provider,provider_reference,kind" },
  );
}

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildWebhookEventKey(
  event: string,
  data: Record<string, unknown>,
  payloadHash: string,
) {
  const paymentId = String(data.id ?? "").trim();
  if (paymentId) return `paystack:${event}:id:${paymentId}`;

  const reference = String(data.reference ?? "").trim();
  if (reference) return `paystack:${event}:ref:${reference}`;

  const subscriptionCode = String(data.subscription_code ?? "").trim();
  if (subscriptionCode) {
    const mark = String(
      data.paid_at ??
      data.next_payment_date ??
      data.created_at ??
      "",
    ).trim();
    return `paystack:${event}:sub:${subscriptionCode}:${mark || "na"}`;
  }

  return `paystack:${event}:hash:${payloadHash.slice(0, 32)}`;
}

async function markWebhookEvent(
  eventKey: string,
  status: "processed" | "failed",
  errorMessage?: string,
) {
  await supabase
    .from("payment_webhook_events")
    .update({
      status,
      processed_at: status === "processed" ? new Date().toISOString() : null,
      last_error: status === "failed" ? String(errorMessage ?? "Unknown webhook error") : null,
    })
    .eq("event_key", eventKey);
}

async function verifyPaystackSignature(
  body: string,
  signatureHeader: string | null,
) {
  if (!signatureHeader) return false;

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hashHex = Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(hashHex, signatureHeader.toLowerCase());
}

async function resolvePlanName(
  planCode: string | null | undefined,
  metadataTargetPlan: string | null | undefined,
) {
  const target = String(metadataTargetPlan ?? "").trim().toLowerCase();
  if (allowedPlans.has(target)) return target;

  const code = String(planCode ?? "").trim();
  if (!code) return null;

  const { data } = await supabase
    .from("plans")
    .select("name")
    .eq("paystack_plan_code", code)
    .maybeSingle();

  const resolved = String(data?.name ?? "").trim().toLowerCase();
  return allowedPlans.has(resolved) ? resolved : null;
}

async function resolveEmployerId(payloadData: Record<string, unknown>) {
  const metadata = (payloadData.metadata ?? {}) as Record<string, unknown>;
  const metadataEmployerId = String(metadata.employerId ?? "").trim();
  if (metadataEmployerId) {
    const { data } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("id", metadataEmployerId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const subscriptionCode = String(payloadData.subscription_code ?? "").trim();
  if (subscriptionCode) {
    const { data } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("paystack_subscription_code", subscriptionCode)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const customer = (payloadData.customer ?? {}) as Record<string, unknown>;
  const customerCode = String(customer.customer_code ?? "").trim();
  if (customerCode) {
    const { data } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("paystack_customer_code", customerCode)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

async function applyEmployerUpdate(
  employerId: string,
  update: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("employer_profiles")
    .update(update)
    .eq("id", employerId);

  if (error) {
    throw new Error(`Failed to update employer profile: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return buildJsonResponse({ error: "Method not allowed" }, 405);
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  let currentEventKey: string | null = null;

  try {
    logInfo("paystack_webhook.request_received", {
      requestId,
      method: req.method,
    });

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    const validSignature = await verifyPaystackSignature(rawBody, signature);
    if (!validSignature) {
      logWarn("paystack_webhook.invalid_signature", { requestId });
      return buildJsonResponse({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(rawBody) as {
      event?: string;
      data?: Record<string, unknown>;
    };

    const event = String(payload.event ?? "").trim().toLowerCase();
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const payloadHash = await sha256Hex(rawBody);

    if (!event) {
      logWarn("paystack_webhook.missing_event", { requestId });
      return buildJsonResponse({ error: "Missing event" }, 400);
    }

    const reference = String(data.reference ?? "").trim() || null;
    currentEventKey = buildWebhookEventKey(event, data, payloadHash);

    const { error: receiptInsertError } = await supabase
      .from("payment_webhook_events")
      .insert({
        provider: "paystack",
        event_key: currentEventKey,
        event_name: event,
        reference,
        status: "received",
        payload: payload,
      });

    if (receiptInsertError?.code === "23505") {
      const { data: existingReceipt } = await supabase
        .from("payment_webhook_events")
        .select("status")
        .eq("event_key", currentEventKey)
        .maybeSingle();

      if (existingReceipt?.status === "processed") {
        logInfo("paystack_webhook.duplicate_ignored", {
          requestId,
          event,
          eventKey: currentEventKey,
        });
        return buildJsonResponse({
          received: true,
          duplicate: true,
          ignored: true,
          event,
        });
      }
    } else if (receiptInsertError) {
      throw new Error(`Failed to log webhook receipt: ${receiptInsertError.message}`);
    }

    logInfo("paystack_webhook.receipt_logged", {
      requestId,
      event,
      eventKey: currentEventKey,
      reference,
    });

    const employerId = await resolveEmployerId(data);
    if (!employerId) {
      logWarn("paystack_webhook.employer_unresolved", {
        requestId,
        event,
        eventKey: currentEventKey,
      });
      await markWebhookEvent(currentEventKey, "processed");
      return buildJsonResponse({
        received: true,
        ignored: true,
        reason: "Employer could not be resolved from webhook payload",
      });
    }

    if (event === "subscription.create") {
      const planObj = (data.plan ?? {}) as Record<string, unknown>;
      const customerObj = (data.customer ?? {}) as Record<string, unknown>;
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;

      const resolvedPlan = await resolvePlanName(
        String(planObj.plan_code ?? ""),
        String(metadata.targetPlan ?? ""),
      );

      const update: Record<string, unknown> = {
        subscription_status: "active",
        selected_plan: null,
        paystack_customer_code: String(customerObj.customer_code ?? "") || null,
        paystack_subscription_code: String(data.subscription_code ?? "") || null,
        paystack_subscription_email_token:
          String(data.email_token ?? "") || null,
      };

      const nextPaymentDate = String(data.next_payment_date ?? "").trim();
      if (nextPaymentDate) {
        update.current_period_end = nextPaymentDate;
      }

      if (resolvedPlan) {
        update.plan = resolvedPlan;
      }

      await applyEmployerUpdate(employerId, update);
      logInfo("paystack_webhook.subscription_create_applied", {
        requestId,
        eventKey: currentEventKey,
        employerId,
        resolvedPlan: resolvedPlan ?? null,
      });
      await markWebhookEvent(currentEventKey, "processed");
      return buildJsonResponse({ received: true, applied: true, event });
    }

    if (event === "subscription.disable") {
      await applyEmployerUpdate(employerId, {
        plan: "free",
        subscription_status: "cancelled",
        selected_plan: null,
        paystack_subscription_code: null,
        paystack_subscription_email_token: null,
      });

      logInfo("paystack_webhook.subscription_disable_applied", {
        requestId,
        eventKey: currentEventKey,
        employerId,
      });

      await markWebhookEvent(currentEventKey, "processed");
      return buildJsonResponse({ received: true, applied: true, event });
    }

    if (event === "invoice.payment_failed") {
      await applyEmployerUpdate(employerId, {
        subscription_status: "past_due",
      });

      if (reference) {
        await upsertBillingInvoice({
          employerId,
          reference,
          kind: "subscription",
          status: "failed",
          amountKobo: Number(data.amount ?? 0),
          metadata: { event },
        });
      }

      logInfo("paystack_webhook.invoice_payment_failed_applied", {
        requestId,
        eventKey: currentEventKey,
        employerId,
        reference,
      });

      await markWebhookEvent(currentEventKey, "processed");
      return buildJsonResponse({ received: true, applied: true, event });
    }

    if (event === "charge.success") {
      const planObj = (data.plan ?? {}) as Record<string, unknown>;
      const customerObj = (data.customer ?? {}) as Record<string, unknown>;
      const subscriptionObj = (data.subscription ?? {}) as Record<string, unknown>;
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;

      const resolvedPlan = await resolvePlanName(
        String(planObj.plan_code ?? ""),
        String(metadata.targetPlan ?? ""),
      );

      const update: Record<string, unknown> = {
        subscription_status: "active",
        selected_plan: null,
        paystack_customer_code: String(customerObj.customer_code ?? "") || null,
      };

      const subscriptionCode =
        String(subscriptionObj.subscription_code ?? "") ||
        String(data.subscription_code ?? "");
      if (subscriptionCode) {
        update.paystack_subscription_code = subscriptionCode;
      }

      const emailToken = String(subscriptionObj.email_token ?? "");
      if (emailToken) {
        update.paystack_subscription_email_token = emailToken;
      }

      if (resolvedPlan) {
        update.plan = resolvedPlan;
      }

      await applyEmployerUpdate(employerId, update);

      if (reference) {
        const isAddon = Boolean(String(metadata.addonId ?? "").trim());
        await upsertBillingInvoice({
          employerId,
          reference,
          kind: isAddon ? "addon" : "subscription",
          status: "paid",
          amountKobo: Number(data.amount ?? 0),
          paidAt: String(data.paid_at ?? "") || new Date().toISOString(),
          metadata: {
            event,
            targetPlan: resolvedPlan,
            addonId: String(metadata.addonId ?? "") || null,
          },
        });
      }

      logInfo("paystack_webhook.charge_success_applied", {
        requestId,
        eventKey: currentEventKey,
        employerId,
        reference,
        resolvedPlan: resolvedPlan ?? null,
      });

      await markWebhookEvent(currentEventKey, "processed");
      return buildJsonResponse({ received: true, applied: true, event });
    }

    logInfo("paystack_webhook.event_ignored", {
      requestId,
      event,
      eventKey: currentEventKey,
    });
    await markWebhookEvent(currentEventKey, "processed");
    return buildJsonResponse({ received: true, ignored: true, event });
  } catch (error) {
    if (currentEventKey) {
      await markWebhookEvent(currentEventKey, "failed", String(error));
    }
    logError("paystack_webhook.unhandled_exception", {
      requestId,
      eventKey: currentEventKey,
      error: String(error),
    });
    return buildJsonResponse({ error: String(error) }, 500);
  }
});
