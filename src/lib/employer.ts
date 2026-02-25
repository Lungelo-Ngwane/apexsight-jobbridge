import { PLAN_LIMITS } from "./plan";
import { supabase } from "./supabase";

export type BillingPlanName = "starter" | "professional" | "enterprise";

export interface BillingPlan {
  id: string;
  name: BillingPlanName;
  label: string;
  priceMonthly: number;
  jobLimit: number | null;
  userLimit: number | null;
  candidateViewLimit: number | null;
  paystackPlanCode: string | null;
}

export interface EmployerAddon {
  id: string;
  name: string;
  price: number;
  type: string;
  credits: number;
}

export interface EmployerCreditBalance {
  creditType: string;
  remaining: number;
}

export interface EmployerUsageSnapshot {
  planName: string;
  activeJobs: number;
  jobLimit: number | null;
  candidateViewsUsedThisMonth: number;
  candidateViewLimit: number | null;
}

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  kind: "subscription" | "addon";
  status: "paid" | "pending" | "failed" | "refunded" | "void";
  currency: string;
  amountKobo: number;
  vatKobo: number;
  totalKobo: number;
  issuedAt: string;
  paidAt: string | null;
  hasDownload: boolean;
}

export interface TalentPoolCandidate {
  id: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  bio: string | null;
  yearsExperience: number | null;
  cvUrl: string | null;
  skills: { skill: string; level: string | null }[];
}

export interface EmployerRecentActivityItem {
  id: string;
  action: "New applicant" | "Interview scheduled";
  detail: string;
  time: string;
  score: number;
}

export interface EmployerTalentPoolInsightItem {
  skill: string;
  count: number;
}

export interface EmployerPremiumDashboardInsights {
  recentActivity: EmployerRecentActivityItem[];
  talentPoolInsights: EmployerTalentPoolInsightItem[];
}

async function getValidAccessToken(): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const {
    data: { user: validatedUser },
    error: validateError,
  } = await supabase.auth.getUser(accessToken);

  if (validateError || !validatedUser) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    const refreshedToken = refreshed.session?.access_token;
    if (refreshError || !refreshedToken) {
      throw new Error("Session expired. Please sign in again.");
    }

    const {
      data: { user: refreshedUser },
      error: refreshedValidateError,
    } = await supabase.auth.getUser(refreshedToken);

    if (refreshedValidateError || !refreshedUser) {
      throw new Error("Session expired. Please sign in again.");
    }

    return refreshedToken;
  }

  return accessToken;
}

