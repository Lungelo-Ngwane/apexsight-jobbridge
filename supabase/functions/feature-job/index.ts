import { requestObject } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { resolveEmployerContext } from "../_shared/employer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { jobId, days = 7 } = await requestObject(req);

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let employer;
    try {
      employer = await resolveEmployerContext(supabase, token);
    } catch {
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPlan = String(employer.plan ?? "").trim().toLowerCase();
    const normalizedSubscriptionStatus = String(employer.subscriptionStatus ?? "").trim().toLowerCase();
    const hasIncludedFeaturedAccess =
      normalizedPlan === "enterprise" && normalizedSubscriptionStatus === "active";

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, employer_id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job || String(job.employer_id) !== String(employer.employerId)) {
      return new Response(JSON.stringify({ error: "Job not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creditRow, error: creditError } = hasIncludedFeaturedAccess
      ? { data: null, error: null }
      : await supabase
          .from("employer_credits")
          .select("id, remaining")
          .eq("employer_id", employer.employerId)
          .eq("credit_type", "featured_job")
          .maybeSingle();

    if (!hasIncludedFeaturedAccess && (creditError || !creditRow?.id || Number(creditRow.remaining ?? 0) < 1)) {
      return new Response(JSON.stringify({ error: "Insufficient featured_job credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const current = Number(creditRow?.remaining ?? 0);
    const { error: deductError } = hasIncludedFeaturedAccess
      ? { error: null }
      : await supabase.rpc("consume_employer_credit", { p_employer_id: employer.employerId, p_credit_type: "featured_job", p_amount: 1 });

    if (deductError) {
      return new Response(
        JSON.stringify({ error: "The request could not be completed" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const safeDays = Math.max(1, Math.min(30, Number(days) || 7));
    const now = new Date();
    const featuredUntil = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: featureError } = await supabase
      .from("jobs")
      .update({
        is_featured: true,
        featured_until: featuredUntil,
      })
      .eq("id", jobId)
      .eq("employer_id", employer.employerId);

    if (featureError) {
      return new Response(
        JSON.stringify({ error: "The request could not be completed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!hasIncludedFeaturedAccess) {
      await supabase.from("employer_credit_usage").insert({
        employer_id: employer.employerId,
        credit_type: "featured_job",
        amount: 1,
        context_type: "job",
        context_id: jobId,
        metadata: { featuredUntil, days: safeDays },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        featuredUntil,
        creditsRemaining: hasIncludedFeaturedAccess ? null : current - 1,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch {
    return new Response(JSON.stringify({ error: "The request could not be completed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
