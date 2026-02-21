import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

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
    const { job_id, skip_credit = false } = await req.json();

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
      .select("id, employer_id, title, description, location")
      .eq("id", job_id)
      .maybeSingle();

    if (jobError || !job || String(job.employer_id) !== String(employer.id)) {
      return new Response(JSON.stringify({ error: "Job not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let current: number | null = null;
    if (!skip_credit) {
      const { data: creditRow } = await supabase
        .from("employer_credits")
        .select("id, remaining")
        .eq("employer_id", employer.id)
        .eq("credit_type", "ai_credit")
        .maybeSingle();

      current = Number(creditRow?.remaining ?? 0);
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
    }

    const text = `
    Title: ${job.title}
    Description: ${job.description}
    Location: ${job.location}
    `;

    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    await supabase
      .from("jobs")
      .update({
        embedding: embedding.data[0].embedding,
      })
      .eq("id", job_id)
      .eq("employer_id", employer.id);

    if (!skip_credit) {
      await supabase.from("employer_credit_usage").insert({
        employer_id: employer.id,
        credit_type: "ai_credit",
        amount: 1,
        context_type: "job",
        context_id: job_id,
        metadata: { source: "generate-job-embedding" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        ai_credits_consumed: skip_credit ? 0 : 1,
        ai_credits_remaining: skip_credit ? null : (current as number) - 1,
        skip_credit: Boolean(skip_credit),
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
