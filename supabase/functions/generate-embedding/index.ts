import { serve } from "https://deno.land/std/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      location,
      years_experience,
      experience_level,
      availability,
      preferred_job_type,
      work_mode,
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

  const isCandidateOwner = String(profile.user_id) === String(user.id);

  let isRelatedEmployer = false;
  if (!isCandidateOwner) {
    const { data: employer } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", user.id)
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

  if (!isCandidateOwner && !isRelatedEmployer) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const skills = Array.isArray(profile.candidate_skills)
    ? profile.candidate_skills
        .map((s) => `${String(s.skill ?? "").trim()}${s.level ? ` (${s.level})` : ""}`)
        .filter((s) => s.length > 0)
    : [];


  const text = `
Candidate Name: ${profile.full_name ?? ""}
Headline: ${profile.headline ?? ""}
Bio: ${profile.bio ?? ""}
Location: ${profile.location ?? ""}
Years Experience: ${profile.years_experience ?? ""}
Experience Level: ${profile.experience_level ?? ""}
Availability: ${profile.availability ?? ""}
Preferred Job Type: ${profile.preferred_job_type ?? ""}
Work Mode: ${profile.work_mode ?? ""}
Skills: ${skills.join(", ")}
  `;


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
