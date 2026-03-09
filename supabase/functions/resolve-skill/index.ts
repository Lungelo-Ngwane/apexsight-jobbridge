import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeSkillName(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
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

    const { data: employerProfile } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!employerProfile?.id) {
      return new Response(JSON.stringify({ error: "Employer profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const skillName = normalizeSkillName(body.skill_name);

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

    return new Response(
      JSON.stringify({
        success: true,
        skill: existingSkill,
        created_skill: createdSkillInCatalog,
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
