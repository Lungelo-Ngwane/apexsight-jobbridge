import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
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

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

async function ensureCandidateEmbeddings(jobId: string) {
  const { data: rows } = await supabase
    .from("job_applications")
    .select(
      `
      candidate_profile_id,
      candidate_profiles (
        id,
        full_name,
        headline,
        bio,
        professional_bio_ai,
        location,
        years_experience,
        experience_level,
        availability,
        preferred_job_type,
        work_mode,
        resume_text,
        resume_summary,
        cv_url,
        embedding,
        candidate_skills (
          skill,
          level
        )
      )
    `,
    )
    .eq("job_id", jobId);

  const candidates = (rows ?? [])
    .map((row) => (row as { candidate_profiles?: Record<string, unknown> | null }).candidate_profiles)
    .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate?.id));

  for (const candidate of candidates) {
    if (candidate.embedding) continue;

    const skills = Array.isArray(candidate.candidate_skills)
      ? candidate.candidate_skills
          .map((s) => {
            const skill = String((s as { skill?: string }).skill ?? "").trim();
            const level = String((s as { level?: string }).level ?? "").trim();
            return skill ? `${skill}${level ? ` (${level})` : ""}` : "";
          })
          .filter((s) => s.length > 0)
      : [];

    const text = `
Candidate Name: ${String(candidate.full_name ?? "")}
Headline: ${String(candidate.headline ?? "")}
Bio: ${String(candidate.bio ?? "")}
AI Professional Bio: ${String(candidate.professional_bio_ai ?? "")}
Location: ${String(candidate.location ?? "")}
Years Experience: ${String(candidate.years_experience ?? "")}
Experience Level: ${String(candidate.experience_level ?? "")}
Availability: ${String(candidate.availability ?? "")}
Preferred Job Type: ${String(candidate.preferred_job_type ?? "")}
Work Mode: ${String(candidate.work_mode ?? "")}
Resume Summary: ${String(candidate.resume_summary ?? "")}
Resume Text: ${String(candidate.resume_text ?? "").slice(0, 12000)}
CV Path: ${String(candidate.cv_url ?? "")}
Skills: ${skills.join(", ")}
`;

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    await supabase
      .from("candidate_profiles")
      .update({ embedding: embeddingResponse.data[0].embedding })
      .eq("id", String(candidate.id));
  }
}

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

    await ensureCandidateEmbeddings(job_id);

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

    const { data: matches, error: matchError } = await supabase.rpc(
      "match_candidates_with_scores",
      {
        p_job_id: job_id,
        p_match_threshold: 0.4,
        p_match_count: 20,
      },
    );

    if (matchError) {
      return new Response(JSON.stringify({ error: matchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (matches) {
      for (const match of matches) {
        await supabase
          .from("job_matches")
          .upsert({
            job_id,
            candidate_id: match.id,
            similarity: match.similarity,
          }, {
            onConflict: "job_id,candidate_id",
          });
      }
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
