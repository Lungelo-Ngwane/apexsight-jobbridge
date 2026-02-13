import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { employerId, planId, planName, email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let plan = null;

    if (planId) {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();

      plan = data;
    }

    const planLookup = (planName ?? planId ?? "").trim();

    if (!plan && planLookup) {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .ilike("name", planLookup)
        .maybeSingle();

      plan = data;
    }

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      email: email,
      plan: plan.paystack_plan_code,
      callback_url: callbackUrl,
      metadata: {
        employerId,
        planId: plan.id,
        targetPlan: planLookup.toLowerCase(),
      },
    };

    if (amountInKobo) {
      payload.amount = amountInKobo;
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
      return new Response(
        JSON.stringify({
          error: paystackData?.message ?? "Failed to initialize checkout",
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
