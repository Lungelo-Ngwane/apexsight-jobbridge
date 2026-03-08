import { supabase } from "./supabase";

const CANDIDATE_SAVED_JOBS_KEY_PREFIX = "candidate_saved_jobs_";
const ENFORCE_JOB_EXPIRY =
  String(import.meta.env.VITE_ENFORCE_JOB_EXPIRY ?? "false").toLowerCase() === "true";

function getSavedJobsStorageKey(userId: string) {
  return `${CANDIDATE_SAVED_JOBS_KEY_PREFIX}${userId}`;
}

function parseSavedJobIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((value) => String(value)).filter(Boolean)));
  } catch {
    return [];
  }
}

async function resolveCurrentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
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
  if (!error) return { data, error: null };

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

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const retryToken = refreshed.session?.access_token;

  if (refreshError || !retryToken) {
    return { data: null, error };
  }

  ({ data, error } = await invokeWithToken(retryToken));
  return { data, error };
}

export async function refreshCandidateMatchingProfile(profileId?: string) {
  if (!profileId) {
    throw new Error("Missing profile id for matching refresh.");
  }
  const analyzeResult = await invokeAuthedFunction<{
    success?: boolean;
    inserted_skills?: number;
    extracted_skills?: number;
  }>("analyze-candidate-profile", {
    profile_id: profileId,
  });

  if (analyzeResult.error) {
    const message =
      (analyzeResult.error as { message?: string } | null)?.message ??
      (analyzeResult.error as { detail?: string | null } | null)?.detail ??
      "Failed to analyze candidate profile.";
    throw new Error(String(message));
  }

  const embeddingResult = await invokeAuthedFunction("generate-embedding", {
    profile_id: profileId,
  });

  if (embeddingResult.error) {
    const message =
      (embeddingResult.error as { message?: string } | null)?.message ??
      (embeddingResult.error as { detail?: string | null } | null)?.detail ??
      "Failed to generate candidate embedding.";
    throw new Error(String(message));
  }

  return analyzeResult.data;
}

export async function getCandidateDashboardData() {
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select(
      `
      id,
      full_name,
      surname,
      headline,
      bio,
      location,
      years_experience,
      date_of_birth,
      id_number,
      gender,
      contact_number,
      cv_url,
      resume_analysis,
      resume_last_analyzed_at,
      candidate_skills (
        skill,
        level
      ),
      candidate_assessments (
        name,
        progress,
        status
      ),
      candidate_certifications (
        name,
        issuer,
        issued_at
      )
    `,
    )
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  if (error) throw error;
  return data;
}

export async function addCandidateSkill(
  skill: string,
  level: "beginner" | "intermediate" | "advanced",
) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  // 1️⃣ Try get candidate profile
  let { data: profile, error } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  // 2️⃣ If not found → create it
  if (!profile) {
    const { data: newProfile, error: createError } = await supabase
      .from("candidate_profiles")
      .insert({
        user_id: user.id,
        full_name: user.user_metadata.full_name,
      })
      .select("id")
      .single();

    if (createError) throw createError;

    profile = newProfile;
  }

  // 3️⃣ Insert skill
  const { error: skillError } = await supabase.from("candidate_skills").insert({
    candidate_profile_id: profile.id,
    skill,
    level,
  });

  if (skillError) throw skillError;

  try {
    await refreshCandidateMatchingProfile(String(profile.id));
  } catch (error) {
    console.error("Failed to refresh candidate matching profile", error);
  }
}

export async function uploadCandidateCV(file: File) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const ext = file.name.split(".").pop();
  const filePath = `${user.id}/cv.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("resume")
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  let { data: updatedProfile, error: updateError } = await supabase
    .from("candidate_profiles")
    .update({ cv_url: filePath })
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;

  if (!updatedProfile?.id) {
    const { data: createdProfile, error: createProfileError } = await supabase
      .from("candidate_profiles")
      .insert({
        user_id: user.id,
        full_name: String(user.user_metadata?.full_name ?? user.email ?? "Candidate"),
        cv_url: filePath,
      })
      .select("id")
      .single();

    if (createProfileError) throw createProfileError;
    updatedProfile = createdProfile;
  }

  if (updatedProfile?.id) {
    try {
      await refreshCandidateMatchingProfile(String(updatedProfile.id));
    } catch (error) {
      console.error("Failed to refresh candidate matching profile after CV upload", error);
    }
  }

  return filePath;
}

export async function getOpenJobs() {
  const withVisibility = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      description,
      location,
      employment_type,
      experience_level,
      is_featured,
      featured_until,
      expires_at,
      created_at,
      employer_id
    `)
    .eq("status", "open")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  let jobs = withVisibility.data as any[] | null;
  let jobsError = withVisibility.error;

  if (jobsError) {
    const visibilityError = String(jobsError.message ?? "").toLowerCase();
    if (!visibilityError.includes("expires_at")) {
      throw jobsError;
    }

    const legacy = await supabase
      .from("jobs")
      .select(`
        id,
        title,
        description,
        location,
        employment_type,
        experience_level,
        is_featured,
        featured_until,
        created_at,
        employer_id
      `)
      .eq("status", "open")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    jobs = legacy.data as any[] | null;
    jobsError = legacy.error;
  }

  if (jobsError) throw jobsError;
  if (!jobs || jobs.length === 0) return [];

  let visibleJobs = jobs;
  if (ENFORCE_JOB_EXPIRY) {
    const now = Date.now();
    visibleJobs = jobs.filter((job) => {
      const raw = String((job as { expires_at?: unknown }).expires_at ?? "").trim();
      if (!raw) return true;
      const expiresMs = new Date(raw).getTime();
      if (!Number.isFinite(expiresMs)) return true;
      return expiresMs > now;
    });
  }

  if (visibleJobs.length === 0) return [];
  return attachEmployerDetailsToJobs(visibleJobs);
}

