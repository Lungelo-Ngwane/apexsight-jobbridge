import { getPublicEmployers } from "./publicProfiles";
import { supabase } from "./supabase";

export { getCandidateSavedJobIds,setCandidateSavedJobIds,toggleCandidateSavedJob } from "./candidate/saved-jobs";
const ENFORCE_JOB_EXPIRY =
  String(import.meta.env.VITE_ENFORCE_JOB_EXPIRY ?? "false").toLowerCase() === "true";
const CANDIDATE_PROFILE_CACHE_TTL_MS = 10_000;
const CANDIDATE_DASHBOARD_CACHE_TTL_MS = 15_000;
const OPEN_JOBS_CACHE_TTL_MS = 20_000;
const APPLIED_JOB_IDS_CACHE_TTL_MS = 10_000;
const UPCOMING_INTERVIEWS_CACHE_TTL_MS = 15_000;

export interface SkillCatalogItem {
  id: string;
  name: string;
}


interface CandidateProfileContext {
  userId: string;
  profileId: string;
}

type TimedCache<T> = {
  value: T;
  expiresAt: number;
};

let candidateProfileContextCache: TimedCache<CandidateProfileContext> | null = null;
let candidateProfileContextInFlight: Promise<CandidateProfileContext> | null = null;
let candidateDashboardCache: TimedCache<any> | null = null;
let candidateDashboardInFlight: Promise<any> | null = null;
let openJobsCache: TimedCache<any[]> | null = null;
let openJobsInFlight: Promise<any[]> | null = null;
let appliedJobIdsCache: TimedCache<string[]> | null = null;
let appliedJobIdsInFlight: Promise<string[]> | null = null;
let upcomingInterviewsCache: TimedCache<CandidateUpcomingInterviewRow[]> | null = null;
let upcomingInterviewsInFlight: Promise<CandidateUpcomingInterviewRow[]> | null = null;

export interface CandidateCertificationRow {
  id?: string;
  name: string;
  issuer?: string | null;
  issued_at?: string | null;
  certificate_file_path?: string | null;
}

export interface CandidateUpcomingInterviewRow {
  id: string;
  stage: "screening" | "technical" | "final";
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  mode: "virtual" | "phone" | "onsite";
  locationOrMeetingLink: string | null;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  jobTitle: string;
  jobLocation: string | null;
  companyName: string;
}

export interface CandidateSkillRow {
  id?: string;
  skill_id?: string;
  skill: string;
  level?: string | null;
}

let cacheGeneration = 0;
export function resetCandidateCaches(): void {
  cacheGeneration += 1;
  candidateProfileContextCache = null; candidateProfileContextInFlight = null;
  invalidateCandidateProfileCaches(); invalidateCandidateApplicationCaches();
  openJobsCache = null; openJobsInFlight = null;
}

async function resolveCurrentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function ensureCurrentCandidateProfile(): Promise<string> {
  const {data,error}=await supabase.rpc('ensure_candidate_profile');
  if(error) throw error;
  if(typeof data !== 'string') throw new Error('Candidate profile unavailable');
  return data;
}
async function ensureCandidateProfile(_user: { id: string }) { return {id: await ensureCurrentCandidateProfile()}; }

async function resolveCandidateProfileContext(options?: { force?: boolean }): Promise<CandidateProfileContext> {
  const force = Boolean(options?.force);
  const currentUserId = await resolveCurrentUserId();
  if (!currentUserId) throw new Error("Not authenticated");
  if (candidateProfileContextCache && candidateProfileContextCache.value.userId !== currentUserId) resetCandidateCaches();
  const now = Date.now();

  if (!force && candidateProfileContextCache && candidateProfileContextCache.expiresAt > now) {
    return candidateProfileContextCache.value;
  }

  if (!force && candidateProfileContextInFlight) {
    return candidateProfileContextInFlight;
  }

  const generation = cacheGeneration;
  const request = (async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (sessionError || !user) {
      throw new Error("Not authenticated");
    }

    let { data: profile, error: profileError } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.id) {
      profile = await ensureCandidateProfile(user);
    }
    if (!profile?.id) throw new Error("Candidate profile not found");

    const value = {
      userId: String(user.id),
      profileId: String(profile.id),
    } satisfies CandidateProfileContext;

    if (generation === cacheGeneration) candidateProfileContextCache = {
      value,
      expiresAt: Date.now() + CANDIDATE_PROFILE_CACHE_TTL_MS,
    };

    return value;
  })();

  candidateProfileContextInFlight = request;
  return request.finally(() => {
    if (candidateProfileContextInFlight === request) {
      candidateProfileContextInFlight = null;
    }
  });
}

