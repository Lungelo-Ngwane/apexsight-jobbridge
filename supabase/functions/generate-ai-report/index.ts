import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

function toPercent(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function toScoreBand(score: number) {
  if (score >= 80) return "High";
  if (score >= 60) return "Moderate";
  return "Low";
}

function normalizeSkillKey(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bjs\b/g, "javascript")
    .replace(/\bts\b/g, "typescript")
    .replace(/[^a-z0-9+#]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { jobId } = await req.json();

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

    const { data: creditRow, error: creditError } = await supabase
      .from("employer_credits")
      .select("id, remaining")
      .eq("employer_id", employer.employerId)
      .eq("credit_type", "ai_report")
      .maybeSingle();

    if (creditError || !creditRow?.id || Number(creditRow.remaining ?? 0) < 1) {
      return new Response(JSON.stringify({ error: "Insufficient ai_report credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        employer_id,
        title,
        description,
        location,
        employment_type,
        experience_level,
        work_mode,
        department,
        min_years_experience,
        job_skills (
          required,
          min_score,
          skills ( name )
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

    const { data: applicants } = await supabase
      .from("job_applications")
      .select(`
        id,
        status,
        score,
        score_breakdown,
        created_at,
        candidate_profile_id,
        candidate:candidate_profiles (
          id,
          full_name,
          headline,
          location,
          years_experience,
          professional_bio_ai,
          resume_summary,
          bio,
          candidate_skills (
            level,
            skills ( name )
          )
        )
      `)
      .eq("job_id", jobId);

    const totalApplicants = (applicants ?? []).length;
    const shortlisted = (applicants ?? []).filter((a) => a.status === "shortlisted").length;
    const interviewed = (applicants ?? []).filter((a) => a.status === "interview").length;
    const averageScore =
      totalApplicants > 0
        ? Math.round(
            (applicants ?? []).reduce((sum, a) => sum + Number(a.score ?? 0), 0) / totalApplicants,
          )
        : 0;

    const candidateIds = Array.from(
      new Set(
        (applicants ?? [])
          .map((application) => String(application.candidate_profile_id ?? "").trim())
          .filter(Boolean),
      ),
    );

    const { data: matchRows } = candidateIds.length
      ? await supabase
          .from("job_matches")
          .select("candidate_id, similarity")
          .eq("job_id", jobId)
          .in("candidate_id", candidateIds)
      : { data: [] as Array<{ candidate_id: string; similarity: number | null }> };

    const similarityByCandidateId = new Map<string, number>();
    for (const row of matchRows ?? []) {
      similarityByCandidateId.set(String(row.candidate_id), toPercent(Number(row.similarity ?? 0) * 100));
    }

    const requiredSkills = ((job as {
      job_skills?: Array<{ required?: boolean | null; skills?: { name?: string | null } | null }>;
    }).job_skills ?? [])
      .filter((item) => item.required)
      .map((item) => String(item.skills?.name ?? "").trim())
      .filter(Boolean);

    const optionalSkills = ((job as {
      job_skills?: Array<{ required?: boolean | null; skills?: { name?: string | null } | null }>;
    }).job_skills ?? [])
      .filter((item) => !item.required)
      .map((item) => String(item.skills?.name ?? "").trim())
      .filter(Boolean);

    const enrichedApplicants = (applicants ?? []).map((application) => {
      const candidate = (application as {
        candidate?: {
          id?: string;
          full_name?: string | null;
          headline?: string | null;
          location?: string | null;
          years_experience?: number | null;
          professional_bio_ai?: string | null;
          resume_summary?: string | null;
          bio?: string | null;
          candidate_skills?: Array<{
            level?: string | null;
            skills?: { name?: string | null } | null;
          }>;
        } | null;
      }).candidate;

      const candidateSkillNames = (candidate?.candidate_skills ?? [])
        .map((skill) => String(skill.skills?.name ?? "").trim())
        .filter(Boolean);

      const candidateSkillKeys = new Set(candidateSkillNames.map((skill) => normalizeSkillKey(skill)));

      const matchedRequiredSkills = requiredSkills.filter((requiredSkill) =>
        candidateSkillKeys.has(normalizeSkillKey(requiredSkill)),
      );

      const missingRequiredSkills = requiredSkills.filter((requiredSkill) =>
        !candidateSkillKeys.has(normalizeSkillKey(requiredSkill)),
      );

      const aiSimilarityPercent = similarityByCandidateId.get(String(candidate?.id ?? "")) ?? 0;
      const ruleBasedScore = toPercent(application.score);
      const hybridScore = Math.round(ruleBasedScore * 0.7 + aiSimilarityPercent * 0.3);

      return {
        application_id: String(application.id),
        status: String(application.status ?? "applied"),
        rule_based_score: ruleBasedScore,
        ai_similarity: aiSimilarityPercent,
        hybrid_score: hybridScore,
        candidate: {
          id: String(candidate?.id ?? ""),
          full_name: String(candidate?.full_name ?? "Candidate"),
          headline: String(candidate?.headline ?? "").trim(),
          location: String(candidate?.location ?? "").trim(),
          years_experience: Number(candidate?.years_experience ?? 0),
          summary:
            String(candidate?.professional_bio_ai ?? "").trim() ||
            String(candidate?.resume_summary ?? "").trim() ||
            String(candidate?.bio ?? "").trim(),
          skills: candidateSkillNames,
        },
        matched_required_skills: matchedRequiredSkills,
        missing_required_skills: missingRequiredSkills,
        score_breakdown: application.score_breakdown ?? null,
      };
    });

    const topApplicants = [...enrichedApplicants]
      .sort((a, b) => b.hybrid_score - a.hybrid_score)
      .slice(0, 5);

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

    const prompt = `
You are an expert hiring strategist writing a recruiter-grade hiring report.
Return strict JSON only with these keys:
summary,
overall_hiring_outlook,
strengths (array of strings),
risks (array of strings),
recommendations (array of strings),
score_band,
confidence,
top_candidates (array of objects with keys: name, recommendation, hybrid_score, rule_based_score, ai_similarity, matched_required_skills, missing_required_skills, strengths, risks),
candidate_comparison (array of strings).

Focus on actual candidate-job fit, not generic pipeline commentary.
Make the recommendations specific to the named candidates and the required skills.
If data quality is limited, say so in confidence and risks.
Write strengths and risks as short executive insights, similar to:
- "Strong coverage of React and TypeScript in the shortlisted pool"
- "Risk of limited depth for cloud-native backend experience"
- "Opportunity to hire for a stable full-time role with modern tooling"
Do not write filler like "There are candidates" or "The role is live".
Prefer sharp, recruiter-usable observations about:
- demand and supply of the required skills
- candidate depth and shortlist quality
- location and work-mode alignment
- missing specialist skills
- role attractiveness based on stack, employment type, and package context

Job context:
${JSON.stringify({
      title: job.title,
      description: job.description,
      location: job.location,
      employment_type: job.employment_type,
      work_mode: (job as { work_mode?: string | null }).work_mode ?? null,
      department: (job as { department?: string | null }).department ?? null,
      experience_level: job.experience_level,
      min_years_experience: (job as { min_years_experience?: number | null }).min_years_experience ?? null,
      required_skills: requiredSkills,
      optional_skills: optionalSkills,
      pipeline: {
        total_applicants: totalApplicants,
        shortlisted: shortlisted,
        interviewed: interviewed,
        average_rule_based_score: averageScore,
      },
      top_applicants: topApplicants,
    })}
`;

    let report: Record<string, unknown> = {};
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      });

      const raw = completion.choices?.[0]?.message?.content ?? "{}";
      report = JSON.parse(raw);
    } catch {
      const stackHighlights = requiredSkills.slice(0, 3);
      const topCandidateNames = topApplicants.slice(0, 3).map((candidate) => candidate.candidate.full_name);
      const applicantsWithStrongFit = topApplicants.filter((candidate) => candidate.hybrid_score >= 75).length;
      const candidatesMissingSkills = topApplicants.filter((candidate) => candidate.missing_required_skills.length > 0).length;
      report = {
        summary:
          topApplicants.length > 0
            ? `${topApplicants[0].candidate.full_name} currently leads this pipeline for ${job.title}, with ${topApplicants[0].hybrid_score}% hybrid alignment and ${topApplicants[0].matched_required_skills.length}/${requiredSkills.length || 0} required skills matched.`
            : `No candidate comparison could be generated yet for ${job.title}.`,
        overall_hiring_outlook:
          topApplicants.length >= 3
            ? "There is enough pipeline depth to progress the strongest candidates to interviews."
            : topApplicants.length > 0
              ? "There are viable candidates, but the shortlist depth is still limited."
              : "The pipeline is too shallow to make a confident hiring decision.",
        strengths: [
          stackHighlights.length > 0
            ? `Strong relevance around ${stackHighlights.join(", ")} in the current candidate pool.`
            : "The role is attracting candidates with broadly relevant technical backgrounds.",
          applicantsWithStrongFit >= 2
            ? `${applicantsWithStrongFit} shortlisted candidates are already within a strong interview range for this role.`
            : "The role has at least one candidate with credible near-term interview potential.",
          String(job.employment_type ?? "").trim()
            ? `${String(job.employment_type)} employment makes the opportunity clearer and easier to position with candidates.`
            : "The role positioning is clear enough to attract aligned applicants.",
        ],
        risks: [
          candidatesMissingSkills > 0
            ? `${candidatesMissingSkills} of the top-ranked candidates are still missing at least one required skill.`
            : "The strongest candidates still need interview validation before final selection.",
          interviewed === 0
            ? "No interviews have been completed yet, so the current view is based on profile and match data only."
            : "Interview feedback has not yet been folded back into the final ranking.",
          requiredSkills.length > 0 && topApplicants.some((candidate) => candidate.missing_required_skills.length > 1)
            ? "Depth is thinner around some of the more specific required skills."
            : "Competition for the strongest shortlisted candidates could accelerate once outreach begins.",
        ],
        recommendations: topApplicants.length > 0
          ? topApplicants.slice(0, 3).map((candidate, index) =>
              `${index === 0 ? "Prioritize" : "Consider"} ${candidate.candidate.full_name} for the next interview stage; hybrid score ${candidate.hybrid_score}% and missing skills: ${candidate.missing_required_skills.join(", ") || "none"}.`,
            )
          : ["Broaden sourcing and review the job requirements to attract more qualified candidates."],
        score_band: toScoreBand(
          topApplicants.length > 0
            ? Math.round(topApplicants.reduce((sum, candidate) => sum + candidate.hybrid_score, 0) / topApplicants.length)
            : averageScore,
        ),
        confidence:
          requiredSkills.length > 0 && topApplicants.length > 0
            ? "Moderate"
            : "Low",
        top_candidates: topApplicants.map((candidate) => ({
          name: candidate.candidate.full_name,
          recommendation: candidate.hybrid_score >= 75 ? "Interview now" : candidate.hybrid_score >= 55 ? "Keep warm" : "Do not proceed yet",
          hybrid_score: candidate.hybrid_score,
          rule_based_score: candidate.rule_based_score,
          ai_similarity: candidate.ai_similarity,
          matched_required_skills: candidate.matched_required_skills,
          missing_required_skills: candidate.missing_required_skills,
          strengths: [
            candidate.matched_required_skills.length > 0
              ? `Matches ${candidate.matched_required_skills.length} required skill(s): ${candidate.matched_required_skills.join(", ")}.`
              : "No required skills were matched exactly.",
            candidate.candidate.years_experience > 0
              ? `${candidate.candidate.years_experience} years of recorded experience.`
              : "Years of experience are not clearly recorded.",
          ],
          risks: candidate.missing_required_skills.length > 0
            ? [`Missing required skills: ${candidate.missing_required_skills.join(", ")}.`]
            : [],
        })),
        candidate_comparison: topApplicants.length >= 2
          ? topApplicants.slice(0, 3).map((candidate, index, list) => {
              if (index === 0) {
                return `${candidate.candidate.full_name} leads on combined fit at ${candidate.hybrid_score}%, ahead of ${list[1]?.candidate.full_name ?? "the rest of the shortlist"}.`;
              }
              return `${candidate.candidate.full_name} trails the lead candidate by ${Math.max(0, list[0].hybrid_score - candidate.hybrid_score)} points and is missing ${candidate.missing_required_skills.length} required skill(s).`;
            })
          : topApplicants.length === 1
            ? [`${topApplicants[0].candidate.full_name} is the only clearly ranked candidate in the current report.`]
            : ["No candidate comparison is available yet."],
      };
    }

    await supabase.from("job_ai_reports").insert({
      job_id: jobId,
      employer_id: employer.employerId,
      report,
    });

    await supabase.from("employer_credit_usage").insert({
      employer_id: employer.employerId,
      credit_type: "ai_report",
      amount: 1,
      context_type: "job",
      context_id: jobId,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        report,
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
