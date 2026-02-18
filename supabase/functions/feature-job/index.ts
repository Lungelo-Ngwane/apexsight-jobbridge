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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { jobId, days = 7 } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
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

    const { data: employer, error: employerError } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerError || !employer?.id) {
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, employer_id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job || String(job.employer_id) !== String(employer.id)) {
      return new Response(JSON.stringify({ error: "Job not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creditRow, error: creditError } = await supabase
      .from("employer_credits")
      .select("id, remaining")
      .eq("employer_id", employer.id)
      .eq("credit_type", "featured_job")
      .maybeSingle();

    if (creditError || !creditRow?.id || Number(creditRow.remaining ?? 0) < 1) {
      return new Response(JSON.stringify({ error: "Insufficient featured_job credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const current = Number(creditRow.remaining ?? 0);
    const { error: deductError } = await supabase
      .from("employer_credits")
      .update({ remaining: current - 1 })
      .eq("id", creditRow.id)
      .eq("remaining", current);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: `Failed to deduct credit: ${deductError.message}` }),
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
      .eq("employer_id", employer.id);

    if (featureError) {
      return new Response(
        JSON.stringify({ error: `Failed to feature job: ${featureError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await supabase.from("employer_credit_usage").insert({
      employer_id: employer.id,
      credit_type: "featured_job",
      amount: 1,
      context_type: "job",
      context_id: jobId,
      metadata: { featuredUntil, days: safeDays },
    });

    return new Response(
      JSON.stringify({
        success: true,
        featuredUntil,
        creditsRemaining: current - 1,
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
