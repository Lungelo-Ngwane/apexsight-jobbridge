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

function formatInvoiceNumber(reference: string) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const safeRef = reference.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `INV-${stamp}-${safeRef}`;
}

async function upsertAddonInvoice(params: {
  employerId: string;
  reference: string;
  addonType: string;
  creditsAdded: number;
  amountKobo: number;
  paidAt?: string | null;
}) {
  const amountKobo = Number.isFinite(params.amountKobo) ? Math.max(0, Math.round(params.amountKobo)) : 0;
  const vatKobo = Math.round((amountKobo * 15) / 115);
  const invoiceNumber = formatInvoiceNumber(params.reference);
  const paidAt = params.paidAt ?? new Date().toISOString();
  const storagePath = `${params.employerId}/addons/${params.reference}.txt`;

  const invoiceText = [
    `Invoice Number: ${invoiceNumber}`,
    `Type: Add-on`,
    `Status: Paid`,
    `Reference: ${params.reference}`,
    `Credit Type: ${params.addonType}`,
    `Credits Added: ${params.creditsAdded}`,
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
      kind: "addon",
      status: "paid",
      currency: "ZAR",
      amount_kobo: amountKobo,
      vat_kobo: vatKobo,
      total_kobo: amountKobo,
      issued_at: paidAt,
      paid_at: paidAt,
      storage_path: finalStoragePath,
      metadata: {
        addonType: params.addonType,
        creditsAdded: params.creditsAdded,
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
    logInfo("confirm_addon.request_received", {
      requestId,
      method: req.method,
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { reference } = await req.json();

    if (!token) {
      logWarn("confirm_addon.missing_access_token", { requestId });
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reference) {
      logWarn("confirm_addon.missing_reference", { requestId });
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
      logWarn("confirm_addon.invalid_user_session", { requestId });
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: employer, error: employerError } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerError || !employer?.id) {
      logWarn("confirm_addon.employer_not_found", { requestId });
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        },
      },
    );

    const verifyPayload = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyPayload?.status) {
      logWarn("confirm_addon.paystack_verify_failed", {
        requestId,
        reference,
        status: verifyResponse.status,
      });
      return new Response(
        JSON.stringify({
          error: verifyPayload?.message ?? "Failed to verify add-on payment",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const paymentStatus = String(verifyPayload?.data?.status ?? "");
    if (paymentStatus !== "success") {
      logWarn("confirm_addon.payment_not_success", {
        requestId,
        reference,
        paymentStatus,
      });
      return new Response(JSON.stringify({ error: "Payment not successful" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = (verifyPayload?.data?.metadata ?? {}) as Record<string, unknown>;
    const addonId = String(metadata.addonId ?? "").trim();
    const employerId = String(metadata.employerId ?? "").trim();

    if (!addonId || !employerId || employerId !== employer.id) {
      logWarn("confirm_addon.metadata_mismatch", {
        requestId,
        reference,
        employerId,
      });
      return new Response(
        JSON.stringify({ error: "Transaction metadata does not match this employer" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: addon, error: addonError } = await supabase
      .from("addons")
      .select("id, type, credits")
      .eq("id", addonId)
      .maybeSingle();

    if (addonError || !addon) {
      logWarn("confirm_addon.addon_not_found", {
        requestId,
        reference,
        addonId,
      });
      return new Response(JSON.stringify({ error: "Add-on not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creditsToAdd = Number(addon.credits ?? 0);
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      logWarn("confirm_addon.invalid_credit_quantity", {
        requestId,
        reference,
        creditsToAdd,
      });
      return new Response(
        JSON.stringify({ error: "Invalid credit quantity for add-on" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const amountPaid = Number(verifyPayload?.data?.amount ?? 0);
    const { data: grantRows, error: grantError } = await supabase.rpc(
      "grant_addon_credits",
      {
        p_reference: reference,
        p_employer_id: employer.id,
        p_addon_id: addon.id,
        p_amount_paid: amountPaid,
        p_credit_type: String(addon.type ?? ""),
        p_credits_to_add: creditsToAdd,
      },
    );

    if (grantError) {
      logError("confirm_addon.credit_grant_failed", {
        requestId,
        reference,
        error: grantError.message,
      });
      return new Response(
        JSON.stringify({ error: `Failed to grant add-on credits: ${grantError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const grantResult = Array.isArray(grantRows) ? grantRows[0] : grantRows;
    const alreadyProcessed = Boolean(grantResult?.already_processed);
    const appliedCredits = Number(grantResult?.credits_added ?? creditsToAdd);

    logInfo("confirm_addon.credit_grant_succeeded", {
      requestId,
      reference,
      employerId: employer.id,
      addonId: addon.id,
      creditType: String(addon.type ?? ""),
      appliedCredits,
      alreadyProcessed,
    });

    await upsertAddonInvoice({
      employerId: employer.id,
      reference,
      addonType: String(addon.type ?? ""),
      creditsAdded: appliedCredits,
      amountKobo: amountPaid,
      paidAt: String(verifyPayload?.data?.paid_at ?? "") || new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        reference,
        creditType: addon.type,
        creditsAdded: appliedCredits,
        alreadyProcessed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logError("confirm_addon.unhandled_exception", {
      requestId,
      error: String(error),
    });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
