import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type ExtractedJobSkill = {
  skill: string;
  required: boolean;
  min_score: number | null;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSkillKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#]/g, "");
}

async function extractJobSkillsFromText(input: {
  title: string;
  description: string;
  experienceLevel: string;
  workMode: string;
  department: string;
  minYearsExperience: number | null;
}): Promise<ExtractedJobSkill[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extract structured job skills for hiring. Return strict JSON only. Be conservative and include only skills clearly implied by the role. Prefer concrete skills, frameworks, databases, platforms, and tools over vague soft skills.",
      },
      {
        role: "user",
        content: `
Extract job skills from this job post.
Return JSON of the form:
{
  "skills": [
    {
      "skill": string,
      "required": boolean,
      "min_score": number | null
    }
  ]
}

Rules:
- Use required=true only for core must-have skills.
- Use required=false for good-to-have or secondary technologies.
- min_score must be an integer from 0 to 100 when you can infer proficiency expectation, otherwise null.
- Infer stronger proficiency expectations for senior roles.
- Limit to the most relevant 12 skills.

Job title: ${input.title}
Experience level: ${input.experienceLevel}
Work mode: ${input.workMode}
Department: ${input.department}
Minimum years experience: ${input.minYearsExperience ?? "Not specified"}
Job description: ${input.description}
`,
      },
    ],
  });

  const raw = String(response.choices?.[0]?.message?.content ?? "{}");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const json = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : "{}";
  const parsed = JSON.parse(json) as { skills?: ExtractedJobSkill[] };

  return Array.isArray(parsed.skills)
    ? parsed.skills
        .map((item) => ({
          skill: normalizeWhitespace(String(item?.skill ?? "")),
          required: Boolean(item?.required),
          min_score:
            Number.isFinite(Number(item?.min_score)) && Number(item?.min_score) >= 0
              ? Math.max(0, Math.min(100, Math.round(Number(item?.min_score))))
              : null,
        }))
        .filter((item) => item.skill.length > 0)
    : [];
}

