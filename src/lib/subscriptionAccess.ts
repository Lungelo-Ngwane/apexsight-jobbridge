type EmployerProfileLike = {
  plan?: string | null;
  subscription_status?: string | null;
  trial_granted?: boolean | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
} | null | undefined;

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isActiveEmployerTrial(profile: EmployerProfileLike): boolean {
  if (!profile) return false;
  if (!profile.trial_granted) return false;

  const now = Date.now();
  const startsAt = parseDate(profile.trial_started_at);
  const endsAt = parseDate(profile.trial_ends_at);

  if (startsAt === null || endsAt === null) return false;
  return now >= startsAt && now < endsAt;
}

export function hasEmployerPaidAccess(profile: EmployerProfileLike): boolean {
  if (!profile) return false;
  if (isActiveEmployerTrial(profile)) return true;

  const plan = String(profile.plan ?? "free").toLowerCase();
  const status = String(profile.subscription_status ?? "").toLowerCase();
  const isPaidPlan =
    plan === "starter" || plan === "professional" || plan === "enterprise";

  return isPaidPlan && (status === "active" || status === "trialing");
}

export function hasEmployerProfessionalAccess(profile: EmployerProfileLike): boolean {
  if (!profile) return false;
  if (isActiveEmployerTrial(profile)) return true;

  const plan = String(profile.plan ?? "free").toLowerCase();
  const status = String(profile.subscription_status ?? "").toLowerCase();
  const isEligiblePlan = plan === "professional" || plan === "enterprise";

  return isEligiblePlan && (status === "active" || status === "trialing");
}

export function hasEmployerEnterpriseAccess(profile: EmployerProfileLike): boolean {
  if (!profile) return false;
  if (isActiveEmployerTrial(profile)) return true;

  const plan = String(profile.plan ?? "free").toLowerCase();
  const status = String(profile.subscription_status ?? "").toLowerCase();
  return plan === "enterprise" && (status === "active" || status === "trialing");
}
