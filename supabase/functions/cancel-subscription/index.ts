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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return jsonResponse({ error: "Missing access token" }, 401);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Invalid user session" }, 401);
    }

    const { data: employer, error: employerError } = await supabase
      .from("employer_profiles")
      .select(
        "id, user_id, paystack_subscription_code, paystack_subscription_email_token",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerError || !employer?.id) {
      return jsonResponse({ error: "Employer profile not found" }, 404);
    }

    const subscriptionCode = String(employer.paystack_subscription_code ?? "").trim();
    const emailToken = String(employer.paystack_subscription_email_token ?? "").trim();

    if (subscriptionCode && emailToken) {
      const paystackRes = await fetch(
        "https://api.paystack.co/subscription/disable",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: subscriptionCode,
            token: emailToken,
          }),
        },
      );

      const paystackData = await paystackRes.json();

      if (!paystackRes.ok || !paystackData?.status) {
        return jsonResponse(
          { error: paystackData?.message ?? "Failed to disable subscription" },
          400,
        );
      }
    }

    const { error: updateError } = await supabase
      .from("employer_profiles")
      .update({
        plan: "free",
        subscription_status: "cancelled",
        selected_plan: null,
        paystack_subscription_code: null,
        paystack_subscription_email_token: null,
      })
      .eq("id", employer.id)
      .eq("user_id", user.id);

    if (updateError) {
      return jsonResponse(
        {
          error: `Failed to update employer subscription: ${updateError.message}`,
          detail: updateError.message,
          code: updateError.code,
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      cancelled: true,
      downgradedPlan: "free",
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