async function invokeAuthedFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<{ data: T | null; error: unknown | null }> {
  const firstToken = await getValidAccessToken();
  const functionsBaseUrl = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1`;
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");

  async function invokeWithToken(token: string) {
    const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body ?? {}),
    });

    const payload = await response
      .json()
      .catch(() => null) as
      | { code?: number; message?: string; error?: string; detail?: string }
      | null;

    if (response.ok) {
      return { data: (payload as T) ?? null, error: null };
    }

    const message =
      payload?.message ??
      payload?.error ??
      payload?.detail ??
      `Function ${functionName} failed with status ${response.status}`;

    return {
      data: null,
      error: {
        status: response.status,
        code: payload?.code ?? response.status,
        message,
        detail: payload?.detail ?? payload?.error ?? null,
      },
    };
  }

  let { data, error } = await invokeWithToken(firstToken);

  if (!error) {
    return { data, error: null };
  }

  const baseMessage = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  const parsedMessage = String(
    (error as { detail?: string | null } | null)?.detail ?? "",
  ).toLowerCase();
  const parsedCode = Number((error as { code?: number } | null)?.code ?? NaN);
  const invalidJwt =
    parsedCode === 401 ||
    baseMessage.includes("invalid jwt") ||
    parsedMessage.includes("invalid jwt");

  if (!invalidJwt) {
    return { data: null, error };
  }

  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession();
  const retryToken = refreshed.session?.access_token;

  if (refreshError || !retryToken) {
    return { data: null, error };
  }

  ({ data, error } = await invokeWithToken(retryToken));

  return { data, error };
}

function toPlanLabel(planName: BillingPlanName): string {
  return `${planName.charAt(0).toUpperCase()}${planName.slice(1)}`;
}

function toPlanSlug(value: unknown): BillingPlanName | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (normalized.includes("starter")) return "starter";
  if (normalized.includes("professional")) return "professional";
  if (normalized.includes("enterprise")) return "enterprise";

  return null;
}

/* =========================
   CREATE JOB
========================= */
export async function createJob(data: {
  title: string;
  description: string;
  location?: string;
  employment_type?: string;
  status: string;
  experience_level: string;
  skills?: { skill_id: string; is_required: boolean }[];
}) {
  // 1️⃣ Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  // 2️⃣ Get employer profile (id + plan)
  const { data: employer, error: employerError } = await supabase
    .from("employer_profiles")
    .select("id, plan")
    .eq("user_id", user.id)
    .single();

  if (employerError || !employer) {
    throw new Error("Employer profile not found");
  }

  // 3) Insert the job
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      employer_id: employer.id,
      title: data.title,
      description: data.description,
      location: data.location || null,
      employment_type: data.employment_type || null,
      status: data.status,
      experience_level: data.experience_level,
    })
    .select()
    .single();

  if (jobError || !job) {
    const message = String(jobError?.message ?? "").toUpperCase();
    const details = String((jobError as { details?: string } | null)?.details ?? "").toUpperCase();
    if (message.includes("PLAN_LIMIT_REACHED") || details.includes("PLAN_LIMIT_REACHED")) {
      throw new Error("PLAN_LIMIT_REACHED");
    }
    throw jobError || new Error("Failed to create job");
  }

  // 4) Insert job skills
  if (data.skills && data.skills.length > 0) {
    const { error: skillsError } = await supabase.from("job_skills").insert(
      data.skills.map((s) => ({
        job_id: job.id,
        skill_id: s.skill_id,
        required: s.is_required,
        min_score: null,
      })),
    );

    if (skillsError) throw skillsError;
  }

  // 5) Ensure new jobs get embeddings without charging AI credits.
  await supabase.functions
    .invoke("generate-job-embedding", {
      body: { job_id: job.id, skip_credit: true },
    })
    .catch((error) => {
      console.warn("Failed to auto-generate job embedding", error);
    });

  return job;
}

/* =========================
   GET EMPLOYER JOBS
========================= */
export async function getEmployerJobs() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: employer } = await supabase
    .from("employer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!employer) throw new Error("Employer profile not found");

  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      id,
      title,
      status,
      location,
      description,
      employment_type,
      experience_level,
      is_featured,
      featured_until,
      created_at,
      job_applications ( id, status )
    `,
    )
    .eq("employer_id", employer.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateJob(
  jobId: string,
  data: {
    title: string;
    description: string;
    location?: string;
    employment_type?: string;
    status: "open" | "closed" | "archived";
    experience_level: string;
  },
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  const { data: employer, error: employerError } = await supabase
    .from("employer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (employerError || !employer) {
    throw new Error("Employer profile not found");
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      title: data.title,
      description: data.description,
      location: data.location || null,
      employment_type: data.employment_type || null,
      status: data.status,
      experience_level: data.experience_level,
    })
    .eq("id", jobId)
    .eq("employer_id", employer.id);

  if (error) {
    const message = String(error?.message ?? "").toUpperCase();
    const details = String((error as { details?: string } | null)?.details ?? "").toUpperCase();
    if (message.includes("PLAN_LIMIT_REACHED") || details.includes("PLAN_LIMIT_REACHED")) {
      throw new Error("PLAN_LIMIT_REACHED");
    }
    throw error;
  }
}

/* =========================
   EMPLOYER OPEN NUMBER OF JOBS
========================= */

// export async function getEmployerOpenJobs() {
//   // Get current user
//   const {
//     data: { user },
//     error: userError
//   } = await supabase.auth.getUser();

//   if (userError || !user) throw new Error("User not authenticated");

//   // Fetch jobs for this employer
//   const { data: jobs, error } = await supabase
//     .from('jobs')
//     .select('*')
//     .eq('employer_id', user.id) // only jobs for this employer
//     .order('created_at', { ascending: false });

//   if (error) throw error;

//   // Count open jobs
//   const openJobs = jobs.filter((job) => job.status === 'open');
//   const totalJobs = jobs.length;

