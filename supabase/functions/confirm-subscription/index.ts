import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError, logInfo, logWarn } from "../_shared/observability.ts";

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

function formatInvoiceNumber(reference: string) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const safeRef = reference.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `INV-${stamp}-${safeRef}`;
}

async function upsertInvoice(params: {
  employerId: string;
  reference: string;
  plan: string;
  amountKobo: number;
  paidAt?: string | null;
  customerCode?: string | null;
  subscriptionCode?: string | null;
}) {
  const amountKobo = Number.isFinite(params.amountKobo) ? Math.max(0, Math.round(params.amountKobo)) : 0;
  const vatKobo = Math.round((amountKobo * 15) / 115);
  const invoiceNumber = formatInvoiceNumber(params.reference);
  const paidAt = params.paidAt ?? new Date().toISOString();
  const storagePath = `${params.employerId}/subscriptions/${params.reference}.txt`;

  const invoiceText = [
    `Invoice Number: ${invoiceNumber}`,
    `Type: Subscription`,
    `Status: Paid`,
    `Plan: ${params.plan}`,
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

  const finalStoragePath = upload.error ? null : storagePath;

  await supabase.from("billing_invoices").upsert(
    {
      employer_id: params.employerId,
      provider: "paystack",
      provider_reference: params.reference,
      invoice_number: invoiceNumber,
      kind: "subscription",
      status: "paid",
      currency: "ZAR",
      amount_kobo: amountKobo,
      vat_kobo: vatKobo,
      total_kobo: amountKobo,
      issued_at: paidAt,
      paid_at: paidAt,
      storage_path: finalStoragePath,
      metadata: {
        plan: params.plan,
        customerCode: params.customerCode ?? null,
        subscriptionCode: params.subscriptionCode ?? null,
      },
    },
    { onConflict: "provider,provider_reference,kind" },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    logInfo("confirm_subscription.request_received", {
      requestId,
      method: req.method,
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { reference } = await req.json();

    if (!token) {
      logWarn("confirm_subscription.missing_access_token", { requestId });
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reference) {
      logWarn("confirm_subscription.missing_reference", { requestId });
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      logWarn("confirm_subscription.invalid_user_session", { requestId });
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
          "Content-Type": "application/json",
        },
      },
    );

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData?.status) {
      logWarn("confirm_subscription.paystack_verify_failed", {
        requestId,
        reference,
        status: paystackRes.status,
      });
      return new Response(
        JSON.stringify({
          error: paystackData?.message ?? "Failed to verify payment",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const paymentStatus = paystackData?.data?.status;
    if (paymentStatus !== "success") {
      logWarn("confirm_subscription.payment_not_success", {
        requestId,
        reference,
        paymentStatus,
      });
      return new Response(JSON.stringify({ error: "Payment not successful" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = paystackData?.data?.metadata ?? {};
    const employerId = metadata.employerId as string | undefined;

    let targetPlan = String(metadata.targetPlan ?? "").toLowerCase();

    if (!allowedPlans.has(targetPlan)) {
      const paystackPlanCode =
        paystackData?.data?.plan_object?.plan_code ??
        paystackData?.data?.plan?.plan_code ??
        paystackData?.data?.plan ??
        null;

      if (paystackPlanCode) {
        const { data: planByCode } = await supabase
          .from("plans")
          .select("name")
          .eq("paystack_plan_code", paystackPlanCode)
          .maybeSingle();

        targetPlan = String(planByCode?.name ?? "").toLowerCase();
      }
    }

    if (!allowedPlans.has(targetPlan)) {
      logWarn("confirm_subscription.unresolved_target_plan", {
        requestId,
        reference,
      });
      return new Response(
        JSON.stringify({ error: "Could not resolve upgraded plan from transaction" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let employer = null;

    if (employerId) {
      const { data } = await supabase
        .from("employer_profiles")
        .select("id, user_id, plan")
        .eq("id", employerId)
        .eq("user_id", user.id)
        .maybeSingle();

      employer = data;
    }

    if (!employer) {
      const { data } = await supabase
        .from("employer_profiles")
        .select("id, user_id, plan")
        .eq("user_id", user.id)
        .maybeSingle();

      employer = data;
    }

    if (!employer) {
      logWarn("confirm_subscription.employer_not_found", {
        requestId,
        reference,
      });
      return new Response(
        JSON.stringify({ error: "Employer profile not found for this user" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const customerCode =
      paystackData?.data?.customer?.customer_code ??
      null;

    const subscriptionCode =
      paystackData?.data?.subscription?.subscription_code ??
      paystackData?.data?.subscription_code ??
      null;

    const subscriptionEmailToken =
      paystackData?.data?.subscription?.email_token ??
      null;

    const updates: Record<string, unknown> = {
      plan: targetPlan,
      subscription_status: "active",
      paystack_customer_code: customerCode,
    };

    if (subscriptionCode) {
      updates.paystack_subscription_code = subscriptionCode;
    }

    if (subscriptionEmailToken) {
      updates.paystack_subscription_email_token = subscriptionEmailToken;
    }

    const { error: updateError } = await supabase
      .from("employer_profiles")
      .update(updates)
      .eq("id", employer.id)
      .eq("user_id", user.id);

    if (updateError) {
      logError("confirm_subscription.plan_update_failed", {
        requestId,
        reference,
        employerId: employer.id,
        error: updateError.message,
      });
      return new Response(
        JSON.stringify({
          error: `Failed to update employer plan: ${updateError.message}`,
          detail: updateError.message,
          code: updateError.code,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await upsertInvoice({
      employerId: employer.id,
      reference: String(reference),
      plan: targetPlan,
      amountKobo: Number(paystackData?.data?.amount ?? 0),
      paidAt: String(paystackData?.data?.paid_at ?? "") || new Date().toISOString(),
      customerCode,
      subscriptionCode,
    });

    logInfo("confirm_subscription.success", {
      requestId,
      reference,
      employerId: employer.id,
      plan: targetPlan,
    });

    return new Response(
      JSON.stringify({
        success: true,
        plan: targetPlan,
        reference,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logError("confirm_subscription.unhandled_exception", {
      requestId,
      error: String(error),
    });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
