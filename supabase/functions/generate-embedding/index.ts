import { serve } from "https://deno.land/std/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildCandidateEmbeddingText(profile: Record<string, unknown>): string {
  const skills = Array.isArray(profile.candidate_skills)
    ? profile.candidate_skills
        .map((s) => {
          const skill = String((s as { skill?: string }).skill ?? "").trim();
          const level = String((s as { level?: string }).level ?? "").trim();
          return skill ? `${skill}${level ? ` (${level})` : ""}` : "";
        })
        .filter((s) => s.length > 0)
    : [];

  const coreSkills = skills.slice(0, 80).join(", ");

  return `
Candidate Headline: ${String(profile.headline ?? "")}
Professional Summary: ${String(profile.professional_bio_ai ?? "") || String(profile.bio ?? "")}
Resume Summary: ${String(profile.resume_summary ?? "")}
Years Experience: ${String(profile.years_experience ?? "")}
Experience Level: ${String(profile.experience_level ?? "")}
Location: ${String(profile.location ?? "")}
Availability: ${String(profile.availability ?? "")}
Preferred Job Type: ${String(profile.preferred_job_type ?? "")}
Work Mode: ${String(profile.work_mode ?? "")}
Core Skills: ${coreSkills}
Resume Evidence: ${String(profile.resume_text ?? "").slice(0, 4000)}
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { profile_id } = await req.json().catch(() => ({}));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  let userId: string | null = null;

  if (token) {
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    userId = user?.id ?? null;
  }

  if (!profile_id) {
    return new Response(JSON.stringify({ error: "Missing profile_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
  });


  const { data: profile, error } = await supabase
    .from("candidate_profiles")
    .select(`
      id,
      user_id,
      full_name,
      headline,
      bio,
      professional_bio_ai,
      location,
      years_experience,
      experience_level,
      availability,
      preferred_job_type,
      work_mode,
      resume_text,
      resume_summary,
      cv_url,
      candidate_skills (
        skill,
        level
      )
    `)
    .eq("id", profile_id)
    .single();


  if (error || !profile) {

    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  }

  const isCandidateOwner = userId ? String(profile.user_id) === String(userId) : false;

  let isRelatedEmployer = false;
  if (userId && !isCandidateOwner) {
    const { data: employer } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (employer?.id) {
      const { data: relationship } = await supabase
        .from("job_applications")
        .select("id, jobs!inner(employer_id)")
        .eq("candidate_profile_id", profile_id)
        .eq("jobs.employer_id", employer.id)
        .limit(1)
        .maybeSingle();

      isRelatedEmployer = Boolean(relationship?.id);
    }
  }

  if (userId && !isCandidateOwner && !isRelatedEmployer) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const text = buildCandidateEmbeddingText(profile as Record<string, unknown>);


  const embeddingResponse = await openai.embeddings.create({

    model: "text-embedding-3-small",

    input: text,

  });


  const embedding = embeddingResponse.data[0].embedding;


  await supabase
    .from("candidate_profiles")
    .update({ embedding })
    .eq("id", profile_id);


  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

});
