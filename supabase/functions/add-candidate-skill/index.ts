import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

function normalizeSkillName(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidLevel(value: unknown): value is SkillLevel {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["beginner", "intermediate", "advanced", "expert"].includes(normalized);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const skillName = normalizeSkillName(body.skill_name);
    const rawLevel = String(body.level ?? "beginner").trim().toLowerCase();
    const level: SkillLevel = isValidLevel(rawLevel) ? rawLevel : "beginner";

    if (!skillName) {
      return new Response(JSON.stringify({ error: "Missing skill_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (skillName.length > 120) {
      return new Response(JSON.stringify({ error: "Skill name is too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let { data: profile, error: profileError } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile?.id) {
      const { data: createdProfile, error: createProfileError } = await supabase
        .from("candidate_profiles")
        .insert({
          user_id: user.id,
          full_name: String(user.user_metadata?.full_name ?? user.email ?? "Candidate").trim(),
        })
        .select("id")
        .single();

      if (createProfileError || !createdProfile?.id) {
        return new Response(JSON.stringify({ error: createProfileError?.message ?? "Failed to create profile" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      profile = createdProfile;
    }

    let createdSkillInCatalog = false;

    let { data: existingSkill } = await supabase
      .from("skills")
      .select("id, name")
      .ilike("name", skillName)
      .limit(1)
      .maybeSingle();

    if (!existingSkill?.id) {
      const { data: createdSkill, error: createSkillError } = await supabase
        .from("skills")
        .insert({
          name: skillName,
        })
        .select("id, name")
        .single();

      if (createSkillError) {
        const { data: fallbackSkill, error: fallbackError } = await supabase
          .from("skills")
          .select("id, name")
          .ilike("name", skillName)
          .limit(1)
          .maybeSingle();

        if (fallbackError || !fallbackSkill?.id) {
          return new Response(JSON.stringify({ error: createSkillError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        existingSkill = fallbackSkill;
      } else {
        existingSkill = createdSkill;
        createdSkillInCatalog = true;
      }
    }

    const { data: existingCandidateSkill } = await supabase
      .from("candidate_skills")
      .select("id, skill_id, skill, level")
      .eq("candidate_profile_id", profile.id)
      .eq("skill_id", existingSkill.id)
      .maybeSingle();

    if (existingCandidateSkill?.id) {
      return new Response(
        JSON.stringify({
          success: true,
          profile_id: profile.id,
          candidate_skill: existingCandidateSkill,
          created_skill: createdSkillInCatalog,
          created_candidate_skill: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: candidateSkill, error: candidateSkillError } = await supabase
      .from("candidate_skills")
      .insert({
        candidate_profile_id: profile.id,
        skill_id: existingSkill.id,
        skill: existingSkill.name,
        level,
      })
      .select("id, skill_id, skill, level")
      .single();

    if (candidateSkillError || !candidateSkill?.id) {
      return new Response(JSON.stringify({ error: candidateSkillError?.message ?? "Failed to add candidate skill" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile_id: profile.id,
        candidate_skill: candidateSkill,
        created_skill: createdSkillInCatalog,
        created_candidate_skill: true,
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
