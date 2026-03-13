import { PLAN_LIMITS } from "./plan";
import { supabase } from "./supabase";
import { hasEmployerPaidAccess } from "./subscriptionAccess";

const JOB_VISIBILITY_DAYS = 30;

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

export interface InterviewScheduleRecord {
  id: string;
  jobApplicationId: string;
  jobId: string;
  candidateProfileId: string;
  stage: "screening" | "technical" | "final";
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  mode: "virtual" | "phone" | "onsite";
  locationOrMeetingLink: string | null;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
}

export interface EmployerJobReportPageData {
  job: Record<string, unknown> | null;
  latestReport: Record<string, unknown> | null;
  latestReportCreatedAt: string | null;
  applicants: Array<Record<string, unknown>>;
}

export interface EmployerUsageSnapshot {
  planName: string;
  activeJobs: number;
  jobLimit: number | null;
  extraJobSlotCredits: number;
  candidateViewsUsedThisMonth: number;
  candidateViewLimit: number | null;
  teamMembersUsed: number;
  teamMemberLimit: number | null;
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

export type EmployerMembershipRole = "owner" | "admin" | "recruiter";
export type EmployerMembershipStatus = "invited" | "active" | "revoked";

export interface EmployerContext {
  employerId: string;
  membershipId: string | null;
  membershipRole: EmployerMembershipRole;
  membershipStatus: EmployerMembershipStatus;
  companyName: string | null;
  plan: string | null;
  user: {
    id: string;
    email: string | null;
  };
}

export interface EmployerTeamMember {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  role: EmployerMembershipRole;
  status: EmployerMembershipStatus;
  acceptedAt: string | null;
  createdAt: string;
  isCurrentUser: boolean;
}

export interface EmployerIntegrationRequest {
  id: string;
  employerId: string;
  createdBy: string;
  title: string;
  description: string | null;
  status: "requested" | "planned" | "in_progress" | "completed" | "declined";
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedSkillCatalogItem {
  id: string;
  name: string;
  created_skill?: boolean;
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

export async function resolveOrCreateSkill(skillName: string): Promise<ResolvedSkillCatalogItem> {
  const normalizedSkillName = String(skillName ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedSkillName) {
    throw new Error("Enter a skill name.");
  }

  const { data, error } = await invokeAuthedFunction<{
    success?: boolean;
    skill?: { id?: string; name?: string };
    created_skill?: boolean;
  }>("resolve-skill", {
    skill_name: normalizedSkillName,
  });

  if (error) {
    const message =
      (error as { message?: string } | null)?.message ??
      (error as { detail?: string | null } | null)?.detail ??
      "Failed to resolve skill.";
    throw new Error(String(message));
  }

  const skillId = String(data?.skill?.id ?? "").trim();
  const resolvedName = String(data?.skill?.name ?? normalizedSkillName).trim();

  if (!skillId) {
    throw new Error("Failed to resolve skill.");
  }

  return {
    id: skillId,
    name: resolvedName,
    created_skill: Boolean(data?.created_skill),
  };
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

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeMembershipRole(value: unknown): EmployerMembershipRole {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "owner" || role === "admin") return role;
  return "recruiter";
}

function normalizeMembershipStatus(value: unknown): EmployerMembershipStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "active" || status === "revoked") return status;
  return "invited";
}

export async function getCurrentEmployerContext(
  options?: { requiredRoles?: EmployerMembershipRole[] },
): Promise<EmployerContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  try {
    await supabase.rpc("claim_pending_employer_invites");
  } catch {
    // Older environments may not have the RPC yet; fall back to legacy owner resolution.
  }

  const { data: contextRows, error: contextError } = await supabase.rpc(
    "get_current_employer_context",
  );

  const contextRow = Array.isArray(contextRows) ? contextRows[0] : null;
  if (contextError) {
    console.warn("Failed to resolve employer context from RPC", contextError);
  }

  let resolvedContext: EmployerContext | null = null;

  if (contextRow?.employer_id) {
    resolvedContext = {
      employerId: String(contextRow.employer_id),
      membershipId: contextRow.membership_id ? String(contextRow.membership_id) : null,
      membershipRole: normalizeMembershipRole(contextRow.membership_role),
      membershipStatus: normalizeMembershipStatus(contextRow.membership_status),
      companyName: contextRow.company_name ? String(contextRow.company_name) : null,
      plan: contextRow.plan ? String(contextRow.plan) : null,
      user: {
        id: String(user.id),
        email: user.email ?? null,
      },
    };
  }

