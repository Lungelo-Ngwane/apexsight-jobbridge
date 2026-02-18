import OpenAI from "https://esm.sh/openai@4.28.0";
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

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const { jobId } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
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
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerError || !employer?.id) {
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creditRow, error: creditError } = await supabase
      .from("employer_credits")
      .select("id, remaining")
      .eq("employer_id", employer.id)
      .eq("credit_type", "ai_report")
      .maybeSingle();

    if (creditError || !creditRow?.id || Number(creditRow.remaining ?? 0) < 1) {
      return new Response(JSON.stringify({ error: "Insufficient ai_report credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, employer_id, title, description, location, employment_type, experience_level")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job || String(job.employer_id) !== String(employer.id)) {
      return new Response(JSON.stringify({ error: "Job not found for this employer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: applicants } = await supabase
      .from("job_applications")
      .select("id, status, score, created_at")
      .eq("job_id", jobId);

    const totalApplicants = (applicants ?? []).length;
    const shortlisted = (applicants ?? []).filter((a) => a.status === "shortlisted").length;
    const interviewed = (applicants ?? []).filter((a) => a.status === "interview").length;
    const averageScore =
      totalApplicants > 0
        ? Math.round(
            (applicants ?? []).reduce((sum, a) => sum + Number(a.score ?? 0), 0) / totalApplicants,
          )
        : 0;

    const current = Number(creditRow.remaining ?? 0);
    const { error: deductError } = await supabase
      .from("employer_credits")
      .update({ remaining: current - 1 })
      .eq("id", creditRow.id)
      .eq("remaining", current);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: `Failed to deduct credit: ${deductError.message}` }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const prompt = `
You are an expert talent analyst.
Return strict JSON with keys:
summary, strengths (array), risks (array), recommendations (array), score_band.
Job:
- title: ${job.title}
- description: ${job.description}
- location: ${job.location}
- employment_type: ${job.employment_type}
- experience_level: ${job.experience_level}
Pipeline stats:
- total_applicants: ${totalApplicants}
- shortlisted: ${shortlisted}
- interviewed: ${interviewed}
- average_score: ${averageScore}
`;

    let report: Record<string, unknown> = {};
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      });

      const raw = completion.choices?.[0]?.message?.content ?? "{}";
      report = JSON.parse(raw);
    } catch {
      report = {
        summary: "AI report generated with fallback logic.",
        strengths: [
          `Applicant volume: ${totalApplicants}`,
          `Shortlisted candidates: ${shortlisted}`,
        ],
        risks: totalApplicants === 0 ? ["No applicants yet"] : ["Pipeline quality needs review"],
        recommendations: [
          "Adjust required skills for broader reach.",
          "Prioritize top-scoring applicants for interviews.",
        ],
        score_band:
          averageScore >= 80 ? "strong" : averageScore >= 60 ? "moderate" : "developing",
      };
    }

    await supabase.from("job_ai_reports").insert({
      job_id: jobId,
      employer_id: employer.id,
      report,
    });

    await supabase.from("employer_credit_usage").insert({
      employer_id: employer.id,
      credit_type: "ai_report",
      amount: 1,
      context_type: "job",
      context_id: jobId,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        report,
        creditsRemaining: current - 1,
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
