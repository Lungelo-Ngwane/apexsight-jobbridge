import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveEmployerContext } from "../_shared/employer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildCandidateEmbeddingText(candidate: Record<string, unknown>): string {
  const skills = Array.isArray(candidate.candidate_skills)
    ? candidate.candidate_skills
        .map((s) => {
          const skill = String((s as { skill?: string }).skill ?? "").trim();
          const level = String((s as { level?: string }).level ?? "").trim();
          return skill ? `${skill}${level ? ` (${level})` : ""}` : "";
        })
        .filter((s) => s.length > 0)
    : [];

  return `
Candidate Headline: ${String(candidate.headline ?? "")}
Professional Summary: ${String(candidate.professional_bio_ai ?? "") || String(candidate.bio ?? "")}
Resume Summary: ${String(candidate.resume_summary ?? "")}
Years Experience: ${String(candidate.years_experience ?? "")}
Experience Level: ${String(candidate.experience_level ?? "")}
Location: ${String(candidate.location ?? "")}
Availability: ${String(candidate.availability ?? "")}
Preferred Job Type: ${String(candidate.preferred_job_type ?? "")}
Work Mode: ${String(candidate.work_mode ?? "")}
Core Skills: ${skills.slice(0, 80).join(", ")}
Resume Evidence: ${String(candidate.resume_text ?? "").slice(0, 4000)}
`;
}

async function ensureCandidateEmbeddings(
  supabase: ReturnType<typeof createClient>,
  openai: OpenAI,
  jobId: string,
) {
  const MAX_EMBEDDINGS_PER_RUN = 20;
  const CONCURRENCY = 3;
  const MAX_APPLICATION_SCAN = 500;

  const { data: applicationRows, error: applicationError } = await supabase
    .from("job_applications")
    .select("candidate_profile_id")
    .eq("job_id", jobId)
    .limit(MAX_APPLICATION_SCAN);

  if (applicationError) {
    throw applicationError;
  }

  const candidateIds = Array.from(
    new Set(
      (applicationRows ?? [])
        .map((row) => String((row as { candidate_profile_id?: string | null }).candidate_profile_id ?? "").trim())
        .filter((id) => id.length > 0),
    ),
  );

  if (candidateIds.length === 0) {
    return;
  }

  const { data: rows, error: candidatesError } = await supabase
    .from("candidate_profiles")
    .select(
      `
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
    `,
    )
    .in("id", candidateIds)
    .is("embedding", null)
    .limit(MAX_EMBEDDINGS_PER_RUN);

  if (candidatesError) {
    throw candidatesError;
  }

  const candidates = (rows ?? [])
    .filter((candidate): candidate is Record<string, unknown> => Boolean((candidate as { id?: unknown }).id));

  if (candidates.length === 0) {
    return;
  }

  async function processCandidate(candidate: Record<string, unknown>) {
    if (candidate.embedding) return;

    const text = buildCandidateEmbeddingText(candidate);

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    await supabase
      .from("candidate_profiles")
      .update({ embedding: embeddingResponse.data[0].embedding })
      .eq("id", String(candidate.id));
  }

  for (let index = 0; index < candidates.length; index += CONCURRENCY) {
    const batch = candidates.slice(index, index + CONCURRENCY);
    await Promise.all(batch.map((candidate) => processCandidate(candidate)));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { job_id, skip_credit = false } = await req.json();
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

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
    const hasIncludedAiAccess =
      (normalizedPlan === "professional" || normalizedPlan === "enterprise")
      && normalizedSubscriptionStatus === "active";

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

    if (jobError || !job || String(job.employer_id) !== String(employer.employerId)) {
      return new Response(JSON.stringify({ error: "Job not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let currentCredits: number | null = null;
    if (!skip_credit && !hasIncludedAiAccess) {
      const { data: aiCreditRow } = await supabase
        .from("employer_credits")
        .select("id, remaining")
        .eq("employer_id", employer.employerId)
        .eq("credit_type", "ai_credit")
        .maybeSingle();

      currentCredits = Number(aiCreditRow?.remaining ?? 0);
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

    await ensureCandidateEmbeddings(supabase, openai, job_id);

    const { data: matches, error: matchesError } = await supabase.rpc(
      "match_candidates_with_scores",
      {
        p_job_id: job_id,
        p_match_threshold: 0.4,
        p_match_count: 50,
      },
    );

    if (matchesError) {
      return new Response(JSON.stringify({ error: matchesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (matches?.length) {
      const payload = matches.map((match) => ({
        job_id,
        candidate_id: match.id,
        similarity: match.similarity,
      }));

      const { error: upsertError } = await supabase
        .from("job_matches")
        .upsert(payload, {
          onConflict: "job_id,candidate_id",
        });

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ai_credits_consumed: skip_credit || hasIncludedAiAccess ? 0 : 1,
        ai_credits_remaining:
          skip_credit || hasIncludedAiAccess || currentCredits === null ? null : currentCredits - 1,
        skip_credit: Boolean(skip_credit),
        matches_found: matches?.length || 0,
        matches: matches ?? [],
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
