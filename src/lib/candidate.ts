import { supabase } from "./supabase";

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

  const { error: updateError } = await supabase
    .from("candidate_profiles")
    .update({ cv_url: filePath })
    .eq("user_id", user.id);

  if (updateError) throw updateError;

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
  .select("id, company_name")
  .in("id", employerIds); // <-- must be an array
if (empError) throw empError;

console.log("Employers fetched:", employers);


  // Map employer_id -> company_name
  const employerMap = (employers || []).reduce((acc, emp) => {
    acc[String(emp.id)] = emp.company_name;
    return acc;
  }, {} as Record<string, string>);

  console.log("Employer Map:", employerMap);

  // Attach employer info to jobs
  const jobsWithEmployer = jobs.map(job => ({
    ...job,
    employer: {
      company_name: employerMap[String(job.employer_id)] || "Unknown Company"
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

  const { error } = await supabase.from("job_applications").insert({
    job_id: jobId,
    candidate_profile_id: profile.id,
    status: "applied",
    score: matchScore,
  });

  if (error) throw error;
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
    .eq("user_id", user.id);

  if (error) throw error;
}