//   return {
//     jobs,           // all jobs
//     openJobsCount: openJobs.length, // number of open jobs
//     totalJobs       // total jobs
//   };
// }

/* =========================
   UPDATE JOB STATUS
========================= */
export async function updateJobStatus(
  jobId: string,
  status: "open" | "closed" | "archived",
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: employer } = await supabase
    .from("employer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId)
    .eq("employer_id", employer?.id);

  if (error) {
    const message = String(error?.message ?? "").toUpperCase();
    const details = String((error as { details?: string } | null)?.details ?? "").toUpperCase();
    if (message.includes("PLAN_LIMIT_REACHED") || details.includes("PLAN_LIMIT_REACHED")) {
      throw new Error("PLAN_LIMIT_REACHED");
    }
    throw error;
  }
}

/* =========================
   GET JOB APPLICANTS
========================= */
export async function getJobApplicants(jobId: string) {
  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      status,
      score,
      created_at,
      candidate:candidate_profiles (
        id,
        full_name,
        headline,
        location,
        years_experience,
        bio,
        candidate_skills (
          skills ( name ),
          level
        )
      )
    `,
    )
    .eq("job_id", jobId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* =========================
   UPDATE APPLICATION STATUS
========================= */
export async function updateApplicationStatus(
  applicationId: string,
  status: "shortlisted" | "interview" | "rejected" | "hired",
) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { error } = await supabase
    .from("job_applications")
    .update({ status })
    .eq("id", applicationId);

  if (error) throw error;
  if (status === "shortlisted") {
    const { error: invokeError } = await supabase.functions.invoke(
      "send-notification-email",
      {
        body: {
          type: "CANDIDATE_SHORTLISTED",
          data: {
            applicationId,
          },
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (invokeError) throw invokeError;
  }
}

/* =========================
   EMPLOYER ANALYTICS
========================= */

export async function getEmployerAnalytics() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: employer } = await supabase
    .from("employer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!employer) throw new Error("Employer profile not found");

  // Active jobs
  const { count: activeJobs } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("employer_id", employer.id)
    .eq("status", "open");

  // Total applicants
  const { count: totalApplicants } = await supabase
    .from("job_applications")
    .select("id, jobs!inner(employer_id)", { count: "exact", head: true })
    .eq("jobs.employer_id", employer.id);

  // Shortlisted
  const { count: shortlisted } = await supabase
    .from("job_applications")
    .select("id, jobs!inner(employer_id)", { count: "exact", head: true })
    .eq("jobs.employer_id", employer.id)
    .eq("status", "shortlisted");

  return {
    activeJobs: activeJobs ?? 0,
    totalApplicants: totalApplicants ?? 0,
    shortlisted: shortlisted ?? 0,
    avgTimeToHire: 0,
  };
}

/* =========================
   Candidate Deep View
========================= */

export async function getCandidateDeepView(applicationId: string) {
  let canRunPaidAutoMatch = true;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const { data: employer } = await supabase
        .from("employer_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (employer?.id) {
        const { data: aiCredit } = await supabase
          .from("employer_credits")
          .select("remaining")
          .eq("employer_id", employer.id)
          .eq("credit_type", "ai_credit")
          .maybeSingle();

        canRunPaidAutoMatch = Number(aiCredit?.remaining ?? 0) > 0;
      }
    }
  } catch {
    canRunPaidAutoMatch = false;
  }

  function toEmbeddingArray(value: unknown): number[] | null {
    if (!value) return null;
    if (Array.isArray(value)) {
      const numbers = value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
      return numbers.length > 0 ? numbers : null;
    }
    if (typeof value === "string") {
      const cleaned = value.replace(/^\[/, "").replace(/\]$/, "");
      const numbers = cleaned
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v));
      return numbers.length > 0 ? numbers : null;
    }
    return null;
  }

  function cosineSimilarity(a: number[], b: number[]): number | null {
    const len = Math.min(a.length, b.length);
    if (len === 0) return null;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i += 1) {
      const va = a[i];
      const vb = b[i];
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    if (normA === 0 || normB === 0) return null;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      job_id,
      status,
      score,
      score_breakdown,
      match_label,
      hiring_recommendation,
      rank,
      created_at,
      candidate_profiles (
        id,
        full_name,
        location,
        bio,
        years_experience,
        headline,
        cv_url,
        embedding,
        candidate_skills (
          skill,
          level
        )
      ),
      jobs (
        embedding
      )
    `,
    )
    .eq("id", applicationId)
    .single();

  if (error) throw error;

  const candidateId = (data as { candidate_profiles?: { id?: string } | null })?.candidate_profiles?.id;
  const jobId = (data as { job_id?: string | null })?.job_id;

  let aiSimilarityPercent: number | null = null;
  if (jobId && candidateId) {
    let { data: matchRow } = await supabase
      .from("job_matches")
      .select("similarity")
      .eq("job_id", jobId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    let similarityRaw = Number(
      (matchRow as { similarity?: number | null } | null)?.similarity ?? NaN,
    );

    // If missing, trigger one-time AI match for this job when profile is opened.
    if (!Number.isFinite(similarityRaw) && canRunPaidAutoMatch) {
      await invokeAuthedFunction("auto-match", { job_id: jobId }).catch(() => null);

      const { data: refreshedMatchRow } = await supabase
        .from("job_matches")
        .select("similarity")
        .eq("job_id", jobId)
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false })
        .maybeSingle();

      matchRow = refreshedMatchRow;
      similarityRaw = Number(
        (matchRow as { similarity?: number | null } | null)?.similarity ?? NaN,
      );
    }

    if (Number.isFinite(similarityRaw)) {
      aiSimilarityPercent = Math.max(0, Math.min(100, Math.round(similarityRaw * 100)));
    } else {
      const jobEmbedding = toEmbeddingArray(
        (data as { jobs?: { embedding?: unknown } | null })?.jobs?.embedding,
      );
      let candidateEmbedding = toEmbeddingArray(
        (data as { candidate_profiles?: { embedding?: unknown } | null })?.candidate_profiles?.embedding,
      );

      // If candidate embedding is missing, generate it on-demand for the owner.
      if (!candidateEmbedding && candidateId) {
        await invokeAuthedFunction("generate-embedding", {
          profile_id: candidateId,
        }).catch(() => null);

        const { data: candidateRow } = await supabase
          .from("candidate_profiles")
          .select("embedding")
          .eq("id", candidateId)
          .maybeSingle();

        candidateEmbedding = toEmbeddingArray(
          (candidateRow as { embedding?: unknown } | null)?.embedding,
        );
      }

      if (jobEmbedding && candidateEmbedding) {
        const fallbackSimilarity = cosineSimilarity(jobEmbedding, candidateEmbedding);
        if (fallbackSimilarity !== null) {
          aiSimilarityPercent = Math.max(
            0,
            Math.min(100, Math.round(fallbackSimilarity * 100)),
          );
        }
      }
    }
  }

  const applicationScore = Number((data as { score?: number | null })?.score ?? NaN);
  const hybridScore =
    aiSimilarityPercent === null || !Number.isFinite(applicationScore)
      ? null
      : Math.max(
          0,
          Math.min(100, Math.round((applicationScore * 0.7) + (aiSimilarityPercent * 0.3))),
        );

  return {
    ...data,
    ai_similarity: aiSimilarityPercent,
    hybrid_score: hybridScore,
  };
}

