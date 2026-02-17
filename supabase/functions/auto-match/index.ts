import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { job_id } = await req.json();
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

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

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        employer_id,
        title,
        description,
        location,
        employment_type,
        experience_level
      `)
      .eq("id", job_id)
      .maybeSingle();

    if (jobError || !job || String(job.employer_id) !== String(employer.id)) {
      return new Response(JSON.stringify({ error: "Job not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: aiCreditRow } = await supabase
      .from("employer_credits")
      .select("id, remaining")
      .eq("employer_id", employer.id)
      .eq("credit_type", "ai_credit")
      .maybeSingle();

    const currentCredits = Number(aiCreditRow?.remaining ?? 0);
    if (!aiCreditRow?.id || currentCredits < 1) {
      return new Response(JSON.stringify({ error: "Insufficient ai_credit balance" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deductError } = await supabase
      .from("employer_credits")
      .update({ remaining: currentCredits - 1 })
      .eq("id", aiCreditRow.id)
      .eq("remaining", currentCredits);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: `Failed to deduct ai_credit: ${deductError.message}` }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: jobSkills } = await supabase
      .from("job_skills")
      .select(`
        required,
        min_score,
        skills (
          name
        )
      `)
      .eq("job_id", job_id);

    const requiredSkills = jobSkills
      ?.filter((s) => s.required)
      .map((s) => `${s.skills.name} (${s.min_score || 0}%)`)
      .join(", ");

    const optionalSkills = jobSkills
      ?.filter((s) => !s.required)
      .map((s) => `${s.skills.name}`)
      .join(", ");

    const embeddingText = `
    Job Title:
    ${job.title}

    Description:
    ${job.description}

    Location:
    ${job.location}

    Employment Type:
    ${job.employment_type}

    Experience Level:
    ${job.experience_level}

    Required Skills:
    ${requiredSkills}

    Optional Skills:
    ${optionalSkills}
    `;

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingText,
    });

    const embedding = embeddingResponse.data[0].embedding;

    await supabase
      .from("jobs")
      .update({ embedding })
      .eq("id", job_id);

    const { data: matches } = await supabase.rpc("match_candidates", {
      job_embedding: embedding,
      match_threshold: 0.4,
      match_count: 50,
    });

    if (matches) {
      for (const match of matches) {
        await supabase
          .from("job_matches")
          .upsert({
            job_id,
            candidate_id: match.id,
            similarity: match.similarity,
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ai_credits_consumed: 1,
        ai_credits_remaining: currentCredits - 1,
        matches_found: matches?.length || 0,
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
