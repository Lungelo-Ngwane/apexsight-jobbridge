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

function toPercent(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeComparable(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s+#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeComparable(value: string) {
  const stopWords = new Set([
    "the", "and", "for", "with", "role", "job", "level", "senior", "junior", "mid", "developer",
    "engineer", "specialist", "manager", "lead", "to", "of", "in", "on", "a", "an",
  ]);

  return normalizeComparable(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function computeFinalMatchScore(input: {
  applicationScore: number | null;
  aiSimilarity: number | null;
  scoreBreakdown?: { required?: number; optional?: number; experience?: number; skill_level?: number } | null;
  job: {
    title?: string | null;
    experience_level?: string | null;
    job_skills?: Array<{ required?: boolean | null }> | null;
  };
  candidate: {
    headline?: string | null;
    resume_analysis?: { work_experience?: Array<{ title?: string | null }> } | null;
  };
}) {
  const applicationScore = Number.isFinite(Number(input.applicationScore)) ? Number(input.applicationScore) : null;
  const aiSimilarity = Number.isFinite(Number(input.aiSimilarity)) ? Number(input.aiSimilarity) : null;
  const baseHybrid =
    applicationScore === null || aiSimilarity === null
      ? (applicationScore ?? aiSimilarity ?? null)
      : clampScore((applicationScore * 0.7) + (aiSimilarity * 0.3));

  let penalty = 0;
  let recencyBonus = 0;

  const requiredScore = Number(input.scoreBreakdown?.required ?? 0);
  const experienceScore = Number(input.scoreBreakdown?.experience ?? 0);
  const requiredJobSkills = (input.job.job_skills ?? []).filter((row) => Boolean(row.required));

  if (requiredJobSkills.length > 0 && requiredScore <= 0) penalty += 20;
  if (normalizeComparable(String(input.job.experience_level ?? "")) && experienceScore <= 0) penalty += 10;

  const recentRoleTitle = String(input.candidate.resume_analysis?.work_experience?.[0]?.title ?? "").trim();
  const comparisonPool = `${input.candidate.headline ?? ""} ${recentRoleTitle}`.trim();
  if (comparisonPool && input.job.title) {
    const candidateTokens = new Set(tokenizeComparable(comparisonPool));
    const jobTokens = tokenizeComparable(String(input.job.title));
    const overlap = jobTokens.filter((token) => candidateTokens.has(token)).length;
    if (overlap >= 2) recencyBonus += 8;
    else if (overlap >= 1) recencyBonus += 4;
  }

  return baseHybrid === null ? 0 : clampScore(baseHybrid + recencyBonus - penalty);
}

async function sendShortlistNotifications(applicationIds: string[], token: string) {
  const functionBaseUrl = `${String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "")}/functions/v1`;
  if (!functionBaseUrl || applicationIds.length === 0) return;

  await Promise.allSettled(
    applicationIds.map((applicationId) =>
      fetch(`${functionBaseUrl}/send-notification-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "CANDIDATE_SHORTLISTED",
          data: { applicationId },
        }),
      }),
    ),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const body = await requestObject(req);
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    const threshold = Number(body.threshold ?? 70);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) return new Response(JSON.stringify({error:"Invalid threshold"}), {status:400,headers:corsHeaders});

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let employer;
    try {
      employer = await resolveEmployerContext(supabase, token, {
        requiredRoles: ["owner", "admin", "recruiter"],
      });
    } catch {
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPlan = String(employer.plan ?? "").trim().toLowerCase();
    const normalizedSubscriptionStatus = String(employer.subscriptionStatus ?? "").trim().toLowerCase();
    const hasIncludedAccess =
      normalizedPlan === "enterprise" && normalizedSubscriptionStatus === "active";

    const shortlistThreshold = Math.max(0, Math.min(100, Math.round(Number(threshold ?? 70))));

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        employer_id,
        title,
        status,
        experience_level,
        job_skills (
          required
        )
      `)
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job || String(job.employer_id) !== String(employer.employerId)) {
      return new Response(JSON.stringify({ error: "Job not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: applications, error: applicationsError } = await supabase
      .from("job_applications")
      .select(`
        id,
        candidate_profile_id,
        status,
        score,
        score_breakdown,
        candidate_profiles (
          id,
          headline,
          resume_analysis
        )
      `)
      .eq("job_id", jobId);

    if (applicationsError) {
      return new Response(JSON.stringify({ error: "The request could not be completed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appliedApplications = (applications ?? []).filter(
      (application) => String(application.status ?? "applied").trim().toLowerCase() === "applied",
    );

    if (appliedApplications.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          shortlisted_count: 0,
          already_shortlisted_count: 0,
          below_threshold_count: 0,
          credits_consumed: 0,
          credits_remaining: hasIncludedAccess ? null : undefined,
          threshold: shortlistThreshold,
          skipped_reason: "no_applied_candidates",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let currentCredits: number | null = null;
    if (!hasIncludedAccess) {
      const { data: creditRow } = await supabase
        .from("employer_credits")
        .select("id, remaining")
        .eq("employer_id", employer.employerId)
        .eq("credit_type", "auto_shortlist")
        .maybeSingle();

      currentCredits = Number(creditRow?.remaining ?? 0);
      if (!creditRow?.id || currentCredits < 1) {
        return new Response(JSON.stringify({ error: "Insufficient auto_shortlist credits" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deductError } = await supabase.rpc("consume_employer_credit", { p_employer_id: employer.employerId, p_credit_type: "auto_shortlist", p_amount: 1 });

      if (deductError) {
        return new Response(
          JSON.stringify({ error: "The request could not be completed" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const candidateIds = Array.from(
      new Set(
        appliedApplications
          .map((application) => String(application.candidate_profile_id ?? "").trim())
          .filter(Boolean),
      ),
    );

    const { data: matchRows, error: matchesError } = candidateIds.length
      ? await supabase
          .from("job_matches")
          .select("candidate_id, similarity")
          .eq("job_id", jobId)
          .in("candidate_id", candidateIds)
      : { data: [], error: null };

    if (matchesError) {
      return new Response(JSON.stringify({ error: "The request could not be completed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const similarityByCandidateId = new Map<string, number>();
    for (const row of matchRows ?? []) {
      similarityByCandidateId.set(
        String(row.candidate_id ?? ""),
        toPercent(Number(row.similarity ?? 0) * 100),
      );
    }

    const qualifyingApplications = appliedApplications.filter((application) => {
      const candidate = (application as {
        candidate_profiles?: {
          id?: string | null;
          headline?: string | null;
          resume_analysis?: { work_experience?: Array<{ title?: string | null }> } | null;
        } | null;
      }).candidate_profiles;

      const finalMatchScore = computeFinalMatchScore({
        applicationScore: toPercent(application.score),
        aiSimilarity: similarityByCandidateId.get(String(candidate?.id ?? "")) ?? 0,
        scoreBreakdown: (application as {
          score_breakdown?: { required?: number; optional?: number; experience?: number; skill_level?: number } | null;
        }).score_breakdown ?? null,
        job: {
          title: String(job.title ?? ""),
          experience_level: String(job.experience_level ?? ""),
          job_skills: ((job as { job_skills?: Array<{ required?: boolean | null }> }).job_skills ?? []),
        },
        candidate: {
          headline: String(candidate?.headline ?? ""),
          resume_analysis: candidate?.resume_analysis ?? null,
        },
      });

      return finalMatchScore >= shortlistThreshold;
    });

    const applicationIdsToShortlist = qualifyingApplications
      .map((application) => String(application.id ?? "").trim())
      .filter(Boolean);

    if (applicationIdsToShortlist.length > 0) {
      const { error: updateError } = await supabase
        .from("job_applications")
        .update({ status: "shortlisted" })
        .in("id", applicationIdsToShortlist);

      if (updateError) {
        return new Response(JSON.stringify({ error: "The request could not be completed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sendShortlistNotifications(applicationIdsToShortlist, token);
    }

    if (!hasIncludedAccess) {
      await supabase.from("employer_credit_usage").insert({
        employer_id: employer.employerId,
        credit_type: "auto_shortlist",
        amount: 1,
        context_type: "job",
        context_id: jobId,
        metadata: {
          threshold: shortlistThreshold,
          shortlisted_count: applicationIdsToShortlist.length,
          applied_count: appliedApplications.length,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        shortlisted_count: applicationIdsToShortlist.length,
        already_shortlisted_count: (applications ?? []).filter(
          (application) => String(application.status ?? "").trim().toLowerCase() === "shortlisted",
        ).length,
        below_threshold_count: appliedApplications.length - applicationIdsToShortlist.length,
        credits_consumed: hasIncludedAccess ? 0 : 1,
        credits_remaining: hasIncludedAccess || currentCredits === null ? null : currentCredits - 1,
        threshold: shortlistThreshold,
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