async function attachEmployerDetailsToJobs(jobs: any[]) {
  if (!jobs || jobs.length === 0) return [];

  const employerIds = [...new Set(jobs.map((job) => String(job.employer_id)))];

  const { data: employers, error: empError } = await supabase
    .from("employer_profiles")
    .select("id, company_name, industry, logo_url")
    .in("id", employerIds);
  if (empError) {
    // Do not block job listing when employer metadata is restricted by RLS.
    return jobs.map((job) => ({
      ...job,
      employer: {
        company_name: "Company",
        industry: null,
        logo_url: null,
      },
    }));
  }

  const resolveLogoUrl = (value: unknown): string | null => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;

    const normalizedPath = raw.replace(/^\/+/, "");
    const { data } = supabase.storage.from("employer-logos").getPublicUrl(normalizedPath);
    return String(data?.publicUrl ?? "").trim() || null;
  };

  const employerMap = (employers || []).reduce((acc, emp) => {
    acc[String(emp.id)] = {
      company_name: emp.company_name,
      industry: emp.industry ?? null,
      logo_url: resolveLogoUrl(emp.logo_url),
    };
    return acc;
  }, {} as Record<string, { company_name: string; industry: string | null; logo_url: string | null }>);

  return jobs.map((job) => ({
    ...job,
    employer: {
      company_name: employerMap[String(job.employer_id)]?.company_name || "Unknown Company",
      industry: employerMap[String(job.employer_id)]?.industry || null,
      logo_url: employerMap[String(job.employer_id)]?.logo_url || null,
    }
  }));
}

export async function getJobsByIds(jobIds: string[]) {
  const normalizedJobIds = Array.from(new Set((jobIds ?? []).map((id) => String(id)).filter(Boolean)));
  if (normalizedJobIds.length === 0) return [];

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      description,
      location,
      employment_type,
      experience_level,
      is_featured,
      featured_until,
      created_at,
      employer_id,
      status
    `)
    .in("id", normalizedJobIds)
    .order("created_at", { ascending: false });

  if (jobsError) throw jobsError;
  if (!jobs || jobs.length === 0) return [];
  return attachEmployerDetailsToJobs(jobs);
}

export async function getCandidateSavedJobIds() {
  const userId = await resolveCurrentUserId();
  if (!userId || typeof window === "undefined") return [];
  return parseSavedJobIds(window.localStorage.getItem(getSavedJobsStorageKey(userId)));
}

export async function setCandidateSavedJobIds(jobIds: string[]) {
  const userId = await resolveCurrentUserId();
  if (!userId || typeof window === "undefined") return [];
  const normalizedJobIds = Array.from(new Set((jobIds ?? []).map((id) => String(id)).filter(Boolean)));
  window.localStorage.setItem(getSavedJobsStorageKey(userId), JSON.stringify(normalizedJobIds));
  return normalizedJobIds;
}

export async function toggleCandidateSavedJob(jobId: string) {
  const normalizedId = String(jobId ?? "").trim();
  if (!normalizedId) return [];
  const current = await getCandidateSavedJobIds();
  const next = current.includes(normalizedId)
    ? current.filter((id) => id !== normalizedId)
    : [...current, normalizedId];
  return setCandidateSavedJobIds(next);
}



export async function applyForJob(jobId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) throw new Error("Candidate profile not found");

  try {
    await refreshCandidateMatchingProfile(String(profile.id));
  } catch (error) {
    console.error("Failed to refresh candidate matching profile before applying", error);
  }

  // Prevent duplicate
  const { data: existing } = await supabase
    .from("job_applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("candidate_profile_id", profile.id)
    .maybeSingle();

  if (existing) throw new Error("Already applied");

  // 🔥 Calculate match score
  const { data: matchScore, error: scoreError } = await supabase.rpc(
    "calculate_skill_match",
    {
      p_job_id: jobId,
      p_candidate_profile_id: profile.id,
    },
  );

  if (scoreError) throw scoreError;

  const { data: application, error } = await supabase
    .from("job_applications")
    .insert({
      job_id: jobId,
      candidate_profile_id: profile.id,
      status: "applied",
      score: matchScore,
    })
    .select("id")
    .single();

  if (error) throw error;

  if (application?.id) {
    const { error: notifyError } = await invokeAuthedFunction("send-notification-email", {
      type: "APPLICATION_CREATED",
      data: {
        applicationId: application.id,
      },
    });

    if (notifyError) {
      console.warn("Application created but notification email dispatch failed", notifyError);
    }
  }
}

export async function getAppliedJobIds() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.id) return [] as string[];

  const { data, error } = await supabase
    .from("job_applications")
    .select("job_id")
    .eq("candidate_profile_id", profile.id);

  if (error) throw error;

  return (data ?? []).map((row) => row.job_id as string);
}

export async function updateCandidateProfile(input: {
  headline?: string;
  bio?: string;
  location?: string;
  years_experience?: number;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("candidate_profiles")
    .update(input)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  try {
    const { data: profile } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.id) {
      await refreshCandidateMatchingProfile(String(profile.id));
    }
  } catch (refreshError) {
    console.error("Failed to refresh candidate matching profile after profile update", refreshError);
  }
}