function invalidateCandidateProfileCaches() {
  candidateDashboardCache = null;
  candidateDashboardInFlight = null;
  upcomingInterviewsCache = null;
  upcomingInterviewsInFlight = null;
}

function invalidateCandidateApplicationCaches() {
  appliedJobIdsCache = null;
  appliedJobIdsInFlight = null;
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

export async function refreshCandidateEmbedding(profileId?: string) {
  if (!profileId) {
    throw new Error("Missing profile id for embedding refresh.");
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
}

export async function ensureCandidateWelcomeEmailSent() {
  const result = await invokeAuthedFunction<{
    success?: boolean;
    skipped?: boolean;
    message?: string;
  }>("send-notification-email", {
    type: "CANDIDATE_WELCOME",
    data: {},
  });

  if (result.error) {
    const message =
      (result.error as { message?: string } | null)?.message ??
      (result.error as { detail?: string | null } | null)?.detail ??
      "Failed to send welcome email.";
    throw new Error(String(message));
  }

  return {
    success: Boolean(result.data?.success),
    skipped: Boolean(result.data?.skipped),
    message: String(result.data?.message ?? ""),
  };
}

export async function getCandidateDashboardData() {
  const now = Date.now();
  if (candidateDashboardCache && candidateDashboardCache.expiresAt > now) {
    return candidateDashboardCache.value;
  }

  if (candidateDashboardInFlight) {
    return candidateDashboardInFlight;
  }

  const generation = cacheGeneration;
  const request = (async () => {
    const context = await resolveCandidateProfileContext();
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
        cv_file_name,
        resume_analysis,
        resume_last_analyzed_at,
        candidate_skills (
          id,
          skill_id,
          skill,
          level,
          skills (
            id,
            name,
            category
          )
        ),
        candidate_assessments (
          name,
          progress,
          status
        ),
        candidate_certifications (
          id,
          name,
          issuer,
          issued_at,
          certificate_file_path
        )
      `,
      )
      .eq("id", context.profileId)
      .single();

    if (error) throw error;

    if (generation === cacheGeneration) candidateDashboardCache = {
      value: data,
      expiresAt: Date.now() + CANDIDATE_DASHBOARD_CACHE_TTL_MS,
    };

    return data;
  })();

  candidateDashboardInFlight = request;
  return request.finally(() => {
    if (candidateDashboardInFlight === request) {
      candidateDashboardInFlight = null;
    }
  });
}

export async function getCandidateUpcomingInterviews(): Promise<CandidateUpcomingInterviewRow[]> {
  const now = Date.now();
  if (upcomingInterviewsCache && upcomingInterviewsCache.expiresAt > now) {
    return upcomingInterviewsCache.value;
  }

  if (upcomingInterviewsInFlight) {
    return upcomingInterviewsInFlight;
  }

  const generation = cacheGeneration;
  const request = (async () => {
    const context = await resolveCandidateProfileContext();
    const { data, error } = await supabase
      .from("interviews")
      .select(`
        id,
        stage,
        scheduled_at,
        duration_minutes,
        timezone,
        mode,
        location_or_meeting_link,
        notes,
        status,
        jobs (
          title,
          location
        ),
        employer_profiles (
          company_name
        )
      `)
      .eq("candidate_profile_id", context.profileId)
      .in("status", ["scheduled", "rescheduled"])
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []).map((row: any) => ({
      id: String(row.id),
      stage: row.stage,
      scheduledAt: String(row.scheduled_at),
      durationMinutes: Number(row.duration_minutes ?? 30),
      timezone: String(row.timezone ?? "Africa/Johannesburg"),
      mode: row.mode,
      locationOrMeetingLink: row.location_or_meeting_link ? String(row.location_or_meeting_link) : null,
      notes: row.notes ? String(row.notes) : null,
      status: row.status,
      jobTitle: String(row.jobs?.title ?? "Interview"),
      jobLocation: row.jobs?.location ? String(row.jobs.location) : null,
      companyName: String(row.employer_profiles?.company_name ?? "Employer"),
    }));

    if (generation === cacheGeneration) upcomingInterviewsCache = {
      value: rows,
      expiresAt: Date.now() + UPCOMING_INTERVIEWS_CACHE_TTL_MS,
    };

    return rows;
  })();

  upcomingInterviewsInFlight = request;
  return request.finally(() => {
    if (upcomingInterviewsInFlight === request) {
      upcomingInterviewsInFlight = null;
    }
  });
}

export async function addCandidateSkill(
  skillName: string,
  level: "beginner" | "intermediate" | "advanced",
) {
  const normalizedSkillName = String(skillName ?? "").trim();
  if (!normalizedSkillName) {
    throw new Error("Enter a skill name.");
  }

  return addCandidateSkillByName(normalizedSkillName, level);

  // 1ï¸âƒ£ Try get candidate profile
  /*
  let { data: profile, error } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  // 2ï¸âƒ£ If not found â†’ create it
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

  // 3ï¸âƒ£ Insert skill
  const { error: skillError } = await supabase.from("candidate_skills").insert({
    candidate_profile_id: profile.id,
    skill_id: normalizedSkillId,
    skill: normalizedSkillName,
    level,
  });

  if (skillError) throw skillError;

  void refreshCandidateEmbedding(String(profile.id)).catch((refreshError) => {
    console.error("Failed to refresh candidate embedding after adding skill", refreshError);
  });
  */
}

export async function removeCandidateSkill(candidateSkillId: string) {
  const normalizedCandidateSkillId = String(candidateSkillId ?? "").trim();
  if (!normalizedCandidateSkillId) {
    throw new Error("Missing skill id.");
  }

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile?.id) throw new Error("Candidate profile not found");

  const { error: deleteError } = await supabase
    .from("candidate_skills")
    .delete()
    .eq("id", normalizedCandidateSkillId)
    .eq("candidate_profile_id", profile.id);

  if (deleteError) throw deleteError;
  invalidateCandidateProfileCaches();

  void refreshCandidateEmbedding(String(profile.id)).catch((refreshError) => {
    console.error("Failed to refresh candidate embedding after removing skill", refreshError);
  });
}

export async function addCandidateSkillByName(
  skillName: string,
  level: "beginner" | "intermediate" | "advanced",
) {
  const normalizedSkillName = String(skillName ?? "").trim();
  if (!normalizedSkillName) {
    throw new Error("Enter a skill name.");
  }

  const { data, error } = await invokeAuthedFunction<{
    candidate_skill?: CandidateSkillRow | null;
    profile_id?: string | null;
  }>("add-candidate-skill", {
    skill_name: normalizedSkillName,
    level,
  });

  if (error) {
    const message =
      (error as { message?: string } | null)?.message ??
      (error as { detail?: string | null } | null)?.detail ??
      "Failed to add skill.";
    throw new Error(String(message));
  }

  const profileId = String(data?.profile_id ?? "").trim();
  if (profileId) {
    invalidateCandidateProfileCaches();
    void refreshCandidateEmbedding(profileId).catch((refreshError) => {
      console.error("Failed to refresh candidate embedding after adding skill", refreshError);
    });
  }

  return data?.candidate_skill ?? {
    skill: normalizedSkillName,
    level,
  };
}

export async function getSkillsCatalog() {
  const { data, error } = await supabase
    .from("skills")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(1000);

  if (error) throw error;
  return (data ?? []) as SkillCatalogItem[];
}

export async function addCandidateCertification(input: {
  name: string;
  issuer?: string;
  issuedAt?: string;
  file?: File | null;
}) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const name = String(input.name ?? "").trim();
  const issuer = String(input.issuer ?? "").trim();
  const issuedAt = String(input.issuedAt ?? "").trim();
  const file = input.file ?? null;

  if (!name) {
    throw new Error("Certification name is required.");
  }

  if (file) {
    const fileName = String(file.name ?? "").toLowerCase();
    if (!fileName.endsWith(".pdf") || file.type && file.type !== "application/pdf") {
      throw new Error("Only PDF certificates are supported.");
    }
  }

  let { data: profile, error: profileError } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.id) {
    const { data: createdProfile, error: createProfileError } = await supabase
      .from("candidate_profiles")
      .insert({
        user_id: user.id,
        full_name: String(user.user_metadata?.full_name ?? user.email ?? "Candidate").trim(),
      })
      .select("id")
      .single();

    if (createProfileError) throw createProfileError;
    profile = createdProfile;
  }

  let certificateFilePath: string | null = null;
  if (file) {
    const sanitizedBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    certificateFilePath = `${user.id}/${Date.now()}-${sanitizedBaseName}`;

    const { error: uploadError } = await supabase.storage
      .from("candidate-certifications")
      .upload(certificateFilePath, file, { upsert: false });

    if (uploadError) throw uploadError;
  }

  const { data, error } = await supabase
    .from("candidate_certifications")
    .insert({
      candidate_id: profile.id,
      name,
      issuer: issuer || null,
      issued_at: issuedAt || null,
      certificate_file_path: certificateFilePath,
    })
    .select("id, name, issuer, issued_at, certificate_file_path")
    .single();

  if (error) throw error;
  invalidateCandidateProfileCaches();

  return data as CandidateCertificationRow;
}

export async function removeCandidateCertification(certificationId: string) {
  const normalizedCertificationId = String(certificationId ?? "").trim();
  if (!normalizedCertificationId) {
    throw new Error("Missing certification id.");
  }

  const context = await resolveCandidateProfileContext();

  const { data: certification, error: certificationError } = await supabase
    .from("candidate_certifications")
    .select("id, certificate_file_path")
    .eq("id", normalizedCertificationId)
    .eq("candidate_id", context.profileId)
    .single();

  if (certificationError) throw certificationError;

  const { error: deleteError } = await supabase
    .from("candidate_certifications")
    .delete()
    .eq("id", normalizedCertificationId)
    .eq("candidate_id", context.profileId);

  if (deleteError) throw deleteError;
  invalidateCandidateProfileCaches();

  const certificateFilePath = String(certification?.certificate_file_path ?? "").trim();
  if (certificateFilePath) {
    const { error: storageDeleteError } = await supabase.storage
      .from("candidate-certifications")
      .remove([certificateFilePath]);

    if (storageDeleteError) {
      console.error("Failed to delete certification file", storageDeleteError);
    }
  }
}

export async function uploadCandidateCV(file: File) {
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf") || file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("Upload a PDF between 1 byte and 10 MB.");
  }
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== "%PDF-") throw new Error("This file is not a PDF.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const originalFileName = String(file.name ?? "").trim() || "CV";
  const ext = originalFileName.includes(".") ? originalFileName.split(".").pop() : "pdf";
  const filePath = `${user.id}/cv.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("resume")
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  let { data: updatedProfile, error: updateError } = await supabase
    .from("candidate_profiles")
    .update({ cv_url: filePath, cv_file_name: originalFileName })
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;

  if (!updatedProfile?.id) {
    const createdId = await ensureCurrentCandidateProfile();
    const {error: createProfileError} = await supabase.from('candidate_profiles').update({cv_url:filePath,cv_file_name:originalFileName}).eq('id',createdId);
    if (createProfileError) throw createProfileError;
    updatedProfile = {id:createdId};
  }

  if (updatedProfile?.id) {
    candidateProfileContextCache = {
      value: {
        userId: String(user.id),
        profileId: String(updatedProfile.id),
      },
      expiresAt: Date.now() + CANDIDATE_PROFILE_CACHE_TTL_MS,
    };
    invalidateCandidateProfileCaches();
    try {
      await refreshCandidateMatchingProfile(String(updatedProfile.id));
    } catch (error) {
      console.error("Failed to refresh candidate matching profile after CV upload", error);
    }
  }

  return {
    fileName: originalFileName,
    path: filePath,
  };
}

export async function getOpenJobs() {
  const now = Date.now();
  if (openJobsCache && openJobsCache.expiresAt > now) {
    return openJobsCache.value;
  }

  if (openJobsInFlight) {
    return openJobsInFlight;
  }

  const generation = cacheGeneration;
  const request = (async () => {
    const withVisibility = await supabase
      .from("jobs")
      .select(`
        id,
        title,
        description,
        location,
        employment_type,
        salary_min,
        salary_max,
        experience_level,
        is_featured,
        featured_until,
        created_at,
        expires_at,
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
          salary_min,
          salary_max,
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
    if (!jobs || jobs.length === 0) {
      if (generation === cacheGeneration) openJobsCache = {
        value: [],
        expiresAt: Date.now() + OPEN_JOBS_CACHE_TTL_MS,
      };
      return [];
    }

    let visibleJobs = jobs;
    if (ENFORCE_JOB_EXPIRY) {
      const currentTime = Date.now();
      visibleJobs = jobs.filter((job) => {
        const raw = String((job as { expires_at?: unknown }).expires_at ?? "").trim();
        if (!raw) return true;
        const expiresMs = new Date(raw).getTime();
        if (!Number.isFinite(expiresMs)) return true;
        return expiresMs > currentTime;
      });
    }

    if (visibleJobs.length === 0) {
      if (generation === cacheGeneration) openJobsCache = {
        value: [],
        expiresAt: Date.now() + OPEN_JOBS_CACHE_TTL_MS,
      };
      return [];
    }

    const enrichedJobs = await attachEmployerDetailsToJobs(visibleJobs);
    if (generation === cacheGeneration) openJobsCache = {
      value: enrichedJobs,
      expiresAt: Date.now() + OPEN_JOBS_CACHE_TTL_MS,
    };
    return enrichedJobs;
  })();

  openJobsInFlight = request;
  return request.finally(() => {
    if (openJobsInFlight === request) {
      openJobsInFlight = null;
    }
  });
}

async function attachEmployerDetailsToJobs(jobs: any[]) {
  if (!jobs || jobs.length === 0) return [];

  const jobIds = [...new Set(jobs.map((job) => String(job.id)).filter(Boolean))];
  const employerIds = [...new Set(jobs.map((job) => String(job.employer_id)))];

  const { data: jobSkills, error: jobSkillsError } = await supabase
    .from("job_skills")
    .select(`
      job_id,
      required,
      skills (
        name
      )
    `)
    .in("job_id", jobIds)
    .eq("required", true);

  const requiredSkillsMap = !jobSkillsError
    ? (jobSkills ?? []).reduce((acc, row) => {
        const jobId = String((row as { job_id?: unknown }).job_id ?? "").trim();
        const skillName = String(
          ((row as { skills?: { name?: unknown } | null }).skills?.name ?? ""),
        ).trim();

        if (!jobId || !skillName) return acc;

        if (!acc[jobId]) {
          acc[jobId] = [];
        }

        if (!acc[jobId].includes(skillName)) {
          acc[jobId].push(skillName);
        }

        return acc;
      }, {} as Record<string, string[]>)
    : {};

  const employers = await getPublicEmployers(employerIds);
  const resolveLogoUrl = (value: unknown): string | null => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;

    const normalizedPath = raw.replace(/^\/+/, "");
    const { data } = supabase.storage.from("employer-logos").getPublicUrl(normalizedPath);
    return String(data?.publicUrl ?? "").trim() || null;
  };

  const employerMap = (employers || []).reduce((acc, emp) => {
    const normalizedPlan = emp.plan ? String(emp.plan).toLowerCase() : "free";
    const hasEnterpriseBenefits = normalizedPlan === "enterprise";
    acc[String(emp.id)] = {
      company_name: emp.company_name,
      industry: emp.industry ?? null,
      logo_url: resolveLogoUrl(emp.logo_url),
      brand_primary_color: hasEnterpriseBenefits && emp.brand_primary_color ? String(emp.brand_primary_color) : null,
      custom_domain: hasEnterpriseBenefits && emp.custom_domain ? String(emp.custom_domain) : null,
      careers_page_headline: hasEnterpriseBenefits && emp.careers_page_headline ? String(emp.careers_page_headline) : null,
      public_company_page: hasEnterpriseBenefits && emp.public_company_page !== false,
      plan: normalizedPlan,
    };
    return acc;
  }, {} as Record<string, { company_name: string; industry: string | null; logo_url: string | null; brand_primary_color: string | null; custom_domain: string | null; careers_page_headline: string | null; public_company_page: boolean; plan: string }>);

  return jobs.map((job) => ({
    ...job,
    skills_required: requiredSkillsMap[String(job.id)] ?? [],
    employer: {
      company_name: employerMap[String(job.employer_id)]?.company_name || "Unknown Company",
      industry: employerMap[String(job.employer_id)]?.industry || null,
      logo_url: employerMap[String(job.employer_id)]?.logo_url || null,
      brand_primary_color: employerMap[String(job.employer_id)]?.brand_primary_color || null,
      custom_domain: employerMap[String(job.employer_id)]?.custom_domain || null,
      careers_page_headline: employerMap[String(job.employer_id)]?.careers_page_headline || null,
      public_company_page: employerMap[String(job.employer_id)]?.public_company_page ?? true,
      plan: employerMap[String(job.employer_id)]?.plan || "free",
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

export async function getPublicEmployerProfile(employerId: string) {
  const normalizedEmployerId = String(employerId ?? "").trim();
  if (!normalizedEmployerId) return null;

  const [employer] = await getPublicEmployers([normalizedEmployerId]);
  if (!employer) return null;
  const normalizedPlan = String(employer.plan ?? "free").toLowerCase();
  if (
    employer.show_on_platform === false ||
    employer.public_company_page === false ||
    normalizedPlan !== "enterprise"
  ) {
    return null;
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      description,
      location,
      employment_type,
      salary_min,
      salary_max,
      experience_level,
      is_featured,
      featured_until,
      created_at,
      employer_id
    `)
    .eq("employer_id", normalizedEmployerId)
    .eq("status", "open")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (jobsError) throw jobsError;

  const resolveLogoUrl = (value: unknown): string | null => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;

    const normalizedPath = raw.replace(/^\/+/, "");
    const { data } = supabase.storage.from("employer-logos").getPublicUrl(normalizedPath);
    return String(data?.publicUrl ?? "").trim() || null;
  };

  const enrichedJobs = await attachEmployerDetailsToJobs((jobs ?? []) as any[]);

  return {
    employer: {
      id: String(employer.id),
      company_name: String(employer.company_name ?? "Company").trim(),
      industry: employer.industry ? String(employer.industry) : null,
      company_size: employer.company_size ? String(employer.company_size) : null,
      description: employer.description ? String(employer.description) : null,
      website: employer.website ? String(employer.website) : null,
      address: employer.address ? String(employer.address) : null,
      logo_url: resolveLogoUrl(employer.logo_url),
      banner_image_url: resolveLogoUrl(employer.banner_image_url),
      plan: normalizedPlan,
      brand_primary_color: employer.brand_primary_color ? String(employer.brand_primary_color) : null,
      custom_domain: employer.custom_domain ? String(employer.custom_domain) : null,
      careers_page_headline: employer.careers_page_headline ? String(employer.careers_page_headline) : null,
      enterprise_account_manager_name: employer.enterprise_account_manager_name ? String(employer.enterprise_account_manager_name) : null,
      enterprise_account_manager_email: employer.enterprise_account_manager_email ? String(employer.enterprise_account_manager_email) : null,
      sla_tier: employer.sla_tier ? String(employer.sla_tier) : null,
      sla_uptime_target: employer.sla_uptime_target ? String(employer.sla_uptime_target) : null,
      sla_response_time_hours:
        employer.sla_response_time_hours === null || employer.sla_response_time_hours === undefined
          ? null
          : Number(employer.sla_response_time_hours),
    },
    jobs: enrichedJobs,
  };
}

export async function recordJobView(jobId: string) {
  const normalizedJobId = String(jobId ?? "").trim();
  if (!normalizedJobId) return 0;

  const { data, error } = await supabase.rpc("record_job_view", {
    p_job_id: normalizedJobId,
  });

  if (error) {
    throw error;
  }

  return Number(data ?? 0);
}



export async function applyForJob(jobId: string) {
  const context = await resolveCandidateProfileContext();

  try {
    await refreshCandidateMatchingProfile(String(context.profileId));
  } catch (error) {
    console.error("Failed to refresh candidate matching profile before applying", error);
  }

  // Prevent duplicate
  const { data: existing } = await supabase
    .from("job_applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("candidate_profile_id", context.profileId)
    .maybeSingle();

  if (existing) throw new Error("Already applied");

  // The database trigger computes scores from trusted stored skills.

  const { data: application, error } = await supabase
    .from("job_applications")
    .insert({
      job_id: jobId,
      candidate_profile_id: context.profileId,
      status: "applied",
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
  invalidateCandidateApplicationCaches();
}

export async function getAppliedJobIds() {
  const now = Date.now();
  if (appliedJobIdsCache && appliedJobIdsCache.expiresAt > now) {
    return appliedJobIdsCache.value;
  }

  if (appliedJobIdsInFlight) {
    return appliedJobIdsInFlight;
  }

  const generation = cacheGeneration;
  const request = (async () => {
    const context = await resolveCandidateProfileContext();
    const { data, error } = await supabase
      .from("job_applications")
      .select("job_id")
      .eq("candidate_profile_id", context.profileId);

    if (error) throw error;

    const value = (data ?? []).map((row) => row.job_id as string);
    if (generation === cacheGeneration) appliedJobIdsCache = {
      value,
      expiresAt: Date.now() + APPLIED_JOB_IDS_CACHE_TTL_MS,
    };
    return value;
  })();

  appliedJobIdsInFlight = request;
  return request.finally(() => {
    if (appliedJobIdsInFlight === request) {
      appliedJobIdsInFlight = null;
    }
  });
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
  invalidateCandidateProfileCaches();

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