  if (!resolvedContext) {
    const { data: memberships } = await supabase
      .from("employer_memberships")
      .select(`
        id,
        employer_id,
        role,
        status,
        created_at,
        employer_profiles!inner (
          id,
          user_id,
          company_name,
          plan
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    const preferredMembership = (memberships ?? [])
      .map((row) => {
        const employerProfile = (row as {
          employer_profiles?: {
            id?: string | null;
            user_id?: string | null;
            company_name?: string | null;
            plan?: string | null;
          } | null;
        }).employer_profiles;

        return {
          membershipId: String(row.id ?? ""),
          employerId: String(employerProfile?.id ?? row.employer_id ?? ""),
          employerOwnerUserId: String(employerProfile?.user_id ?? ""),
          membershipRole: normalizeMembershipRole(row.role),
          membershipStatus: normalizeMembershipStatus(row.status),
          companyName: employerProfile?.company_name ? String(employerProfile.company_name) : null,
          plan: employerProfile?.plan ? String(employerProfile.plan) : null,
          createdAt: String(row.created_at ?? ""),
        };
      })
      .filter((row) => row.employerId)
      .sort((a, b) => {
        const aOwned = a.employerOwnerUserId === user.id ? 1 : 0;
        const bOwned = b.employerOwnerUserId === user.id ? 1 : 0;
        if (aOwned !== bOwned) return aOwned - bOwned;
        const roleWeight = { owner: 0, admin: 1, recruiter: 2 };
        return roleWeight[a.membershipRole] - roleWeight[b.membershipRole];
      })[0];

    if (preferredMembership) {
      resolvedContext = {
        employerId: preferredMembership.employerId,
        membershipId: preferredMembership.membershipId,
        membershipRole: preferredMembership.membershipRole,
        membershipStatus: preferredMembership.membershipStatus,
        companyName: preferredMembership.companyName,
        plan: preferredMembership.plan,
        user: {
          id: String(user.id),
          email: user.email ?? null,
        },
      };
    }
  }

  if (!resolvedContext) {
    const { data: employer, error: employerError } = await supabase
      .from("employer_profiles")
      .select("id, company_name, plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerError || !employer?.id) {
      throw new Error("Employer profile not found");
    }

    resolvedContext = {
      employerId: String(employer.id),
      membershipId: null,
      membershipRole: "owner",
      membershipStatus: "active",
      companyName: employer.company_name ? String(employer.company_name) : null,
      plan: employer.plan ? String(employer.plan) : null,
      user: {
        id: String(user.id),
        email: user.email ?? null,
      },
    };
  }

  if (
    options?.requiredRoles &&
    options.requiredRoles.length > 0 &&
    !options.requiredRoles.includes(resolvedContext.membershipRole)
  ) {
    throw new Error("You do not have permission to perform this action.");
  }

  return resolvedContext;
}

export async function getEmployerProfile() {
  const context = await getCurrentEmployerContext();
  const { data, error } = await supabase
    .from("employer_profiles")
    .select("*")
    .eq("id", context.employerId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load employer profile", error);
    return null;
  }

  return data;
}

export async function getEmployerIntegrationRequests(): Promise<EmployerIntegrationRequest[]> {
  const context = await getCurrentEmployerContext({ requiredRoles: ["owner", "admin", "recruiter"] });

  const { data, error } = await supabase
    .from("employer_integration_requests")
    .select("id, employer_id, created_by, title, description, status, created_at, updated_at")
    .eq("employer_id", context.employerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    employerId: String(row.employer_id),
    createdBy: String(row.created_by),
    title: String(row.title ?? "").trim(),
    description: row.description ? String(row.description) : null,
    status: String(row.status ?? "requested") as EmployerIntegrationRequest["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function createEmployerIntegrationRequest(input: {
  title: string;
  description?: string | null;
}) {
  const context = await getCurrentEmployerContext({ requiredRoles: ["owner", "admin"] });
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();

  if (!title) {
    throw new Error("Integration title is required.");
  }

  const { data, error } = await supabase
    .from("employer_integration_requests")
    .insert({
      employer_id: context.employerId,
      created_by: context.user.id,
      title,
      description: description || null,
      status: "requested",
    })
    .select("id, employer_id, created_by, title, description, status, created_at, updated_at")
    .single();

  if (error) throw error;

  return {
    id: String(data.id),
    employerId: String(data.employer_id),
    createdBy: String(data.created_by),
    title: String(data.title ?? "").trim(),
    description: data.description ? String(data.description) : null,
    status: String(data.status ?? "requested") as EmployerIntegrationRequest["status"],
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  } satisfies EmployerIntegrationRequest;
}

export async function getEmployerTeamMembers(): Promise<EmployerTeamMember[]> {
  const context = await getCurrentEmployerContext({ requiredRoles: ["owner", "admin", "recruiter"] });

  const { data, error } = await supabase
    .from("employer_memberships")
    .select("id, user_id, email, role, status, accepted_at, created_at")
    .eq("employer_id", context.employerId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const userIds = Array.from(
    new Set(
      rows
        .map((row) => String(row.user_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  const profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      const id = String(profile.id ?? "").trim();
      if (!id) continue;
      profileMap.set(id, String((profile as { full_name?: string | null }).full_name ?? "").trim());
    }
  }

  return rows.map((row) => {
    const userId = row.user_id ? String(row.user_id) : null;
    const email = String(row.email ?? "").trim();
    const profileName = userId ? profileMap.get(userId) ?? "" : "";
    const fallbackName = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "Team member";

    return {
      id: String(row.id),
      userId,
      name: profileName || fallbackName || "Team member",
      email,
      role: normalizeMembershipRole(row.role),
      status: normalizeMembershipStatus(row.status),
      acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
      createdAt: String(row.created_at ?? new Date().toISOString()),
      isCurrentUser: userId === context.user.id,
    };
  });
}

export async function inviteEmployerTeamMember(input: {
  email: string;
  role: EmployerMembershipRole;
}) {
  const context = await getCurrentEmployerContext({ requiredRoles: ["owner", "admin"] });
  const email = normalizeEmail(input.email);
  const role = normalizeMembershipRole(input.role);

  if (!email) {
    throw new Error("Enter a team member email address.");
  }

  if (role === "owner") {
    throw new Error("Invite team members as admin or recruiter.");
  }

  const { error } = await supabase.from("employer_memberships").upsert(
    {
      employer_id: context.employerId,
      email,
      role,
      status: "invited",
      invited_by: context.user.id,
    },
    {
      onConflict: "employer_id,email_normalized",
    },
  );

  if (error) {
    const message = String(error.message ?? "");
    if (message.toUpperCase().includes("TEAM_MEMBER_LIMIT_REACHED")) {
      throw new Error("TEAM_MEMBER_LIMIT_REACHED");
    }
    throw error;
  }
}

export async function updateEmployerTeamMember(
  membershipId: string,
  updates: Partial<Pick<EmployerTeamMember, "role" | "status">>,
) {
  await getCurrentEmployerContext({ requiredRoles: ["owner", "admin"] });

  const payload: Record<string, unknown> = {};
  if (updates.role) payload.role = normalizeMembershipRole(updates.role);
  if (updates.status) payload.status = normalizeMembershipStatus(updates.status);

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from("employer_memberships")
    .update(payload)
    .eq("id", membershipId);

  if (error) throw error;
}

export async function revokeEmployerTeamMember(membershipId: string) {
  await updateEmployerTeamMember(membershipId, { status: "revoked" });
}

/* =========================
   CREATE JOB
========================= */
export async function createJob(data: {
  title: string;
  description: string;
  location?: string;
  employment_type?: string;
  work_mode?: string;
  department?: string;
  min_years_experience?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  benefits?: string | null;
  status: string;
  experience_level: string;
  skills?: { skill_id: string; is_required: boolean; min_score?: number | null }[];
}) {
  const employer = await getCurrentEmployerContext();

  // 3) Insert the job
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      employer_id: employer.employerId,
      title: data.title,
      description: data.description,
      location: data.location || null,
      employment_type: data.employment_type || null,
      work_mode: data.work_mode || null,
      department: data.department || null,
      min_years_experience:
        typeof data.min_years_experience === "number" && Number.isFinite(data.min_years_experience)
          ? Math.max(0, Math.round(data.min_years_experience))
          : null,
      salary_min:
        typeof data.salary_min === "number" && Number.isFinite(data.salary_min)
          ? Math.max(0, Math.round(data.salary_min))
          : null,
      salary_max:
        typeof data.salary_max === "number" && Number.isFinite(data.salary_max)
          ? Math.max(0, Math.round(data.salary_max))
          : null,
      benefits: data.benefits?.trim() ? data.benefits.trim() : null,
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
        min_score:
          typeof s.min_score === "number" && Number.isFinite(s.min_score)
            ? Math.max(0, Math.min(100, Math.round(s.min_score)))
            : null,
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
  const employer = await getCurrentEmployerContext();

  const withVisibility = await supabase
    .from("jobs")
    .select(
      `
      id,
      title,
      status,
      location,
      description,
      employment_type,
      work_mode,
      department,
      min_years_experience,
      salary_min,
      salary_max,
      benefits,
      view_count,
      experience_level,
      job_skills (
        skill_id,
        required,
        min_score,
        skills ( name )
      ),
      is_featured,
      featured_until,
      published_at,
      expires_at,
      created_at,
      job_applications ( id, status )
    `,
    )
    .eq("employer_id", employer.employerId)
    .order("created_at", { ascending: false });

  if (!withVisibility.error) {
    return withVisibility.data;
  }

  const visibilityError = String(withVisibility.error?.message ?? "").toLowerCase();
  if (!visibilityError.includes("published_at") && !visibilityError.includes("expires_at")) {
    throw withVisibility.error;
  }

  const legacy = await supabase
    .from("jobs")
    .select(
      `
      id,
      title,
      status,
      location,
      description,
      employment_type,
      work_mode,
      department,
      min_years_experience,
      salary_min,
      salary_max,
      benefits,
      view_count,
      experience_level,
      job_skills (
        skill_id,
        required,
        min_score,
        skills ( name )
      ),
      is_featured,
      featured_until,
      created_at,
      job_applications ( id, status )
    `,
    )
    .eq("employer_id", employer.employerId)
    .order("created_at", { ascending: false });

  if (legacy.error) throw legacy.error;
  return legacy.data;
}

export async function getEmployerJobReportPageData(jobId: string): Promise<EmployerJobReportPageData> {
  const employer = await getCurrentEmployerContext();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      status,
      location,
      description,
      employment_type,
      work_mode,
      department,
      min_years_experience,
      salary_min,
      salary_max,
      benefits,
      experience_level,
      published_at,
      created_at,
      job_skills (
        required,
        min_score,
        skills ( name )
      )
    `)
    .eq("id", jobId)
    .eq("employer_id", employer.employerId)
    .maybeSingle();

  if (jobError) throw jobError;

  const { data: latestReportRow, error: latestReportError } = await supabase
    .from("job_ai_reports")
    .select("report, created_at")
    .eq("job_id", jobId)
    .eq("employer_id", employer.employerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestReportError) throw latestReportError;

  const { data: applicants, error: applicantsError } = await supabase
    .from("job_applications")
    .select(`
      id,
      status,
      score,
      created_at,
      candidate_profile_id,
      candidate:candidate_profiles (
        id,
        full_name,
        headline,
        location,
        years_experience,
        candidate_skills (
          level,
          skills ( name )
        )
      )
    `)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (applicantsError) throw applicantsError;

  return {
    job: (job as Record<string, unknown> | null) ?? null,
    latestReport: (latestReportRow?.report as Record<string, unknown> | null) ?? null,
    latestReportCreatedAt: latestReportRow?.created_at ? String(latestReportRow.created_at) : null,
    applicants: ((applicants ?? []) as Array<Record<string, unknown>>),
  };
}

export async function updateJob(
  jobId: string,
  data: {
    title: string;
    description: string;
    location?: string;
    employment_type?: string;
    work_mode?: string;
    department?: string;
    min_years_experience?: number | null;
    salary_min?: number | null;
    salary_max?: number | null;
    benefits?: string | null;
    status: "open" | "closed" | "archived";
    experience_level: string;
    skills?: { skill_id: string; is_required: boolean; min_score?: number | null }[];
  },
) {
  const employer = await getCurrentEmployerContext();

  const { error } = await supabase
    .from("jobs")
    .update({
      title: data.title,
      description: data.description,
      location: data.location || null,
      employment_type: data.employment_type || null,
      work_mode: data.work_mode || null,
      department: data.department || null,
      min_years_experience:
        typeof data.min_years_experience === "number" && Number.isFinite(data.min_years_experience)
          ? Math.max(0, Math.round(data.min_years_experience))
          : null,
      salary_min:
        typeof data.salary_min === "number" && Number.isFinite(data.salary_min)
          ? Math.max(0, Math.round(data.salary_min))
          : null,
      salary_max:
        typeof data.salary_max === "number" && Number.isFinite(data.salary_max)
          ? Math.max(0, Math.round(data.salary_max))
          : null,
      benefits: data.benefits?.trim() ? data.benefits.trim() : null,
      status: data.status,
      experience_level: data.experience_level,
    })
    .eq("id", jobId)
    .eq("employer_id", employer.employerId);

  if (error) {
    const message = String(error?.message ?? "").toUpperCase();
    const details = String((error as { details?: string } | null)?.details ?? "").toUpperCase();
    if (message.includes("PLAN_LIMIT_REACHED") || details.includes("PLAN_LIMIT_REACHED")) {
      throw new Error("PLAN_LIMIT_REACHED");
    }
    throw error;
  }

  if (Array.isArray(data.skills)) {
    const { error: clearSkillsError } = await supabase
      .from("job_skills")
      .delete()
      .eq("job_id", jobId);

    if (clearSkillsError) throw clearSkillsError;

    if (data.skills.length > 0) {
      const { error: insertSkillsError } = await supabase.from("job_skills").insert(
        data.skills.map((skill) => ({
          job_id: jobId,
          skill_id: skill.skill_id,
          required: skill.is_required,
          min_score:
            typeof skill.min_score === "number" && Number.isFinite(skill.min_score)
              ? Math.max(0, Math.min(100, Math.round(skill.min_score)))
              : null,
        })),
      );

      if (insertSkillsError) throw insertSkillsError;
    }
  }

  await supabase.functions
    .invoke("generate-job-embedding", {
      body: { job_id: jobId, skip_credit: true },
    })
    .catch((invokeError) => {
      console.warn("Failed to refresh job embedding after update", invokeError);
    });
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
  const employer = await getCurrentEmployerContext();

  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId)
    .eq("employer_id", employer.employerId);

