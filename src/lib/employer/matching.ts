function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeComparable(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeComparable(value: string): string[] {
  const stopWords = new Set(["senior", "junior", "mid", "developer", "engineer", "software", "full", "time"]);
  return normalizeComparable(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

export function computeMatchIntelligence(input: {
  applicationScore: number | null;
  aiSimilarity: number | null;
  scoreBreakdown?: { required?: number; optional?: number; experience?: number; skill_level?: number } | null;
  job: {
    title?: string | null;
    location?: string | null;
    employment_type?: string | null;
    experience_level?: string | null;
    job_skills?: Array<{ required?: boolean | null; skill_id?: string | null; skills?: { name?: string | null } | null }> | null;
  };
  candidate: {
    headline?: string | null;
    location?: string | null;
    preferred_job_type?: string | null;
    resume_analysis?: {
      work_experience?: Array<{ title?: string | null }>;
      debug?: { extraction_method?: string | null };
    } | null;
    candidate_skills?: Array<{ skill_id?: string | null; skill?: string | null; skills?: { name?: string | null } | null }> | null;
    cv_url?: string | null;
  };
}) {
  const applicationScore = input.applicationScore !== null && Number.isFinite(input.applicationScore) ? input.applicationScore : null;
  const aiSimilarity = input.aiSimilarity !== null && Number.isFinite(input.aiSimilarity) ? input.aiSimilarity : null;
  const baseHybrid =
    applicationScore === null || aiSimilarity === null
      ? (applicationScore ?? aiSimilarity ?? null)
      : clampScore((applicationScore * 0.7) + (aiSimilarity * 0.3));

  const matchingConfig = {
    total_job_skills: Array.isArray(input.job.job_skills) ? input.job.job_skills.length : 0,
    required_job_skills: Array.isArray(input.job.job_skills)
      ? input.job.job_skills.filter((row) => Boolean(row.required)).length
      : 0,
    optional_job_skills: Array.isArray(input.job.job_skills)
      ? input.job.job_skills.filter((row) => !row.required).length
      : 0,
  };

  const knockoutFilters: Array<{ label: string; status: "pass" | "warning" | "fail"; detail: string }> = [];
  let penalty = 0;
  let recencyBonus = 0;
  const explanations: string[] = [];
  const normalizeSkillKey = (skill: { skill_id?: string | null; skill?: string | null; skills?: { name?: string | null } | null }) =>
    String(
      skill.skills?.name ??
      skill.skill ??
      skill.skill_id ??
      "",
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9+#]/g, "");

  const preferredJobType = normalizeComparable(String(input.candidate.preferred_job_type ?? ""));
  const jobEmploymentType = normalizeComparable(String(input.job.employment_type ?? ""));
  if (preferredJobType && jobEmploymentType) {
    if (preferredJobType === jobEmploymentType) {
      knockoutFilters.push({ label: "Job type", status: "pass", detail: "Candidate preference matches job type." });
    } else {
      knockoutFilters.push({ label: "Job type", status: "warning", detail: "Candidate usually prefers a different job type, but may still consider this role." });
    }
  }

  const candidateLocation = normalizeComparable(String(input.candidate.location ?? ""));
  const jobLocation = normalizeComparable(String(input.job.location ?? ""));
  const remoteLike = (value: string) => value.includes("remote");
  if (candidateLocation && jobLocation && !remoteLike(candidateLocation) && !remoteLike(jobLocation)) {
    const candidateTokens = new Set(tokenizeComparable(candidateLocation));
    const jobTokens = tokenizeComparable(jobLocation);
    const overlap = jobTokens.filter((token) => candidateTokens.has(token)).length;
    if (overlap > 0) {
      knockoutFilters.push({ label: "Location", status: "pass", detail: "Candidate location aligns with the job location." });
    } else {
      knockoutFilters.push({ label: "Location", status: "warning", detail: "Candidate location may not align with this job location." });
    }
  }

  const requiredScore = Number(input.scoreBreakdown?.required ?? 0);
  const experienceScore = Number(input.scoreBreakdown?.experience ?? 0);
  const requiredJobSkills = (input.job.job_skills ?? []).filter((row) => Boolean(row.required));
  const candidateSkillKeys = new Set(
    (input.candidate.candidate_skills ?? [])
      .map((row) => normalizeSkillKey(row))
      .filter((value) => value.length > 0),
  );
  const matchedRequiredSkills = requiredJobSkills.filter((row) => candidateSkillKeys.has(normalizeSkillKey(row))).length;

  if (matchingConfig.required_job_skills > 0 && requiredScore <= 0) {
    knockoutFilters.push({ label: "Required skills", status: "fail", detail: "Candidate did not match any configured required skills." });
    penalty += 20;
  } else if (matchingConfig.required_job_skills > 0) {
    explanations.push(`Matched ${matchedRequiredSkills} of ${matchingConfig.required_job_skills} required skills for this role.`);
  }

  if (normalizeComparable(String(input.job.experience_level ?? "")) && experienceScore <= 0) {
    knockoutFilters.push({ label: "Experience", status: "fail", detail: "Candidate experience level is materially below the job expectation." });
    penalty += 10;
  } else if (experienceScore > 0) {
    const experienceMessage =
      experienceScore >= 13 ? "Candidate experience is strongly aligned with the level of this role." :
      experienceScore >= 8 ? "Candidate experience is broadly aligned with the level of this role." :
      "Candidate experience shows partial alignment with the level of this role.";
    explanations.push(experienceMessage);
  }

  const recentRoleTitle = String(input.candidate.resume_analysis?.work_experience?.[0]?.title ?? "").trim();
  const comparisonPool = `${input.candidate.headline ?? ""} ${recentRoleTitle}`.trim();
  if (comparisonPool && input.job.title) {
    const candidateTokens = new Set(tokenizeComparable(comparisonPool));
    const jobTokens = tokenizeComparable(String(input.job.title));
    const overlap = jobTokens.filter((token) => candidateTokens.has(token)).length;
    if (overlap >= 2) {
      recencyBonus += 8;
      explanations.push("Recent role/title strongly aligns with the current job title.");
    } else if (overlap >= 1) {
      recencyBonus += 4;
      explanations.push("Recent role/title shows partial alignment with this job.");
    }
  }

  if (aiSimilarity !== null) {
    explanations.push(`AI similarity is ${aiSimilarity}%, based on semantic overlap between the job and candidate profile.`);
  }

  const extractionMethod = String(input.candidate.resume_analysis?.debug?.extraction_method ?? "").trim();
  let confidence = 0;
  if (aiSimilarity !== null) confidence += 25;
  if (matchingConfig.total_job_skills > 0) confidence += 25;
  if (matchingConfig.required_job_skills > 0) confidence += 15;
  if (String(input.candidate.cv_url ?? "").trim()) confidence += 15;
  if (Array.isArray(input.candidate.candidate_skills) && input.candidate.candidate_skills.length >= 5) confidence += 10;
  if (extractionMethod === "openai_pdf") confidence += 10;
  confidence -= knockoutFilters.filter((item) => item.status === "fail").length * 8;
  confidence = clampScore(confidence);

  const finalMatchScore = baseHybrid === null ? null : clampScore(baseHybrid + recencyBonus - penalty);
  const displayedMatchLevel =
    (finalMatchScore ?? 0) >= 90 ? "Elite" :
    (finalMatchScore ?? 0) >= 75 ? "Strong" :
    (finalMatchScore ?? 0) >= 60 ? "Good" :
    (finalMatchScore ?? 0) >= 40 ? "Potential" : "Weak";
  const displayedRecommendation =
    (finalMatchScore ?? 0) >= 75 ? "Interview Recommended" :
    (finalMatchScore ?? 0) >= 50 ? "Consider" : "Not Recommended";

  if (matchingConfig.total_job_skills === 0) {
    explanations.push("This job has no structured skills configured, which lowers confidence in the rule-based match.");
  }

  return {
    matchingConfig,
    knockoutFilters,
    explanations,
    confidenceScore: confidence,
    baseHybridScore: baseHybrid,
    finalMatchScore,
    displayedMatchLevel,
    displayedRecommendation,
    recencyBonus,
    penalty,
  };
}

