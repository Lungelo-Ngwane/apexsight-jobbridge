import { supabase } from '@/lib/supabase';
import { PLAN_LIMITS } from "./plan";

export async function canPostJob(employerId: string) {
  // 1ï¸âƒ£ Get employer plan
  const { data: employer, error: empError } = await supabase
    .from("employer_profiles")
    .select("plan")
    .eq("id", employerId)
    .single();

  if (empError) throw empError;

  const rawPlan = String(employer.plan ?? "free");
  const plan: keyof typeof PLAN_LIMITS = rawPlan === "starter" || rawPlan === "professional" || rawPlan === "enterprise" ? rawPlan : "free";

  // 2ï¸âƒ£ Count active jobs
  const { count, error: jobError } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("employer_id", employerId)
    .eq("status", "open");

  if (jobError) throw jobError;

  // 3ï¸âƒ£ Compare with plan limits
  const limit = PLAN_LIMITS[plan].maxActiveJobs;

  return {
    allowed: (count ?? 0) < limit,
    plan,
    limit,
    current: count ?? 0,
  };
}
