import { supabase } from "./supabase";

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

export async function refreshCandidateMatchingProfile(profileId?: string) {
  if (!profileId) {
    throw new Error("Missing profile id for matching refresh.");
  }

  async function runWithCurrentSession() {
    // 1) Parse/refresh structured candidate data from CV + profile text.
    const { error: analyzeError } = await supabase.functions.invoke("analyze-candidate-profile", {
      body: { profile_id: profileId },
    });
    if (analyzeError) throw analyzeError;

    // 2) Regenerate candidate embedding with enriched fields.
    const { error: embeddingError } = await supabase.functions.invoke("generate-embedding", {
      body: { profile_id: profileId },
    });
    if (embeddingError) throw embeddingError;
  }

  await runWithCurrentSession();
}

export async function getCandidateDashboardData() {
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select(
      `
      id,
      full_name,
      headline,
      bio,
      location,
      years_experience,
      cv_url,
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
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      description,
      location,
      employment_type,
      experience_level,
      created_at,
      employer_id
    `)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (jobsError) throw jobsError;
  if (!jobs || jobs.length === 0) return [];

  // Convert all employer_ids to strings
const employerIds = [...new Set(jobs.map(job => String(job.employer_id)))]; // array of strings

const { data: employers, error: empError } = await supabase
  .from("employer_profiles")
  .select("id, company_name, industry")
  .in("id", employerIds); // <-- must be an array
if (empError) throw empError;


  // Map employer_id -> employer details
  const employerMap = (employers || []).reduce((acc, emp) => {
    acc[String(emp.id)] = {
      company_name: emp.company_name,
      industry: emp.industry ?? null,
    };
    return acc;
  }, {} as Record<string, { company_name: string; industry: string | null }>);

  // Attach employer info to jobs
  const jobsWithEmployer = jobs.map(job => ({
    ...job,
    employer: {
      company_name: employerMap[String(job.employer_id)]?.company_name || "Unknown Company",
      industry: employerMap[String(job.employer_id)]?.industry || null,
    }
  }));

  return jobsWithEmployer;
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

    const { error: invokeError } = await supabase.functions.invoke("send-notification-email", {
      body: {
        type: "APPLICATION_CREATED",
        data: {
          applicationId: application.id,
        },
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (invokeError) throw invokeError;
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
