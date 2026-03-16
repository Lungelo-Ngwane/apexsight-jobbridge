type EmployerProfileLike = {
  plan?: string | null;
  subscription_status?: string | null;
  trial_granted?: boolean | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
} | null | undefined;

export function isActiveEmployerTrial(profile: EmployerProfileLike): boolean {
  void profile;
  return false;
}

export function hasEmployerPaidAccess(profile: EmployerProfileLike): boolean {
  if (!profile) return false;

  const plan = String(profile.plan ?? "free").toLowerCase();
  const status = String(profile.subscription_status ?? "").toLowerCase();
  const isPaidPlan =
    plan === "starter" || plan === "professional" || plan === "enterprise";

  return isPaidPlan && status === "active";
}

export function hasEmployerProfessionalAccess(profile: EmployerProfileLike): boolean {
  if (!profile) return false;

  const plan = String(profile.plan ?? "free").toLowerCase();
  const status = String(profile.subscription_status ?? "").toLowerCase();
  const isEligiblePlan = plan === "professional" || plan === "enterprise";

  return isEligiblePlan && status === "active";
}

export function hasEmployerEnterpriseAccess(profile: EmployerProfileLike): boolean {
  if (!profile) return false;

  const plan = String(profile.plan ?? "free").toLowerCase();
  const status = String(profile.subscription_status ?? "").toLowerCase();
  return plan === "enterprise" && status === "active";
}
