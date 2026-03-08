import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExtractedSkill = {
  skill: string;
  level?: "beginner" | "intermediate" | "advanced" | "expert" | null;
};

type ExtractedPayload = {
  professional_bio?: string | null;
  years_experience?: number | null;
  seniority?: "junior" | "mid" | "senior" | null;
  skills?: ExtractedSkill[];
  work_experience?: { title?: string; company?: string; years?: number | null }[];
  summary?: string | null;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toLevel(value: unknown): "beginner" | "intermediate" | "advanced" | "expert" | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "beginner") return "beginner";
  if (normalized === "intermediate") return "intermediate";
  if (normalized === "advanced") return "advanced";
  if (normalized === "expert") return "expert";
  return null;
}

function normalizeSkillKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#]/g, "")
    .trim();
}

function extractReadableText(bytes: Uint8Array, filePath: string): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const latin1 = new TextDecoder("latin1", { fatal: false }).decode(bytes);
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

  const base = `${utf8}\n${latin1}`;
  const printable = base.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");

  const asciiFragments = printable.match(/[A-Za-z][A-Za-z0-9+#.,/&()'`\- ]{2,}/g) ?? [];
  const pdfFragments =
    ext === "pdf"
      ? [...latin1.matchAll(/\(([^()]{2,220})\)/g)].map((m) => String(m[1] ?? ""))
      : [];

  const merged = normalizeWhitespace(
    [...asciiFragments, ...pdfFragments]
      .map((chunk) => normalizeWhitespace(chunk))
      .filter((chunk) => chunk.length >= 3)
      .join(" "),
  );

  return merged.slice(0, 60000);
}

function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return "{}";
  return raw.slice(start, end + 1);
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
    let userId: string | null = null;

    if (token) {
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const requestedProfileId = String(body.profile_id ?? "").trim();
    if (!requestedProfileId) {
      return new Response(JSON.stringify({ error: "Missing profile_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("candidate_profiles")
      .select(`
        id,
        user_id,
        full_name,
        headline,
        bio,
        cv_url,
        years_experience,
        experience_level,
        candidate_skills (
          skill,
          level
        )
      `)
      .eq("id", requestedProfileId)
      .maybeSingle();

    if (profileError || !profile?.id) {
      return new Response(JSON.stringify({ error: "Candidate profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId && String(profile.user_id) !== String(userId)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cvText = "";
    if (profile.cv_url) {
      const { data: cvBlob, error: cvError } = await supabase.storage
        .from("resume")
        .download(String(profile.cv_url));

      if (!cvError && cvBlob) {
        const bytes = new Uint8Array(await cvBlob.arrayBuffer());
        cvText = extractReadableText(bytes, String(profile.cv_url));
      }
    }

    const existingSkills = Array.isArray(profile.candidate_skills)
      ? profile.candidate_skills
          .map((row) => {
            const skill = normalizeWhitespace(String(row.skill ?? ""));
            const level = toLevel(row.level);
            return skill ? `${skill}${level ? ` (${level})` : ""}` : "";
          })
          .filter((value) => value.length > 0)
      : [];

    const resumeInput = normalizeWhitespace(`
Full Name: ${String(profile.full_name ?? "")}
Headline: ${String(profile.headline ?? "")}
Bio: ${String(profile.bio ?? "")}
Existing Skills: ${existingSkills.join(", ")}
Resume Text: ${cvText}
`);

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    const extraction = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract candidate profile information from resume/profile text. Return strict JSON only. Use null for missing values.",
        },
        {
          role: "user",
          content: `
Extract structured profile data for job matching.
Required JSON shape:
{
  "professional_bio": string | null,
  "years_experience": number | null,
  "seniority": "junior" | "mid" | "senior" | null,
  "skills": [{"skill": string, "level": "beginner" | "intermediate" | "advanced" | "expert" | null}],
  "work_experience": [{"title": string | null, "company": string | null, "years": number | null}],
  "summary": string | null
}
Source:
${resumeInput.slice(0, 50000)}
`,
        },
      ],
    });

    const rawContent = String(extraction.choices?.[0]?.message?.content ?? "{}");
    const parsed = JSON.parse(extractJsonObject(rawContent)) as ExtractedPayload;

    const extractedSkills = Array.isArray(parsed.skills)
      ? parsed.skills
          .map((item) => ({
            skill: normalizeWhitespace(String(item?.skill ?? "")),
            level: toLevel(item?.level),
          }))
          .filter((item) => item.skill.length > 0)
      : [];

    const { data: knownSkills } = await supabase
      .from("skills")
      .select("id, name");

    const skillRows = (knownSkills ?? []).map((row) => ({
      id: String(row.id),
      name: normalizeWhitespace(String(row.name ?? "")),
      lower: normalizeWhitespace(String(row.name ?? "")).toLowerCase(),
      key: normalizeSkillKey(normalizeWhitespace(String(row.name ?? ""))),
    }));

    // Also detect skills by direct CV text mention to ensure CV skills get added,
    // even if the model under-extracts them.
    const cvLower = cvText.toLowerCase();
    const detectedFromCv = skillRows
      .filter((row) => row.name.length >= 2 && cvLower.includes(row.lower))
      .map((row) => ({
        skill: row.name,
        level: null as "beginner" | "intermediate" | "advanced" | "expert" | null,
      }));

    const mergedSkillMap = new Map<
      string,
      { skill: string; level: "beginner" | "intermediate" | "advanced" | "expert" | null }
    >();
    for (const item of [...extractedSkills, ...detectedFromCv]) {
      const key = normalizeSkillKey(item.skill);
      if (!key) continue;
      if (!mergedSkillMap.has(key)) {
        mergedSkillMap.set(key, { skill: item.skill, level: item.level });
        continue;
      }
      const existing = mergedSkillMap.get(key)!;
      if (!existing.level && item.level) {
        mergedSkillMap.set(key, { skill: existing.skill, level: item.level });
      }
    }

    const finalExtractedSkills = Array.from(mergedSkillMap.values());

    const aliasMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      nodejs: "node",
      node: "nodejs",
      reactjs: "react",
      nextjs: "next",
      py: "python",
      postgres: "postgresql",
      postgresql: "postgres",
      powerbi: "power bi",
      ml: "machine learning",
      ai: "artificial intelligence",
      pm: "project management",
      qa: "quality assurance",
      uxui: "ux ui",
      csharp: "c#",
      dotnet: ".net",
      dotnetcore: ".net core",
    };

    function resolveSkillId(rawSkill: string): string | null {
      const needle = rawSkill.toLowerCase();
      const exact = skillRows.find((row) => row.lower === needle);
      if (exact) return exact.id;

      const key = normalizeSkillKey(rawSkill);
      if (key) {
        const exactKey = skillRows.find((row) => row.key === key);
        if (exactKey) return exactKey.id;

        const alias = aliasMap[key];
        if (alias) {
          const aliasKey = normalizeSkillKey(alias);
          const aliasMatch = skillRows.find(
            (row) => row.key === aliasKey || row.lower === alias.toLowerCase(),
          );
          if (aliasMatch) return aliasMatch.id;
        }
      }

      const contains = skillRows.find(
        (row) =>
          row.lower.includes(needle) ||
          needle.includes(row.lower) ||
          (key.length >= 3 && row.key.includes(key)) ||
          (row.key.length >= 3 && key.includes(row.key)),
      );
      return contains?.id ?? null;
    }

    const { data: currentSkillRows } = await supabase
      .from("candidate_skills")
      .select("skill, skill_id")
      .eq("candidate_profile_id", profile.id);

    const existingSkillKeys = new Set(
      (currentSkillRows ?? []).map((row) => normalizeWhitespace(String(row.skill ?? "")).toLowerCase()),
    );

    const currentRowsMissingSkillId = (currentSkillRows ?? []).filter(
      (row) => !row.skill_id && String(row.skill ?? "").trim().length > 0,
    );

    for (const row of currentRowsMissingSkillId) {
      const candidateSkill = normalizeWhitespace(String(row.skill ?? ""));
      const resolved = resolveSkillId(candidateSkill);
      if (!resolved) continue;

      await supabase
        .from("candidate_skills")
        .update({ skill_id: resolved })
        .eq("candidate_profile_id", profile.id)
        .eq("skill", row.skill)
        .is("skill_id", null);
    }

    const skillsToInsert: Array<{
      candidate_profile_id: string;
      skill: string;
      skill_id: string | null;
      level: string | null;
    }> = [];

    for (const item of finalExtractedSkills) {
      const key = item.skill.toLowerCase();
      if (existingSkillKeys.has(key)) continue;
      existingSkillKeys.add(key);

      skillsToInsert.push({
        candidate_profile_id: String(profile.id),
        skill: item.skill,
        skill_id: resolveSkillId(item.skill),
        level: item.level,
      });
    }

    if (skillsToInsert.length > 0) {
      await supabase.from("candidate_skills").insert(skillsToInsert);
    }

    const extractedYears =
      Number.isFinite(Number(parsed.years_experience))
        ? Math.max(0, Math.min(60, Number(parsed.years_experience)))
        : null;

    const currentYears =
      profile.years_experience === null || profile.years_experience === undefined
        ? null
        : Number(profile.years_experience);

    const yearsExperienceToStore = currentYears ?? extractedYears;
    const levelFromAi = parsed.seniority ?? null;
    const currentLevel = normalizeWhitespace(String(profile.experience_level ?? ""));

    const updatePayload: Record<string, unknown> = {
      resume_text: cvText || null,
      resume_summary: normalizeWhitespace(String(parsed.summary ?? "")).slice(0, 2000) || null,
      professional_bio_ai:
        normalizeWhitespace(String(parsed.professional_bio ?? "")).slice(0, 2500) || null,
      resume_analysis: {
        ...parsed,
        skills_added: skillsToInsert.length,
        extracted_from_cv: Boolean(cvText),
      },
      resume_last_analyzed_at: new Date().toISOString(),
    };

    if (yearsExperienceToStore !== null && Number.isFinite(yearsExperienceToStore)) {
      updatePayload.years_experience = yearsExperienceToStore;
    }

    if (!currentLevel && levelFromAi) {
      updatePayload.experience_level = levelFromAi;
    }

    const { error: updateError } = await supabase
      .from("candidate_profiles")
      .update(updatePayload)
      .eq("id", profile.id)
      .eq("user_id", profile.user_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile_id: profile.id,
        cv_text_chars: cvText.length,
        extracted_skills: finalExtractedSkills.length,
        inserted_skills: skillsToInsert.length,
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
