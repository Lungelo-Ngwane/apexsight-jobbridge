import { supabase } from '@/lib/supabase';
// src/lib/employer/permissions.ts
// import { supabase } from "@/lib/supabase";
import { PLAN_LIMITS } from "./plan";
// import { PLAN_LIMITS } from "../plans";

export async function canPostJob(employerId: string) {
  // 1️⃣ Get employer plan
  const { data: employer, error: empError } = await supabase
    .from("employer_profiles")
    .select("plan")
    .eq("id", employerId)
    .single();

  if (empError) throw empError;

  const plan = employer.plan ?? "free";

  // 2️⃣ Count active jobs
  const { count, error: jobError } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("employer_id", employerId)
    .eq("status", "open");

  if (jobError) throw jobError;

  // 3️⃣ Compare with plan limits
  const limit = PLAN_LIMITS[plan].maxActiveJobs;

  return {
    allowed: count < limit,
    plan,
    limit,
    current: count,
  };
}
