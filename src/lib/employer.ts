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

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      employer_id: user.id, // ✅ important for RLS
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
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
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
  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId);

  if (error) throw error;
}

/* =========================
   GET JOB APPLICANTS
========================= */
export async function getJobApplicants(jobId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id,
      status,
      created_at,
      candidate:profiles (
        id,
        full_name
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
    .from("applications")
    .update({ status })
    .eq("id", applicationId);

  if (error) throw error;
}

/* =========================
   EMPLOYER ANALYTICS
========================= */

export async function getEmployerAnalytics() {
  // 1️⃣ Active jobs
  const { count: activeJobs } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  // 2️⃣ Total applicants
  const { count: totalApplicants } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true });

  // 3️⃣ Interview ready
  const { count: shortlisted } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "shortlisted");

  // 4️⃣ Avg time to hire
  const { data: hires } = await supabase
    .from("applications")
    .select(`
      created_at,
      job:jobs(created_at)
    `)
    .eq("status", "hired");

  let avgTimeToHire = 0;

  if (hires && hires.length > 0) {
    const days = hires.map((h: any) => {
      const start = new Date(h.job.created_at).getTime();
      const end = new Date(h.created_at).getTime();
      return (end - start) / (1000 * 60 * 60 * 24);
    });

    avgTimeToHire = Math.round(
      days.reduce((a, b) => a + b, 0) / days.length
    );
  }

  return {
    activeJobs: activeJobs ?? 0,
    totalApplicants: totalApplicants ?? 0,
    shortlisted: shortlisted ?? 0,
    avgTimeToHire
  };
}
