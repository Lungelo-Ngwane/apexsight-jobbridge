import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveEmployerContext } from "../_shared/employer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function normalizePlanValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isPaystackTestMode() {
  const secret = String(Deno.env.get("PAYSTACK_SECRET_KEY") ?? "").trim().toLowerCase();
  return secret.startsWith("sk_test_");
}

function resolvePaystackPlanCode(plan: Record<string, unknown>) {
  const testMode = isPaystackTestMode();
  const liveCode = String(plan.paystack_plan_code ?? "").trim();
  const testCode = String(plan.paystack_test_plan_code ?? "").trim();
  return testMode ? (testCode || liveCode) : liveCode;
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

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { planId, planName } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let employer;
    try {
      employer = await resolveEmployerContext(supabase, token, {
        requiredRoles: ["owner", "admin"],
      });
    } catch {
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = employer.user;

    let plan = null;
    let resolvedPlanSlug = "";

    if (planId) {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();

      plan = data;
    }

    const planLookup = String(planName ?? planId ?? "").trim();
    const normalizedLookup = normalizePlanValue(planLookup);

    if (!plan && planLookup) {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .ilike("name", planLookup)
        .maybeSingle();

      plan = data;
    }

    if (!plan && normalizedLookup) {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true);

      plan =
        (data ?? []).find((row) => normalizePlanValue(row.name) === normalizedLookup) ??
        null;
    }

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    resolvedPlanSlug = normalizePlanValue(plan.name);

    const amount = Number(plan.price_monthly);
    const amountInKobo = Number.isFinite(amount)
      ? Math.round(amount >= 10000 ? amount : amount * 100)
      : null;

    const origin =
      req.headers.get("origin") ??
      Deno.env.get("APP_URL") ??
      "http://localhost:5173";
    const callbackUrl = `${origin}/employer/billing?success=true`;

    const payload: Record<string, unknown> = {
      email: String(user.email ?? ""),
      plan: resolvePaystackPlanCode(plan),
      callback_url: callbackUrl,
      metadata: {
        employerId: employer.employerId,
        planId: plan.id,
        targetPlan: resolvedPlanSlug,
      },
    };

    if (amountInKobo) {
      payload.amount = amountInKobo;
    }

    if (resolvedPlanSlug !== "free") {
      const { error: pendingUpdateError } = await supabase
        .from("employer_profiles")
        .update({
          selected_plan: resolvedPlanSlug,
          subscription_status: "pending_payment",
        })
        .eq("id", employer.employerId);

      if (pendingUpdateError) {
        return new Response(
          JSON.stringify({
            error: `Failed to prepare pending subscription: ${pendingUpdateError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Call Paystack API
    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const paystackData = await response.json();

    if (!response.ok || !paystackData?.status) {
      const selectedPlanCode = resolvePaystackPlanCode(plan);
      const paystackMessage = String(
        paystackData?.message ?? "Failed to initialize checkout",
      );

      return new Response(
        JSON.stringify({
          error:
            paystackMessage.toLowerCase() === "plan not found."
              ? `Paystack plan not found for code "${selectedPlanCode}". Check that PAYSTACK_SECRET_KEY mode matches this plan code (test vs live).`
              : `Paystack initialize failed: ${paystackMessage}`,
          planId: String(plan.id ?? ""),
          planName: String(plan.name ?? ""),
          planCode: selectedPlanCode,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(paystackData.data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
