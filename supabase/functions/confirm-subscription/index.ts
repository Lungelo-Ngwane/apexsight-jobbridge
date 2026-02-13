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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { reference } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reference) {
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
      return new Response(
        JSON.stringify({ error: "Employer profile not found for this user" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (employer.plan !== targetPlan) {
      const { error: updateError } = await supabase
        .from("employer_profiles")
        .update({ plan: targetPlan })
        .eq("id", employer.id)
        .eq("user_id", user.id);

      if (updateError) {
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
    }

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
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