export async function getEmployerPremiumDashboardInsights(): Promise<EmployerPremiumDashboardInsights> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: employer, error: employerError } = await supabase
    .from("employer_profiles")
    .select("id, plan")
    .eq("user_id", user.id)
    .single();

  if (employerError || !employer?.id) {
    throw new Error("Employer profile not found");
  }

  const plan = String(employer.plan ?? "free").toLowerCase();
  const hasPremiumAccess = plan !== "free";

  if (!hasPremiumAccess) {
    throw new Error("PREMIUM_REQUIRED");
  }

  const { data: applications, error: applicationsError } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      status,
      score,
      created_at,
      candidate:candidate_profiles (
        full_name
      ),
      jobs!inner (
        title,
        employer_id
      )
    `,
    )
    .eq("jobs.employer_id", employer.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (applicationsError) throw applicationsError;

  const recentActivity = (applications ?? [])
    .filter((row) => row.status === "interview" || row.status === "applied")
    .slice(0, 3)
    .map((row) => {
      const scoreValue = Number(row.score ?? 0);
      const score = Number.isFinite(scoreValue)
        ? Math.max(0, Math.min(100, Math.round(scoreValue)))
        : 0;
      const createdAt = String(row.created_at ?? new Date().toISOString());
      const candidateName = String(
        (row.candidate as { full_name?: string | null } | null)?.full_name ?? "A candidate",
      );
      const jobTitle = String(
        (row.jobs as { title?: string | null } | null)?.title ?? "a role",
      );
      const action = row.status === "interview" ? "Interview scheduled" : "New applicant";
      const detail =
        row.status === "interview"
          ? `${candidateName} - ${jobTitle}`
          : `${candidateName} applied for ${jobTitle}`;

      return {
        id: String(row.id),
        action,
        detail,
        time: createdAt,
        score,
      } satisfies EmployerRecentActivityItem;
    });

  const { data: candidateSkills, error: skillsError } = await supabase
    .from("candidate_skills")
    .select("skill");

  if (skillsError) throw skillsError;

  const skillCounts = new Map<string, number>();
  for (const row of candidateSkills ?? []) {
    const rawSkill = String(row.skill ?? "").trim();
    if (!rawSkill) continue;
    skillCounts.set(rawSkill, (skillCounts.get(rawSkill) ?? 0) + 1);
  }

  const talentPoolInsights = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([skill, count]) => ({ skill, count }));

  return {
    recentActivity,
    talentPoolInsights,
  };
}

export async function getCandidateProfile(applicationId: string) {
  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      status,
      score,
      candidate:candidate_profiles (
        id,
        full_name,
        headline,
        bio,
        location,
        years_experience,
        candidate_skills ( skill, level ),
        candidate_resumes ( file_path )
      ),
      candidate_activities (
        type,
        description,
        created_at
      )
    `,
    )
    .eq("id", applicationId)
    .single();

  if (error) throw error;
  return data;
}

