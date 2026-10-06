import type { SupabaseClient,User } from "https://esm.sh/@supabase/supabase-js@2.117.2";

export type EmployerMembershipRole = "owner" | "admin" | "recruiter";

export interface EmployerContext {
  user: User;
  employerId: string;
  membershipRole: EmployerMembershipRole;
  plan: string | null;
  subscriptionStatus: string | null;
}

function normalizeRole(value: unknown): EmployerMembershipRole {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "owner" || role === "admin") return role;
  return "recruiter";
}

export async function resolveEmployerContext(
  supabase: SupabaseClient,
  token: string,
  options?: {
    requiredRoles?: EmployerMembershipRole[];
  },
): Promise<EmployerContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Invalid user session");
  }

  const normalizedEmail = String(user.email ?? "").trim().toLowerCase();
  if (normalizedEmail && user.email_confirmed_at) {
    await supabase
      .from("employer_memberships")
      .update({
        user_id: user.id,
        status: "active",
        accepted_at: new Date().toISOString(),
      })
      .eq("email_normalized", normalizedEmail)
      .eq("status", "invited")
      .is("user_id", null);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("employer_memberships")
    .select("employer_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw membershipError;
  }

  const membershipRows = memberships ?? [];
  const employerIds = Array.from(
    new Set(
      membershipRows
        .map((row) => String(row.employer_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  const employerOwnerMap = new Map<string, string>();
  if (employerIds.length > 0) {
    const { data: employerProfiles } = await supabase
      .from("employer_profiles")
      .select("id, user_id")
      .in("id", employerIds);

    for (const employerProfile of employerProfiles ?? []) {
      employerOwnerMap.set(
        String(employerProfile.id ?? ""),
        String((employerProfile as { user_id?: string | null }).user_id ?? ""),
      );
    }
  }

  const membership = [...membershipRows].sort((a, b) => {
    const aOwned = employerOwnerMap.get(String(a.employer_id ?? "")) === user.id ? 1 : 0;
    const bOwned = employerOwnerMap.get(String(b.employer_id ?? "")) === user.id ? 1 : 0;
    if (aOwned !== bOwned) return aOwned - bOwned;

    const order = { owner: 0, admin: 1, recruiter: 2 };
    return order[normalizeRole(a.role)] - order[normalizeRole(b.role)];
  })[0];

  if (membership?.employer_id) {
    const { data: employerProfile, error: employerError } = await supabase
      .from("employer_profiles")
      .select("id, plan, subscription_status")
      .eq("id", membership.employer_id)
      .maybeSingle();

    if (employerError || !employerProfile?.id) {
      throw new Error("Employer profile not found");
    }

    const context = {
      user,
      employerId: String(employerProfile.id),
      membershipRole: normalizeRole(membership.role),
      plan: employerProfile.plan ? String(employerProfile.plan) : null,
      subscriptionStatus: employerProfile.subscription_status
        ? String(employerProfile.subscription_status)
        : null,
    } satisfies EmployerContext;

    if (
      options?.requiredRoles &&
      options.requiredRoles.length > 0 &&
      !options.requiredRoles.includes(context.membershipRole)
    ) {
      throw new Error("Insufficient employer permissions");
    }

    return context;
  }

  const { data: employer, error: employerError } = await supabase
    .from("employer_profiles")
    .select("id, plan, subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (employerError || !employer?.id) {
    throw new Error("Employer profile not found");
  }

  const context = {
    user,
    employerId: String(employer.id),
    membershipRole: "owner" as const,
    plan: employer.plan ? String(employer.plan) : null,
    subscriptionStatus: employer.subscription_status
      ? String(employer.subscription_status)
      : null,
  };

  if (
    options?.requiredRoles &&
    options.requiredRoles.length > 0 &&
    !options.requiredRoles.includes(context.membershipRole)
  ) {
    throw new Error("Insufficient employer permissions");
  }

  return context;
}