async function ensureStructuredJobSkills(jobId: string, job: {
  title?: string | null;
  description?: string | null;
  experience_level?: string | null;
  work_mode?: string | null;
  department?: string | null;
  min_years_experience?: number | null;
}) {
  const { data: existingRows, error: existingError } = await supabase
    .from("job_skills")
    .select("skill_id, required, min_score")
    .eq("job_id", jobId);

  if (existingError) throw existingError;
  if ((existingRows ?? []).length > 0) return;

  const extractedSkills = await extractJobSkillsFromText({
    title: String(job.title ?? ""),
    description: String(job.description ?? ""),
    experienceLevel: String(job.experience_level ?? ""),
    workMode: String(job.work_mode ?? ""),
    department: String(job.department ?? ""),
    minYearsExperience:
      typeof job.min_years_experience === "number" ? Number(job.min_years_experience) : null,
  });

  if (extractedSkills.length === 0) return;

  const { data: knownSkills } = await supabase
    .from("skills")
    .select("id, name");

  const skillRows = (knownSkills ?? []).map((row) => ({
    id: String(row.id),
    name: normalizeWhitespace(String(row.name ?? "")),
    lower: normalizeWhitespace(String(row.name ?? "")).toLowerCase(),
    key: normalizeSkillKey(String(row.name ?? "")),
  }));

  async function resolveOrCreateSkillId(skillName: string): Promise<string | null> {
    const key = normalizeSkillKey(skillName);
    const lower = normalizeWhitespace(skillName).toLowerCase();
    const exact = skillRows.find((row) => row.lower === lower || row.key === key);
    if (exact) return exact.id;

    const loose = skillRows.find((row) => key.length >= 5 && (row.key.includes(key) || key.includes(row.key)));
    if (loose) return loose.id;

    const { data: created, error: createError } = await supabase
      .from("skills")
      .insert({
        name: normalizeWhitespace(skillName),
        category: "Other",
      })
      .select("id, name")
      .single();

    if (createError || !created?.id) {
      console.error("Failed to create extracted job skill", { skillName, createError });
      return null;
    }

    skillRows.push({
      id: String(created.id),
      name: normalizeWhitespace(String(created.name ?? skillName)),
      lower: normalizeWhitespace(String(created.name ?? skillName)).toLowerCase(),
      key: normalizeSkillKey(String(created.name ?? skillName)),
    });

    return String(created.id);
  }

  const seen = new Set<string>();
  const rowsToInsert: Array<{ job_id: string; skill_id: string; required: boolean; min_score: number | null }> = [];

  for (const extractedSkill of extractedSkills) {
    const skillId = await resolveOrCreateSkillId(extractedSkill.skill);
    if (!skillId || seen.has(skillId)) continue;
    seen.add(skillId);
    rowsToInsert.push({
      job_id: jobId,
      skill_id: skillId,
      required: extractedSkill.required,
      min_score: extractedSkill.min_score,
    });
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("job_skills").insert(rowsToInsert);
    if (insertError) throw insertError;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { job_id, skip_credit = false } = await req.json();

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, employer_id, title, description, location, employment_type, work_mode, department, min_years_experience, salary_min, salary_max, benefits, experience_level")
      .eq("id", job_id)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await ensureStructuredJobSkills(String(job.id), job);

    let current: number | null = null;
    if (!skip_credit) {
      const { data: creditRow } = await supabase
        .from("employer_credits")
        .select("id, remaining")
        .eq("employer_id", job.employer_id)
        .eq("credit_type", "ai_credit")
        .maybeSingle();

      current = Number(creditRow?.remaining ?? 0);
      if (!creditRow?.id || current < 1) {
        return new Response(JSON.stringify({ error: "Insufficient ai_credit balance" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deductError } = await supabase
        .from("employer_credits")
        .update({ remaining: current - 1 })
        .eq("id", creditRow.id)
        .eq("remaining", current);

      if (deductError) {
        return new Response(
          JSON.stringify({ error: `Failed to deduct ai_credit: ${deductError.message}` }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const { data: jobSkills } = await supabase
      .from("job_skills")
      .select(`
        required,
        min_score,
        skills (
          name
        )
      `)
      .eq("job_id", job_id);

    const requiredSkills = (jobSkills ?? [])
      .filter((row) => Boolean(row.required))
      .map((row) => {
        const name = String((row as { skills?: { name?: string | null } | null }).skills?.name ?? "").trim();
        const minScore = Number((row as { min_score?: number | null }).min_score ?? 0);
        return name ? `${name}${minScore > 0 ? ` (${minScore}% proficiency)` : ""}` : "";
      })
      .filter((value) => value.length > 0)
      .join(", ");

    const optionalSkills = (jobSkills ?? [])
      .filter((row) => !row.required)
      .map((row) => String((row as { skills?: { name?: string | null } | null }).skills?.name ?? "").trim())
      .filter((value) => value.length > 0)
      .join(", ");

    const text = `
Job Title: ${job.title}
Job Description: ${job.description}
Location: ${job.location ?? ""}
Employment Type: ${job.employment_type ?? ""}
Work Mode: ${job.work_mode ?? ""}
Department: ${job.department ?? ""}
Experience Level: ${job.experience_level ?? ""}
Minimum Years Experience: ${job.min_years_experience ?? ""}
Salary Range: ${job.salary_min ?? ""} - ${job.salary_max ?? ""}
Benefits: ${job.benefits ?? ""}
Required Skills: ${requiredSkills}
Optional Skills: ${optionalSkills}
`;

    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    await supabase
      .from("jobs")
      .update({
        embedding: embedding.data[0].embedding,
      })
      .eq("id", job_id);

    if (!skip_credit) {
      await supabase.from("employer_credit_usage").insert({
        employer_id: job.employer_id,
        credit_type: "ai_credit",
        amount: 1,
        context_type: "job",
        context_id: job_id,
        metadata: { source: "generate-job-embedding" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        ai_credits_consumed: skip_credit ? 0 : 1,
        ai_credits_remaining: skip_credit ? null : (current as number) - 1,
        skip_credit: Boolean(skip_credit),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