export async function getCandidateCV(cvPath: string) {
  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(cvPath, 60 * 10); // 10 minutes

  if (error) throw error;
  return data.signedUrl;
}

export async function getAllSkills() {
  const { data, error } = await supabase
    .from("skills")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return data;
}

export async function getTalentPoolCandidates(): Promise<TalentPoolCandidate[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select(
      `
      id,
      full_name,
      headline,
      location,
      bio,
      years_experience,
      cv_url,
      candidate_skills (
        skill,
        level
      )
    `,
    );

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name ?? "Unknown Candidate"),
    headline: row.headline ?? null,
    location: row.location ?? null,
    bio: row.bio ?? null,
    yearsExperience:
      row.years_experience === null || row.years_experience === undefined
        ? null
        : Number(row.years_experience),
    cvUrl: row.cv_url ?? null,
    skills: Array.isArray(row.candidate_skills)
      ? row.candidate_skills.map((skillRow) => ({
          skill: String(skillRow.skill ?? ""),
          level: skillRow.level ?? null,
        }))
      : [],
  }));
}

export async function getRankedCandidates(jobId: string) {
  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
    id,
    status,
    score,
    score_breakdown,
    created_at,
    candidate:candidate_profiles (
      id,
      full_name,
      headline,
      years_experience
    )
  `,
    )
    .eq("job_id", jobId)
    .order("score", { ascending: false });
}

export async function startSubscriptionCheckout(
  planName: BillingPlanName,
  planId?: string,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  const { data: employer, error: employerError } = await supabase
    .from("employer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (employerError || !employer?.id) {
    throw new Error("Employer profile not found");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke(
    "initialize-subscription",
    {
      body: {
        employerId: employer.id,
        planId,
        planName: toPlanLabel(planName),
        email: user.email,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    const message =
      parsed?.error ??
      parsed?.detail ??
      error.message ??
      "Failed to start checkout.";

    throw new Error(message);
  }

  const checkoutUrl = data?.authorization_url ?? data?.authorizationUrl ?? null;

  if (!checkoutUrl) {
    throw new Error("Failed to start checkout.");
  }

  window.location.assign(checkoutUrl);
}

export async function getActivePlans(): Promise<BillingPlan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select(
      "id, name, price_monthly, job_limit, user_limit, candidate_view_limit, paystack_plan_code, active",
    )
    .eq("active", true)
    .order("price_monthly", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const normalized = toPlanSlug(row.name);
      if (!normalized) return null;

      return {
        id: row.id,
        name: normalized,
        label: row.name,
        priceMonthly: Number(row.price_monthly ?? 0),
        jobLimit: row.job_limit ?? null,
        userLimit: row.user_limit ?? null,
        candidateViewLimit: row.candidate_view_limit ?? null,
        paystackPlanCode: row.paystack_plan_code ?? null,
      };
    })
    .filter((plan): plan is BillingPlan => plan !== null);
}

export async function getBillingInvoices(limit = 20): Promise<BillingInvoice[]> {
  const { data, error } = await supabase
    .from("billing_invoices")
    .select(
      "id, invoice_number, kind, status, currency, amount_kobo, vat_kobo, total_kobo, issued_at, paid_at, storage_path",
    )
    .order("issued_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    invoiceNumber: String(row.invoice_number ?? ""),
    kind: (String(row.kind ?? "subscription") as BillingInvoice["kind"]),
    status: (String(row.status ?? "pending") as BillingInvoice["status"]),
    currency: String(row.currency ?? "ZAR"),
    amountKobo: Number(row.amount_kobo ?? 0),
    vatKobo: Number(row.vat_kobo ?? 0),
    totalKobo: Number(row.total_kobo ?? 0),
    issuedAt: String(row.issued_at ?? ""),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    hasDownload: Boolean(row.storage_path),
  }));
}

export async function getBillingInvoiceDownloadUrl(invoiceId: string): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke("get-invoice-download-url", {
    body: { invoiceId },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    throw new Error(parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to get invoice download URL.");
  }

  const url = String(data?.url ?? "").trim();
  if (!url) throw new Error("Invoice download URL is unavailable.");
  return url;
}

export async function confirmSubscriptionCheckout(reference: string) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke(
    "confirm-subscription",
    {
      body: { reference },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: {
              json: () => Promise<{
                error?: string;
                detail?: string;
                code?: string;
              }>;
            };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    const message =
      parsed?.error ??
      parsed?.detail ??
      error.message ??
      "Failed to confirm subscription.";

    const withCode = parsed?.code
      ? `${message} (code: ${parsed.code})`
      : message;

    throw new Error(withCode);
  }

  return data;
}

export async function cancelSubscription() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke(
    "cancel-subscription",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: {
              json: () => Promise<{
                error?: string;
                detail?: string;
                code?: string;
              }>;
            };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    const message =
      parsed?.error ??
      parsed?.detail ??
      error.message ??
      "Failed to cancel subscription.";

    const withCode = parsed?.code
      ? `${message} (code: ${parsed.code})`
      : message;
    throw new Error(withCode);
  }

  return data;
}

export async function getAddons(): Promise<EmployerAddon[]> {
  const { data, error } = await supabase
    .from("addons")
    .select("id, name, price, type, credits")
    .order("price", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: String(row.name ?? ""),
    price: Number(row.price ?? 0),
    type: String(row.type ?? ""),
    credits: Number(row.credits ?? 0),
  }));
}

export async function getEmployerCredits(): Promise<EmployerCreditBalance[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Not authenticated");

  const { data: employer, error: employerError } = await supabase
    .from("employer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (employerError || !employer?.id) {
    throw new Error("Employer profile not found");
  }

  const { data, error } = await supabase
    .from("employer_credits")
    .select("credit_type, remaining")
    .eq("employer_id", employer.id);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    creditType: String(row.credit_type ?? ""),
    remaining: Number(row.remaining ?? 0),
  }));
}

export async function startAddonCheckout(addonId: string) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke("buy-addon", {
    body: { addonId },
  });

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    const message = parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to start add-on checkout.";
    if (String(message).toLowerCase().includes("invalid jwt")) {
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(message);
  }

  const checkoutUrl = data?.authorization_url ?? data?.authorizationUrl ?? null;
  if (!checkoutUrl) throw new Error("Failed to start add-on checkout.");

  window.location.assign(checkoutUrl);
}

export async function confirmAddonCheckout(reference: string) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke("confirm-addon", {
    body: { reference },
  });

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    const message = parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to confirm add-on checkout.";
    if (String(message).toLowerCase().includes("invalid jwt")) {
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(message);
  }

  return data;
}

export async function consumeEmployerCredit(creditType: string, amount = 1) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke("consume-credit", {
    body: { creditType, amount },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    throw new Error(parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to consume credits.");
  }

  return data;
}

export async function consumeCandidateViewAccess(applicationId: string) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke("authorize-candidate-view", {
    body: { applicationId },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    throw new Error(parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to authorize candidate view.");
  }

  return data;
}

export async function getEmployerUsageSnapshot(): Promise<EmployerUsageSnapshot> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Not authenticated");

  const { data: employer, error: employerError } = await supabase
    .from("employer_profiles")
    .select("id, plan")
    .eq("user_id", user.id)
    .single();

  if (employerError || !employer?.id) {
    throw new Error("Employer profile not found");
  }

  const normalizedPlan = String(employer.plan ?? "free").toLowerCase();
  const fallbackCandidateViewLimits: Record<string, number | null> = {
    free: 10,
    starter: 50,
    professional: 300,
    enterprise: 9999,
  };

  const { data: planRow } = await supabase
    .from("plans")
    .select("name, job_limit, candidate_view_limit")
    .ilike("name", normalizedPlan)
    .maybeSingle();

  const { count: activeJobs, error: activeJobsError } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("employer_id", employer.id)
    .eq("status", "open");

  if (activeJobsError) throw activeJobsError;

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data: viewsRows, error: viewsError } = await supabase
    .from("employer_credit_usage")
    .select("context_id, amount")
    .eq("employer_id", employer.id)
    .eq("context_type", "candidate_profile_view")
    .gte("created_at", startOfMonth.toISOString());

  if (viewsError) throw viewsError;

  const viewedApplicationIds = new Set<string>();
  let fallbackAmount = 0;
  for (const row of viewsRows ?? []) {
    const contextId = String((row as { context_id?: string | null }).context_id ?? "").trim();
    if (contextId) {
      viewedApplicationIds.add(contextId);
      continue;
    }
    fallbackAmount += Number((row as { amount?: number | null }).amount ?? 0);
  }
  const usedViewsThisMonth = viewedApplicationIds.size + fallbackAmount;

  return {
    planName: String(planRow?.name ?? normalizedPlan),
    activeJobs: Number(activeJobs ?? 0),
    jobLimit:
      planRow && planRow.job_limit === null
        ? null
        : (planRow?.job_limit ?? PLAN_LIMITS[normalizedPlan as keyof typeof PLAN_LIMITS]?.maxActiveJobs ?? null),
    candidateViewsUsedThisMonth: usedViewsThisMonth,
    candidateViewLimit:
      planRow && planRow.candidate_view_limit === null
        ? null
        : (planRow?.candidate_view_limit ?? fallbackCandidateViewLimits[normalizedPlan] ?? 0),
  };
}

export async function featureJob(jobId: string, days = 7) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke("feature-job", {
    body: { jobId, days },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    throw new Error(parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to feature job.");
  }

  return data;
}

export async function generateAiReport(jobId: string) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    accessToken = refreshed.session?.access_token;

    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke("generate-ai-report", {
    body: { jobId },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    throw new Error(parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to generate AI report.");
  }

  return data;
}

export async function runAutoMatch(jobId: string) {
  const { data, error } = await invokeAuthedFunction("auto-match", {
    job_id: jobId,
  });

  if (error) {
    const message =
      (error as { message?: string } | null)?.message ??
      (error as { detail?: string | null } | null)?.detail ??
      "Failed to run AI match.";
    if (String(message).toLowerCase().includes("invalid jwt")) {
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(message);
  }

  return data;
}

export async function updateEmployerProfile(payload: {
  company_name?: string;
  industry?: string | null;
  company_size?: string | null;
  description?: string | null;
  website?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  show_on_platform?: boolean;
  public_company_page?: boolean;
  onboarding_step?: number;
  plan?: string;
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("employer_profiles")
    .update(payload)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to update employer profile", error);
    throw error;
  }
}
