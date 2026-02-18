import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
    const { job_id } = await req.json();

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
      .select("id, employer_id, embedding")
      .eq("id", job_id)
      .maybeSingle();

    if (jobError || !job || String(job.employer_id) !== String(employer.id)) {
      return new Response(JSON.stringify({ error: "Job not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!job.embedding) {
      return new Response(JSON.stringify({ error: "Job embedding not found. Generate embedding first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creditRow } = await supabase
      .from("employer_credits")
      .select("id, remaining")
      .eq("employer_id", employer.id)
      .eq("credit_type", "ai_credit")
      .maybeSingle();

    const current = Number(creditRow?.remaining ?? 0);
    if (!creditRow?.id || current < 1) {
      return new Response(JSON.stringify({ error: "Insufficient ai_credit balance" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deductError } = await supabase
      .from("employer_credits")
      .update({ remaining: current - 1 })
      .eq("id", creditRow.id)
      .eq("remaining", current);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: `Failed to deduct ai_credit: ${deductError.message}` }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: matches, error: matchError } = await supabase.rpc("match_candidates", {
      job_embedding: job.embedding,
      match_threshold: 0.4,
      match_count: 20,
    });

    if (matchError) {
      return new Response(JSON.stringify({ error: matchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("employer_credit_usage").insert({
      employer_id: employer.id,
      credit_type: "ai_credit",
      amount: 1,
      context_type: "job",
      context_id: job_id,
      metadata: { source: "match-candidates" },
    });

    return new Response(
      JSON.stringify({
        matches: matches ?? [],
        ai_credits_consumed: 1,
        ai_credits_remaining: current - 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
