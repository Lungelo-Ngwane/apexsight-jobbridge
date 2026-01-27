import { supabase } from "./supabase";

/* =========================
   CREATE JOB
========================= */
export async function createJob(data: {
  title: string;
  description: string;
  location?: string;
  employment_type?: string;
  status: string;
}) {
  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  const { data: employer } = await supabase
    .from("employer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!employer) throw new Error("Employer profile not found");

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      employer_id: employer.id,
      title: data.title,
      description: data.description,
      location: data.location,
      employment_type: data.employment_type,
      status: data.status,
    })
    .select()
    .single();

  if (error) throw error;
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
      created_at,
      job_applications ( id, status )
    `,
    )
    .eq("employer_id", employer.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
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

  if (error) throw error;
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
        cv_url
      )
    `,
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/* =========================
   UPDATE APPLICATION STATUS
========================= */
export async function updateApplicationStatus(
  applicationId: string,
  status: "shortlisted" | "rejected" | "hired",
) {
  const { error } = await supabase
    .from("job_applications")
    .update({ status })
    .eq("id", applicationId);

  if (error) throw error;
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
  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      status,
      score,
      created_at,
      candidate_profiles (
        id,
        full_name,
        location,
        bio,
        years_experience,
        headline,
        cv_url,
        candidate_skills (
          skill,
          level
        )
      )
    `,
    )
    .eq("id", applicationId)
    .single();

  if (error) throw error;
  return data;
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