  if (error) {
    const message = String(error?.message ?? "").toUpperCase();
    const details = String((error as { details?: string } | null)?.details ?? "").toUpperCase();
    if (message.includes("PLAN_LIMIT_REACHED") || details.includes("PLAN_LIMIT_REACHED")) {
      throw new Error("PLAN_LIMIT_REACHED");
    }
    throw error;
  }
}

export async function renewJobVisibility(jobId: string) {
  const employer = await getCurrentEmployerContext();

  const expiresAt = new Date(Date.now() + JOB_VISIBILITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const withVisibility = await supabase
    .from("jobs")
    .update({
      status: "open",
      published_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .eq("id", jobId)
    .eq("employer_id", employer.employerId);

  if (!withVisibility.error) return;

  const visibilityError = String(withVisibility.error?.message ?? "").toLowerCase();
  if (!visibilityError.includes("published_at") && !visibilityError.includes("expires_at")) {
    throw withVisibility.error;
  }

  const fallback = await supabase
    .from("jobs")
    .update({ status: "open" })
    .eq("id", jobId)
    .eq("employer_id", employer.employerId);

  if (fallback.error) throw fallback.error;
}

/* =========================
   GET JOB APPLICANTS
========================= */
export async function getJobApplicants(jobId: string) {
  const { data: jobRow, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      location,
      employment_type,
      experience_level,
      job_skills (
        skill_id,
        skills ( name ),
        required
      )
    `)
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) throw jobError;

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
        location,
        preferred_job_type,
        cv_url,
        resume_analysis,
        years_experience,
        bio,
        candidate_skills (
          skill_id,
          skill,
          skills ( name ),
          level
        )
      )
    `,
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const applications = data ?? [];
  const candidateIds = applications
    .map((row) => String((row as { candidate?: { id?: string | null } | null }).candidate?.id ?? "").trim())
    .filter((id) => id.length > 0);

  const { data: matchRows, error: matchError } = await supabase
    .from("job_matches")
    .select("candidate_id, similarity")
    .eq("job_id", jobId)
    .in("candidate_id", candidateIds.length > 0 ? candidateIds : ["00000000-0000-0000-0000-000000000000"]);

  if (matchError) throw matchError;

  const similarityByCandidate = new Map<string, number>();
  for (const row of matchRows ?? []) {
    const candidateId = String(row.candidate_id ?? "").trim();
    const similarity = Number(row.similarity ?? NaN);
    if (!candidateId || !Number.isFinite(similarity)) continue;
    similarityByCandidate.set(candidateId, Math.max(0, Math.min(100, Math.round(similarity * 100))));
  }

  return applications.map((row) => {
    const candidateId = String((row as { candidate?: { id?: string | null } | null }).candidate?.id ?? "").trim();
    const applicationScore = Number((row as { score?: number | null }).score ?? NaN);
    const aiSimilarity = similarityByCandidate.get(candidateId) ?? null;
    const intelligence = computeMatchIntelligence({
      applicationScore,
      aiSimilarity,
      scoreBreakdown: (row as { score_breakdown?: { required?: number; optional?: number; experience?: number; skill_level?: number } | null }).score_breakdown ?? null,
      job: {
        title: (jobRow as { title?: string | null } | null)?.title ?? null,
        location: (jobRow as { location?: string | null } | null)?.location ?? null,
        employment_type: (jobRow as { employment_type?: string | null } | null)?.employment_type ?? null,
        experience_level: (jobRow as { experience_level?: string | null } | null)?.experience_level ?? null,
        job_skills: ((jobRow as { job_skills?: Array<{ required?: boolean | null; skill_id?: string | null; skills?: { name?: string | null } | null }> } | null)?.job_skills) ?? [],
      },
      candidate: {
        headline: (row as { candidate?: { headline?: string | null } | null }).candidate?.headline ?? null,
        location: (row as { candidate?: { location?: string | null } | null }).candidate?.location ?? null,
        preferred_job_type: (row as { candidate?: { preferred_job_type?: string | null } | null }).candidate?.preferred_job_type ?? null,
        resume_analysis: (row as { candidate?: { resume_analysis?: unknown } | null }).candidate?.resume_analysis as {
          work_experience?: Array<{ title?: string | null }>;
          debug?: { extraction_method?: string | null };
        } | null,
        candidate_skills: ((row as { candidate?: { candidate_skills?: Array<{ skill_id?: string | null; skill?: string | null; skills?: { name?: string | null } | null }> } | null }).candidate?.candidate_skills) ?? [],
        cv_url: (row as { candidate?: { cv_url?: string | null } | null }).candidate?.cv_url ?? null,
      },
    });

    return {
      ...row,
      ai_similarity: aiSimilarity,
      hybrid_score: intelligence.baseHybridScore,
      final_match_score: intelligence.finalMatchScore,
      confidence_score: intelligence.confidenceScore,
    };
  });
}

export async function scheduleInterview(input: {
  applicationId: string;
  stage: "screening" | "technical" | "final";
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  mode: "virtual" | "phone" | "onsite";
  locationOrMeetingLink?: string | null;
  notes?: string | null;
}): Promise<InterviewScheduleRecord> {
  const employer = await getCurrentEmployerContext();
  const userId = employer.user.id;

  const applicationId = String(input.applicationId ?? "").trim();
  if (!applicationId) throw new Error("Missing application id.");

  const scheduledAt = String(input.scheduledAt ?? "").trim();
  if (!scheduledAt) throw new Error("Choose an interview date and time.");

  const durationMinutes = Math.max(15, Math.min(240, Math.round(Number(input.durationMinutes ?? 30) || 30)));
  const timezone = String(input.timezone ?? "").trim() || "Africa/Johannesburg";
  const stage = (String(input.stage ?? "screening").trim().toLowerCase() as InterviewScheduleRecord["stage"]);
  const mode = (String(input.mode ?? "virtual").trim().toLowerCase() as InterviewScheduleRecord["mode"]);
  const locationOrMeetingLink = String(input.locationOrMeetingLink ?? "").trim() || null;
  const notes = String(input.notes ?? "").trim() || null;

  const { data: application, error: applicationError } = await supabase
    .from("job_applications")
    .select(`
      id,
      job_id,
      candidate_profile_id,
      jobs!inner (
        employer_id
      )
    `)
    .eq("id", applicationId)
    .eq("jobs.employer_id", employer.employerId)
    .single();

  if (applicationError || !application) {
    throw new Error("Application not found for this employer.");
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .insert({
      job_application_id: applicationId,
      job_id: application.job_id,
      employer_id: employer.employerId,
      candidate_profile_id: application.candidate_profile_id,
      stage,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      timezone,
      mode,
      location_or_meeting_link: locationOrMeetingLink,
      notes,
      status: "scheduled",
      created_by: userId,
    })
    .select(`
      id,
      job_application_id,
      job_id,
      candidate_profile_id,
      stage,
      scheduled_at,
      duration_minutes,
      timezone,
      mode,
      location_or_meeting_link,
      notes,
      status
    `)
    .single();

  if (interviewError || !interview) {
    throw interviewError ?? new Error("Failed to schedule interview.");
  }

  const { error: statusError } = await supabase
    .from("job_applications")
    .update({ status: "interview" })
    .eq("id", applicationId);

  if (statusError) throw statusError;

  const { error: notifyError } = await invokeAuthedFunction(
    "send-notification-email",
    {
      type: "CANDIDATE_INTERVIEW_SCHEDULED",
      data: {
        applicationId,
        interviewId: interview.id,
      },
    },
  );

  if (notifyError) {
    console.warn("Interview scheduled but notification dispatch failed", notifyError);
  }

  return {
    id: String(interview.id),
    jobApplicationId: String(interview.job_application_id),
    jobId: String(interview.job_id),
    candidateProfileId: String(interview.candidate_profile_id),
    stage: interview.stage as InterviewScheduleRecord["stage"],
    scheduledAt: String(interview.scheduled_at),
    durationMinutes: Number(interview.duration_minutes ?? durationMinutes),
    timezone: String(interview.timezone ?? timezone),
    mode: interview.mode as InterviewScheduleRecord["mode"],
    locationOrMeetingLink: interview.location_or_meeting_link ? String(interview.location_or_meeting_link) : null,
    notes: interview.notes ? String(interview.notes) : null,
    status: interview.status as InterviewScheduleRecord["status"],
  };
}

export async function getJobSkillSummary(jobId: string) {
  const { data, error } = await supabase
    .from("job_skills")
    .select("required")
    .eq("job_id", jobId);

  if (error) throw error;

  const requiredCount = (data ?? []).filter((row) => Boolean(row.required)).length;
  const optionalCount = (data ?? []).filter((row) => !row.required).length;

  return {
    totalCount: (data ?? []).length,
    requiredCount,
    optionalCount,
  };
}

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

function computeMatchIntelligence(input: {
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
  const applicationScore = Number.isFinite(Number(input.applicationScore)) ? Number(input.applicationScore) : null;
  const aiSimilarity = Number.isFinite(Number(input.aiSimilarity)) ? Number(input.aiSimilarity) : null;
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

/* =========================
   UPDATE APPLICATION STATUS
========================= */
export async function updateApplicationStatus(
  applicationId: string,
  status: "shortlisted" | "interview" | "rejected" | "hired",
) {
  const { error } = await supabase
    .from("job_applications")
    .update({ status })
    .eq("id", applicationId);

  if (error) throw error;
  if (status === "shortlisted") {
    const { error: invokeError } = await invokeAuthedFunction(
      "send-notification-email",
      {
        type: "CANDIDATE_SHORTLISTED",
        data: {
          applicationId,
        },
      },
    );

    if (invokeError) {
      const message =
        (invokeError as { message?: string } | null)?.message ??
        (invokeError as { detail?: string | null } | null)?.detail ??
        "Failed to send shortlisted notification.";
      throw new Error(String(message));
    }
  }
}

/* =========================
   EMPLOYER ANALYTICS
========================= */

export async function getEmployerAnalytics() {
  const employer = await getCurrentEmployerContext();

  // Active jobs
  const { count: activeJobs } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("employer_id", employer.employerId)
    .eq("status", "open");

  // Total applicants
  const { count: totalApplicants } = await supabase
    .from("job_applications")
    .select("id, jobs!inner(employer_id)", { count: "exact", head: true })
    .eq("jobs.employer_id", employer.employerId);

  // Shortlisted
  const { count: shortlisted } = await supabase
    .from("job_applications")
    .select("id, jobs!inner(employer_id)", { count: "exact", head: true })
    .eq("jobs.employer_id", employer.employerId)
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
    const employer = await getCurrentEmployerContext();
    if (employer?.employerId) {
        const { data: aiCredit } = await supabase
          .from("employer_credits")
          .select("remaining")
          .eq("employer_id", employer.employerId)
          .eq("credit_type", "ai_credit")
          .maybeSingle();

        canRunPaidAutoMatch = Number(aiCredit?.remaining ?? 0) > 0;
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
        professional_bio_ai,
        resume_summary,
        preferred_job_type,
        resume_analysis,
        years_experience,
        headline,
        cv_url,
        embedding,
        candidate_skills (
          skill_id,
          skill,
          level
        )
      ),
      jobs (
        embedding,
        title,
        location,
        employment_type,
        experience_level,
        job_skills (
          skill_id,
          skills ( name ),
          required
        )
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
  const intelligence = computeMatchIntelligence({
    applicationScore,
    aiSimilarity: aiSimilarityPercent,
    scoreBreakdown: (data as { score_breakdown?: { required?: number; optional?: number; experience?: number; skill_level?: number } | null }).score_breakdown ?? null,
    job: {
      title: (data as { jobs?: { title?: string | null } | null })?.jobs?.title ?? null,
      location: (data as { jobs?: { location?: string | null } | null })?.jobs?.location ?? null,
      employment_type: (data as { jobs?: { employment_type?: string | null } | null })?.jobs?.employment_type ?? null,
      experience_level: (data as { jobs?: { experience_level?: string | null } | null })?.jobs?.experience_level ?? null,
      job_skills: (((data as { jobs?: { job_skills?: Array<{ required?: boolean | null; skill_id?: string | null; skills?: { name?: string | null } | null }> } | null })?.jobs?.job_skills) ?? []),
    },
    candidate: {
      headline: (data as { candidate_profiles?: { headline?: string | null } | null })?.candidate_profiles?.headline ?? null,
      location: (data as { candidate_profiles?: { location?: string | null } | null })?.candidate_profiles?.location ?? null,
      preferred_job_type: (data as { candidate_profiles?: { preferred_job_type?: string | null } | null })?.candidate_profiles?.preferred_job_type ?? null,
      resume_analysis: (data as { candidate_profiles?: { resume_analysis?: unknown } | null })?.candidate_profiles?.resume_analysis as {
        work_experience?: Array<{ title?: string | null }>;
        debug?: { extraction_method?: string | null };
      } | null,
      candidate_skills: (((data as { candidate_profiles?: { candidate_skills?: Array<{ skill_id?: string | null; skill?: string | null }> } | null })?.candidate_profiles?.candidate_skills) ?? []),
      cv_url: (data as { candidate_profiles?: { cv_url?: string | null } | null })?.candidate_profiles?.cv_url ?? null,
    },
  });

  return {
    ...data,
    ai_similarity: aiSimilarityPercent,
    hybrid_score: intelligence.baseHybridScore,
    final_match_score: intelligence.finalMatchScore,
    confidence_score: intelligence.confidenceScore,
    knockout_filters: intelligence.knockoutFilters,
    match_explanations: intelligence.explanations,
    matching_config: intelligence.matchingConfig,
    recency_bonus: intelligence.recencyBonus,
    knockout_penalty: intelligence.penalty,
    displayed_match_level: intelligence.displayedMatchLevel,
    displayed_recommendation: intelligence.displayedRecommendation,
  };
}

export async function getEmployerPremiumDashboardInsights(): Promise<EmployerPremiumDashboardInsights> {
  const employerContext = await getCurrentEmployerContext();
  const { data: employer, error: employerError } = await supabase
    .from("employer_profiles")
    .select("id, plan, subscription_status, trial_granted, trial_started_at, trial_ends_at")
    .eq("id", employerContext.employerId)
    .single();

  if (employerError || !employer?.id) throw new Error("Employer profile not found");

  if (!hasEmployerPaidAccess(employer)) {
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
    .eq("jobs.employer_id", employerContext.employerId)
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
  const normalized = String(cvPath ?? "").trim();
  if (!normalized) throw new Error("Missing CV path.");

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const buckets = ["resume", "resumes"];
  for (const bucket of buckets) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(normalized, 60 * 10); // 10 minutes

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  throw new Error("Unable to create a secure CV download link.");
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
  const employer = await getCurrentEmployerContext({ requiredRoles: ["owner", "admin"] });
  const user = employer.user;

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
        employerId: employer.employerId,
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
  const employer = await getCurrentEmployerContext();

  const { data, error } = await supabase
    .from("employer_credits")
    .select("credit_type, remaining")
    .eq("employer_id", employer.employerId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    creditType: String(row.credit_type ?? ""),
    remaining: Number(row.remaining ?? 0),
  }));
}

function normalizeAddonReturnTo(returnTo?: string | null) {
  const fallback = "/employer/addons";
  const raw = String(returnTo ?? "").trim();
  if (!raw && typeof window !== "undefined") {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return current.startsWith("/") ? current : fallback;
  }
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export async function startAddonCheckout(addonId: string, returnTo?: string) {
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
    body: {
      addonId,
      returnTo: normalizeAddonReturnTo(returnTo),
    },
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
  const employer = await getCurrentEmployerContext();

  const normalizedPlan = String(employer.plan ?? "free").toLowerCase();
  const fallbackCandidateViewLimits: Record<string, number | null> = {
    free: 10,
    starter: 50,
    professional: 300,
    enterprise: 9999,
  };

  const { data: planRow } = await supabase
    .from("plans")
    .select("name, job_limit, user_limit, candidate_view_limit")
    .ilike("name", normalizedPlan)
    .maybeSingle();

  const { count: activeJobs, error: activeJobsError } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("employer_id", employer.employerId)
    .eq("status", "open");

  if (activeJobsError) throw activeJobsError;

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { count: usedViewsThisMonth, error: viewsError } = await supabase
    .from("employer_credit_usage")
    .select("id", { count: "exact", head: true })
    .eq("employer_id", employer.employerId)
    .eq("context_type", "candidate_profile_view")
    .gte("created_at", startOfMonth.toISOString());

  if (viewsError) throw viewsError;

  const { data: extraJobSlotRow, error: extraJobSlotError } = await supabase
    .from("employer_credits")
    .select("remaining")
    .eq("employer_id", employer.employerId)
    .eq("credit_type", "job_slot")
    .maybeSingle();

  if (extraJobSlotError) throw extraJobSlotError;

  const { count: teamMembersUsed, error: teamMembersError } = await supabase
    .from("employer_memberships")
    .select("id", { count: "exact", head: true })
    .eq("employer_id", employer.employerId)
    .in("status", ["active", "invited"]);

  if (teamMembersError) throw teamMembersError;

  const baseJobLimit =
    planRow && planRow.job_limit === null
      ? null
      : (planRow?.job_limit ??
        PLAN_LIMITS[normalizedPlan as keyof typeof PLAN_LIMITS]?.maxActiveJobs ??
        null);
  const extraJobSlotCredits = Number(extraJobSlotRow?.remaining ?? 0);

  return {
    planName: String(planRow?.name ?? normalizedPlan),
    activeJobs: Number(activeJobs ?? 0),
    jobLimit:
      baseJobLimit === null
        ? null
        : baseJobLimit + extraJobSlotCredits,
    extraJobSlotCredits,
    candidateViewsUsedThisMonth: Number(usedViewsThisMonth ?? 0),
    candidateViewLimit:
      planRow && planRow.candidate_view_limit === null
        ? null
        : (planRow?.candidate_view_limit ?? fallbackCandidateViewLimits[normalizedPlan] ?? 0),
    teamMembersUsed: Number(teamMembersUsed ?? 0),
    teamMemberLimit: planRow?.user_limit ?? (normalizedPlan === "free" ? 1 : null),
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
  enterprise_account_manager_name?: string | null;
  enterprise_account_manager_email?: string | null;
  white_label_enabled?: boolean;
  brand_primary_color?: string | null;
  banner_image_url?: string | null;
  custom_domain?: string | null;
  careers_page_headline?: string | null;
  sla_tier?: string | null;
  sla_uptime_target?: string | null;
  sla_response_time_hours?: number | null;
  onboarding_step?: number;
  plan?: string;
  selected_plan?: string | null;
  subscription_status?:
    | "inactive"
    | "active"
    | "past_due"
    | "cancelled"
    | "trialing"
    | "pending_payment";
}) {
  const employer = await getCurrentEmployerContext({ requiredRoles: ["owner", "admin"] });

  const { error } = await supabase
    .from("employer_profiles")
    .update(payload)
    .eq("id", employer.employerId);

  if (error) {
    console.error("Failed to update employer profile", error);
    throw error;
  }
}

export async function uploadEmployerLogo(file: File): Promise<string> {
  return uploadEmployerBrandImage(file, "logo");
}

export async function uploadEmployerBanner(file: File): Promise<string> {
  return uploadEmployerBrandImage(file, "banner");
}

async function uploadEmployerBrandImage(file: File, kind: "logo" | "banner"): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${user.id}/${kind}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("employer-logos")
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("employer-logos")
    .getPublicUrl(path);

  const publicUrl = String(publicUrlData?.publicUrl ?? "").trim();
  if (!publicUrl) throw new Error("Failed to resolve logo URL.");

  await updateEmployerProfile(kind === "logo" ? { logo_url: publicUrl } : { banner_image_url: publicUrl });
  return publicUrl;
}
