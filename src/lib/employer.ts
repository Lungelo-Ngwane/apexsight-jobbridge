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

  const plan = employer.plan ?? "free";
  const planLimits = PLAN_LIMITS[plan];

  // 3️⃣ Count active jobs
  const { count, error: countError } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("employer_id", employer.id)
    .eq("status", "open");

  if (countError) throw countError;

  if (count >= planLimits.maxActiveJobs) {
    try {
      await consumeEmployerCredit("job_slot", 1);
    } catch (creditError) {
      const message = String((creditError as Error)?.message ?? "").toLowerCase();
      if (message.includes("insufficient") || message.includes("no credits")) {
        throw new Error("PLAN_LIMIT_REACHED");
      }
      throw creditError;
    }
  }

  // 4️⃣ Insert the job
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
    throw jobError || new Error("Failed to create job");
  }

  // 5️⃣ Insert job skills
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

  if (error) throw error;
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
  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
      id,
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

export async function getAllSkills() {
  const { data, error } = await supabase
    .from("skills")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return data;
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

    throw new Error(parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to start add-on checkout.");
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

    throw new Error(parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to confirm add-on checkout.");
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

  const { data, error } = await supabase.functions.invoke("auto-match", {
    body: { job_id: jobId },
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

    throw new Error(parsed?.error ?? parsed?.detail ?? error.message ?? "Failed to run AI match.");
  }

  return data;
}

export async function updateEmployerProfile(payload: {
  company_name?: string;
  industry?: string | null;
  company_size?: string | null;
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
