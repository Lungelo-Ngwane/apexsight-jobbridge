import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normalizePlanName(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

const fallbackCandidateViewLimits: Record<string, number | null> = {
  free: 10,
  starter: 50,
  professional: 300,
  enterprise: 9999,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { applicationId } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!applicationId) {
      return new Response(JSON.stringify({ error: "Missing applicationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: employer, error: employerError } = await supabase
      .from("employer_profiles")
      .select("id, plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerError || !employer?.id) {
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: application, error: appError } = await supabase
      .from("job_applications")
      .select("id, job_id, jobs!inner(employer_id)")
      .eq("id", applicationId)
      .maybeSingle();

    if (
      appError ||
      !application ||
      String((application as { jobs?: { employer_id?: string } }).jobs?.employer_id ?? "") !==
        String(employer.id)
    ) {
      return new Response(JSON.stringify({ error: "Application not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planName = normalizePlanName(employer.plan ?? "free");
    const { data: planRow } = await supabase
      .from("plans")
      .select("candidate_view_limit")
      .ilike("name", planName)
      .maybeSingle();

    const rawPlanLimit =
      planRow && planRow.candidate_view_limit === null
        ? null
        : (planRow?.candidate_view_limit ?? fallbackCandidateViewLimits[planName] ?? 0);
    const viewLimit = rawPlanLimit === null ? Infinity : Number(rawPlanLimit ?? 0);

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const { data: usageRows, error: usageError } = await supabase
      .from("employer_credit_usage")
      .select("amount")
      .eq("employer_id", employer.id)
      .eq("context_type", "candidate_profile_view")
      .gte("created_at", startOfMonth.toISOString());

    if (usageError) {
      return new Response(JSON.stringify({ error: usageError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usedThisMonth = (usageRows ?? []).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    );

    let source: "plan" | "addon" = "plan";

    const hasPlanAllowance = !Number.isFinite(viewLimit)
      ? true
      : viewLimit > 0 && usedThisMonth < viewLimit;

    if (!hasPlanAllowance) {
      source = "addon";

      const { data: creditRow, error: creditError } = await supabase
        .from("employer_credits")
        .select("id, remaining")
        .eq("employer_id", employer.id)
        .eq("credit_type", "candidate_unlock")
        .maybeSingle();

      const current = Number(creditRow?.remaining ?? 0);
      if (creditError || !creditRow?.id || current < 1) {
        return new Response(
          JSON.stringify({
            error: "Insufficient candidate_unlock credits",
            candidateViewsUsedThisMonth: usedThisMonth,
            candidateViewLimit: Number.isFinite(viewLimit) ? viewLimit : null,
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error: deductError } = await supabase
        .from("employer_credits")
        .update({ remaining: current - 1 })
        .eq("id", creditRow.id)
        .eq("remaining", current);

      if (deductError) {
        return new Response(
          JSON.stringify({ error: `Failed to deduct candidate_unlock credit: ${deductError.message}` }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    await supabase.from("employer_credit_usage").insert({
      employer_id: employer.id,
      credit_type: source === "plan" ? "candidate_view_plan" : "candidate_unlock",
      amount: 1,
      context_type: "candidate_profile_view",
      context_id: applicationId,
      metadata: {
        source,
        monthStart: startOfMonth.toISOString(),
        viewLimit: Number.isFinite(viewLimit) ? viewLimit : null,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        source,
        candidateViewsUsedThisMonth: usedThisMonth + 1,
        candidateViewLimit: Number.isFinite(viewLimit) ? viewLimit : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
