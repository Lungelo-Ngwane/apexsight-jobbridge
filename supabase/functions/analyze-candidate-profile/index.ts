import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANALYZER_VERSION = "2026-03-09-openai-pdf-ingest-v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExtractedSkill = {
  skill: string;
  category?: string | null;
  level?: "beginner" | "intermediate" | "advanced" | "expert" | null;
};

type ExtractedPayload = {
  extracted_resume_text?: string | null;
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

const allowedSkillCategories = new Set([
  "Programming Language",
  "Frontend",
  "Backend",
  "Database",
  "Cloud",
  "DevOps",
  "AI/ML",
  "Data",
  "Tool",
  "Architecture",
  "Security",
  "Mobile",
  "Microsoft",
  "Certification",
  "Platform",
  "IT",
  "Design",
  "Other",
]);

function normalizeSkillCategory(value: unknown): string | null {
  const normalized = normalizeWhitespace(String(value ?? ""));
  if (!normalized) return null;
  const directMatch = Array.from(allowedSkillCategories).find(
    (category) => category.toLowerCase() === normalized.toLowerCase(),
  );
  return directMatch ?? "Other";
}

function experienceLevelRank(value: string | null): number {
  if (value === "junior") return 1;
  if (value === "mid") return 2;
  if (value === "senior") return 3;
  return 0;
}

function skillLevelRank(value: "beginner" | "intermediate" | "advanced" | "expert" | null): number {
  if (value === "beginner") return 1;
  if (value === "intermediate") return 2;
  if (value === "advanced") return 3;
  if (value === "expert") return 4;
  return 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function inflateBytes(bytes: Uint8Array): Promise<string> {
  for (const format of ["deflate-raw", "deflate"]) {
    try {
      const stream = new Response(bytes).body;
      if (!stream) continue;
      const decompressed = stream.pipeThrough(
        new DecompressionStream(format as "deflate" | "deflate-raw"),
      );
      const buffer = await new Response(decompressed).arrayBuffer();
      return new TextDecoder("latin1", { fatal: false }).decode(buffer);
    } catch {
      // Try the next decompression format.
    }
  }

  return "";
}

function decodePdfEscapes(value: string): string {
  let output = "";
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== "\\") {
      output += char;
      continue;
    }

    const next = value[i + 1] ?? "";
    if (next === "n") {
      output += "\n";
      i += 1;
      continue;
    }
    if (next === "r") {
      output += "\r";
      i += 1;
      continue;
    }
    if (next === "t") {
      output += "\t";
      i += 1;
      continue;
    }
    if (next === "b") {
      output += "\b";
      i += 1;
      continue;
    }
    if (next === "f") {
      output += "\f";
      i += 1;
      continue;
    }
    if (next === "(" || next === ")" || next === "\\") {
      output += next;
      i += 1;
      continue;
    }
    if (/[0-7]/.test(next)) {
      let octal = next;
      let consumed = 1;
      while (consumed < 3 && /[0-7]/.test(value[i + 1 + consumed] ?? "")) {
        octal += value[i + 1 + consumed];
        consumed += 1;
      }
      output += String.fromCharCode(parseInt(octal, 8));
      i += consumed;
      continue;
    }

    output += next;
    i += 1;
  }

  return output;
}

function extractBalancedPdfStrings(value: string): string[] {
  const strings: string[] = [];

  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== "(") continue;

    let depth = 1;
    let escaped = false;
    let current = "";

    for (let j = i + 1; j < value.length; j += 1) {
      const char = value[j];

      if (escaped) {
        current += `\\${char}`;
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "(") {
        depth += 1;
        current += char;
        continue;
      }

      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          strings.push(decodePdfEscapes(current));
          i = j;
          break;
        }
        current += char;
        continue;
      }

      current += char;
    }
  }

  return strings;
}

function decodePdfHexString(value: string): string {
  const cleaned = value.replace(/[^0-9a-f]/gi, "");
  const even = cleaned.length % 2 === 0 ? cleaned : `${cleaned}0`;
  const bytes = new Uint8Array(even.length / 2);

  for (let i = 0; i < even.length; i += 2) {
    bytes[i / 2] = Number.parseInt(even.slice(i, i + 2), 16);
  }

  return new TextDecoder("latin1", { fatal: false }).decode(bytes);
}

function collectPdfTextFragments(value: string): string[] {
  const fragments = [
    ...extractBalancedPdfStrings(value),
    ...[...value.matchAll(/<([0-9a-f\s]+)>/gi)].map((match) => decodePdfHexString(String(match[1] ?? ""))),
  ];

  return fragments
    .map((fragment) => normalizeWhitespace(fragment))
    .filter((fragment) => /[A-Za-z]/.test(fragment) && fragment.length >= 2);
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const latin1 = new TextDecoder("latin1", { fatal: false }).decode(bytes);
    const sections: string[] = [latin1];
    const streamPattern = /<<(.*?)>>\s*stream\r?\n/gs;

    for (const match of latin1.matchAll(streamPattern)) {
      const dictionary = String(match[1] ?? "");
      const start = (match.index ?? 0) + match[0].length;
      const end = latin1.indexOf("endstream", start);
      if (end === -1) continue;

      let raw = bytes.slice(start, end);
      if (raw.length === 0) continue;
      while (raw[0] === 0x0d || raw[0] === 0x0a) raw = raw.slice(1);
      if (raw.length === 0) continue;
      while (raw[raw.length - 1] === 0x0d || raw[raw.length - 1] === 0x0a) raw = raw.slice(0, -1);
      if (raw.length === 0) continue;

      if (/\/FlateDecode\b/.test(dictionary)) {
        const inflated = await inflateBytes(raw);
        if (inflated) sections.push(inflated);
      } else {
        sections.push(new TextDecoder("latin1", { fatal: false }).decode(raw));
      }
    }

    const text = normalizeWhitespace(
      sections
        .flatMap((section) => collectPdfTextFragments(section))
        .join(" "),
    );

    return text.slice(0, 60000);
  } catch (error) {
    console.error("Failed to parse PDF text from content streams", error);
    return "";
  }
}

async function extractReadableTextFallback(bytes: Uint8Array, filePath: string): Promise<string> {
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

async function extractReadableText(bytes: Uint8Array, filePath: string): Promise<string> {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    const parsedPdfText = await extractPdfText(bytes);
    if (parsedPdfText.trim().length > 0) {
      return parsedPdfText;
    }
  }

  return await extractReadableTextFallback(bytes, filePath);
}

function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return "{}";
  return raw.slice(start, end + 1);
}

function getResponseText(response: unknown): string {
  const direct = String((response as { output_text?: string | null })?.output_text ?? "").trim();
  if (direct) return direct;

  const output = (response as { output?: Array<{ content?: Array<{ text?: string; type?: string }> }> })
    ?.output;

  if (!Array.isArray(output)) return "";

  const chunks = output.flatMap((item) =>
    Array.isArray(item?.content)
      ? item.content
          .map((content) => String(content?.text ?? "").trim())
          .filter((text) => text.length > 0)
      : [],
  );

  return chunks.join("\n").trim();
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function extractStructuredDataFromPdfWithOpenAI(params: {
  openaiApiKey: string;
  fileBytes: Uint8Array;
  filePath: string;
  profile: {
    full_name?: string | null;
    headline?: string | null;
    bio?: string | null;
  };
  existingSkills: string[];
}): Promise<ExtractedPayload | null> {
  const ext = params.filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "pdf") return null;

  const base64 = uint8ArrayToBase64(params.fileBytes);
  const fileName = params.filePath.split("/").pop() || "resume.pdf";

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      extracted_resume_text: { type: ["string", "null"] },
      professional_bio: { type: ["string", "null"] },
      years_experience: { type: ["number", "null"] },
      seniority: { type: ["string", "null"], enum: ["junior", "mid", "senior", null] },
      skills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            skill: { type: "string" },
            category: {
              type: ["string", "null"],
              enum: Array.from(allowedSkillCategories).concat([null]),
            },
            level: {
              type: ["string", "null"],
              enum: ["beginner", "intermediate", "advanced", "expert", null],
            },
          },
          required: ["skill", "category", "level"],
        },
      },
      work_experience: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: ["string", "null"] },
            company: { type: ["string", "null"] },
            years: { type: ["number", "null"] },
          },
          required: ["title", "company", "years"],
        },
      },
      summary: { type: ["string", "null"] },
    },
    required: [
      "extracted_resume_text",
      "professional_bio",
      "years_experience",
      "seniority",
      "skills",
      "work_experience",
      "summary",
    ],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract structured candidate profile data from this CV PDF.
Return strict JSON only.

Requirements:
- Include a faithful plain-text transcription of the CV in extracted_resume_text.
- Be exhaustive with explicitly mentioned skills, tools, libraries, frameworks, cloud platforms, databases, certifications, methodologies, and software.
- Do not infer skills that are not clearly present in the CV.
- Assign each skill the best-fit category from this list only: Programming Language, Frontend, Backend, Database, Cloud, DevOps, AI/ML, Data, Tool, Architecture, Security, Mobile, Microsoft, Certification, Platform, IT, Design, Other.
- Preserve acronyms exactly when present, for example SQL, AWS, ETL, PKI, DAX, CI/CD.
- Infer skill level conservatively from evidence in the CV when possible. Use null only when there is not enough signal.
- If years of experience are not explicit, estimate conservatively from the CV chronology only when reasonably inferable, otherwise null.

Candidate context:
Full Name: ${String(params.profile.full_name ?? "")}
Headline: ${String(params.profile.headline ?? "")}
Bio: ${String(params.profile.bio ?? "")}
Existing Skills: ${params.existingSkills.join(", ")}`,
            },
            {
              type: "input_file",
              filename: fileName,
              file_data: `data:application/pdf;base64,${base64}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "candidate_resume_analysis",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI PDF extraction failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const rawText = getResponseText(payload);
  if (!rawText) {
    throw new Error("OpenAI PDF extraction returned no text output");
  }

  return JSON.parse(extractJsonObject(rawText)) as ExtractedPayload;
}

Deno.serve(async (req) => {
  console.log("analyze-candidate-profile version", ANALYZER_VERSION);

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
    let parsed: ExtractedPayload = {};
    let extractionMethod: "openai_pdf" | "text_fallback" | "none" = "none";
    if (profile.cv_url) {
      const { data: cvBlob, error: cvError } = await supabase.storage
        .from("resume")
        .download(String(profile.cv_url));

      if (!cvError && cvBlob) {
        const bytes = new Uint8Array(await cvBlob.arrayBuffer());
        const existingSkills = Array.isArray(profile.candidate_skills)
          ? profile.candidate_skills
              .map((row) => {
                const skill = normalizeWhitespace(String(row.skill ?? ""));
                const level = toLevel(row.level);
                return skill ? `${skill}${level ? ` (${level})` : ""}` : "";
              })
              .filter((value) => value.length > 0)
          : [];

        try {
          const extracted = await extractStructuredDataFromPdfWithOpenAI({
            openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
            fileBytes: bytes,
            filePath: String(profile.cv_url),
            profile,
            existingSkills,
          });

          if (extracted) {
            parsed = extracted;
            cvText = normalizeWhitespace(String(extracted.extracted_resume_text ?? "")).slice(0, 60000);
            extractionMethod = "openai_pdf";
          }
        } catch (error) {
          console.error("Failed OpenAI PDF extraction, falling back to text parsing", error);
        }

        if (!cvText) {
          cvText = await extractReadableText(bytes, String(profile.cv_url));
          extractionMethod = cvText ? "text_fallback" : "none";
        }
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

    if (!parsed.extracted_resume_text && resumeInput.trim()) {
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
              "Extract candidate profile information from resume/profile text. Return strict JSON only. Use null for missing values. Be exhaustive with explicitly mentioned skills, tools, frameworks, cloud platforms, databases, certifications, and methodologies.",
          },
          {
            role: "user",
            content: `
Extract structured profile data for job matching.
Required JSON shape:
{
  "extracted_resume_text": string | null,
  "professional_bio": string | null,
  "years_experience": number | null,
  "seniority": "junior" | "mid" | "senior" | null,
  "skills": [{"skill": string, "category": string | null, "level": "beginner" | "intermediate" | "advanced" | "expert" | null}],
  "work_experience": [{"title": string | null, "company": string | null, "years": number | null}],
  "summary": string | null
}
Instructions:
- Include every explicitly mentioned skill, technology, platform, framework, library, tool, certification, and methodology.
- Do not limit the skills list to only the most important items.
- Assign each skill the best-fit category from this list only: Programming Language, Frontend, Backend, Database, Cloud, DevOps, AI/ML, Data, Tool, Architecture, Security, Mobile, Microsoft, Certification, Platform, IT, Design, Other.
- Preserve acronyms when they appear in the source, for example SQL, PKI, AWS, ETL, DAX.
- Include both broad platforms and concrete tools when explicitly present, for example Azure and Power BI.
- Infer skill levels conservatively from context such as years of use, senior titles, leadership, architecture ownership, or repeated work evidence. Use null only when unclear.
Source:
${resumeInput.slice(0, 50000)}
`,
          },
        ],
      });

      const rawContent = String(extraction.choices?.[0]?.message?.content ?? "{}");
      parsed = JSON.parse(extractJsonObject(rawContent)) as ExtractedPayload;
    }

    const extractedSkills = Array.isArray(parsed.skills)
      ? parsed.skills
          .map((item) => ({
            skill: normalizeWhitespace(String(item?.skill ?? "")),
            category: normalizeSkillCategory(item?.category),
            level: toLevel(item?.level),
          }))
          .filter((item) => item.skill.length > 0)
      : [];

    const { data: knownSkills } = await supabase
      .from("skills")
      .select("id, name, category");

    const skillRows = (knownSkills ?? []).map((row) => ({
      id: String(row.id),
      name: normalizeWhitespace(String(row.name ?? "")),
      category: normalizeSkillCategory(row.category),
      lower: normalizeWhitespace(String(row.name ?? "")).toLowerCase(),
      key: normalizeSkillKey(normalizeWhitespace(String(row.name ?? ""))),
    }));

    const skillAliasMap: Record<string, string[]> = {
      javascript: ["javascript", "js", "ecmascript"],
      typescript: ["typescript", "ts"],
      react: ["react", "reactjs", "react.js"],
      "node.js": ["node.js", "nodejs", "node js"],
      "next.js": ["next.js", "nextjs", "next js"],
      sql: ["sql", "t-sql", "tsql"],
      "power bi": ["power bi", "powerbi"],
      "power bi dax": ["power bi dax", "dax"],
      "power query": ["power query", "powerquery"],
      postgresql: ["postgresql", "postgres", "postgre sql"],
      mongodb: ["mongodb", "mongo db", "mongo"],
      azure: ["azure", "microsoft azure"],
      aws: ["aws", "amazon web services"],
      etl: ["etl", "data pipelines"],
      tableau: ["tableau"],
      python: ["python", "py"],
      git: ["git", "git version control"],
      figma: ["figma"],
      "rest api development": ["rest api", "rest apis", "restful api", "restful apis"],
      html: ["html", "html5"],
      css: ["css", "css3"],
      "tailwind css": ["tailwind", "tailwind css"],
      excel: ["excel", "microsoft excel"],
      "data visualization": ["data visualization", "data visualisation", "dashboarding"],
      pki: ["pki", "public key infrastructure"],
    };

    function skillMentionPattern(term: string): RegExp | null {
      const tokens = term.toLowerCase().match(/[a-z0-9+#]+/g) ?? [];
      if (tokens.length === 0) return null;

      const onlyToken = tokens.length === 1 ? tokens[0] : "";
      const shortTokenWhitelist = new Set(["sql", "aws", "css", "api", "etl", "dax", "pki"]);
      if (
        tokens.length === 1 &&
        onlyToken.length < 4 &&
        !onlyToken.includes("+") &&
        !onlyToken.includes("#") &&
        !shortTokenWhitelist.has(onlyToken)
      ) {
        return null;
      }

      return new RegExp(
        `(^|[^a-z0-9+#])${tokens.map(escapeRegExp).join("[\\s./,&()+-]*")}([^a-z0-9+#]|$)`,
        "i",
      );
    }

    // Also detect skills by direct CV text mention to ensure CV skills get added,
    // even if the model under-extracts them.
    const cvLower = cvText.toLowerCase();
    const detectedSkillKeys = new Set<string>();
    const detectedFromCv: Array<{
      skill: string;
      category: string | null;
      level: "beginner" | "intermediate" | "advanced" | "expert" | null;
    }> = [];

    for (const row of skillRows) {
      const pattern = skillMentionPattern(row.name);
      if (!pattern) continue;
      if (!pattern.test(cvLower)) continue;

      const key = normalizeSkillKey(row.name);
      if (detectedSkillKeys.has(key)) continue;
      detectedSkillKeys.add(key);
      detectedFromCv.push({
        skill: row.name,
        category: row.category,
        level: null,
      });
    }

    for (const [canonicalName, aliases] of Object.entries(skillAliasMap)) {
      const resolvedId = resolveSkillId(canonicalName);
      const resolvedSkill = skillRows.find((row) => row.id === resolvedId);
      if (!resolvedSkill) continue;

      const aliasMatched = aliases.some((alias) => {
        const pattern = skillMentionPattern(alias);
        return pattern ? pattern.test(cvLower) : false;
      });

      if (!aliasMatched) continue;

      const key = normalizeSkillKey(resolvedSkill.name);
      if (detectedSkillKeys.has(key)) continue;
      detectedSkillKeys.add(key);
      detectedFromCv.push({
        skill: resolvedSkill.name,
        category: resolvedSkill.category,
        level: null,
      });
    }

    const mergedSkillMap = new Map<
      string,
      { skill: string; category: string | null; level: "beginner" | "intermediate" | "advanced" | "expert" | null }
    >();
    for (const item of [...extractedSkills, ...detectedFromCv]) {
      const key = normalizeSkillKey(item.skill);
      if (!key) continue;
      if (!mergedSkillMap.has(key)) {
        mergedSkillMap.set(key, { skill: item.skill, category: item.category ?? null, level: item.level });
        continue;
      }
      const existing = mergedSkillMap.get(key)!;
      mergedSkillMap.set(key, {
        skill: existing.skill,
        category: existing.category ?? item.category ?? null,
        level: existing.level ?? item.level,
      });
    }

    const finalExtractedSkills = Array.from(mergedSkillMap.values());

    const aliasMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      nodejs: "node.js",
      node: "node.js",
      reactjs: "react",
      nextjs: "next.js",
      py: "python",
      postgres: "postgresql",
      gcp: "google cloud platform",
      googlecloud: "google cloud platform",
      tailwindcss: "tailwind css",
      aspnet: "asp.net core",
      vscode: "visual studio code",
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
      const needle = normalizeWhitespace(rawSkill).toLowerCase();
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

      const broadMatches = skillRows.filter(
        (row) =>
          (needle.length >= 5 && row.lower.includes(needle)) ||
          (row.lower.length >= 5 && needle.includes(row.lower)) ||
          (key.length >= 5 && row.key.includes(key)) ||
          (row.key.length >= 5 && key.includes(row.key)),
      );

      if (broadMatches.length === 1) {
        return broadMatches[0].id;
      }

      return null;
    }

    async function resolveOrCreateSkillId(rawSkill: string, category: string | null): Promise<string | null> {
      const resolved = resolveSkillId(rawSkill);
      if (resolved) return resolved;

      const normalizedName = normalizeWhitespace(rawSkill);
      if (!normalizedName) return null;

      const { data: existing } = await supabase
        .from("skills")
        .select("id, name, category")
        .ilike("name", normalizedName)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const row = {
          id: String(existing.id),
          name: normalizeWhitespace(String(existing.name ?? normalizedName)),
          category: normalizeSkillCategory(existing.category),
          lower: normalizeWhitespace(String(existing.name ?? normalizedName)).toLowerCase(),
          key: normalizeSkillKey(normalizeWhitespace(String(existing.name ?? normalizedName))),
        };
        skillRows.push(row);
        return row.id;
      }

      const { data: created, error: createError } = await supabase
        .from("skills")
        .insert({
          name: normalizedName,
          category: normalizeSkillCategory(category),
        })
        .select("id, name, category")
        .single();

      if (createError || !created?.id) {
        console.error("Failed to create skill from CV analysis", {
          skill: normalizedName,
          category,
          error: createError,
        });
        return null;
      }

      skillRows.push({
        id: String(created.id),
        name: normalizeWhitespace(String(created.name ?? normalizedName)),
        category: normalizeSkillCategory(created.category),
        lower: normalizeWhitespace(String(created.name ?? normalizedName)).toLowerCase(),
        key: normalizeSkillKey(normalizeWhitespace(String(created.name ?? normalizedName))),
      });

      return String(created.id);
    }

    const { data: currentSkillRows } = await supabase
      .from("candidate_skills")
      .select("id, skill, skill_id, level")
      .eq("candidate_profile_id", profile.id);

    const existingSkillKeys = new Set(
      (currentSkillRows ?? []).map((row) => normalizeWhitespace(String(row.skill ?? "")).toLowerCase()),
    );

    const currentRowsMissingSkillId = (currentSkillRows ?? []).filter(
      (row) => !row.skill_id && String(row.skill ?? "").trim().length > 0,
    );

    for (const row of currentRowsMissingSkillId) {
      const candidateSkill = normalizeWhitespace(String(row.skill ?? ""));
      const resolved = await resolveOrCreateSkillId(candidateSkill, null);
      if (!resolved) continue;

      await supabase
        .from("candidate_skills")
        .update({ skill_id: resolved })
        .eq("candidate_profile_id", profile.id)
        .eq("skill", row.skill)
        .is("skill_id", null);
    }

    const extractedByKey = new Map(
      finalExtractedSkills.map((item) => [normalizeSkillKey(item.skill), item] as const),
    );

    for (const row of currentSkillRows ?? []) {
      const key = normalizeSkillKey(String(row.skill ?? ""));
      const extracted = extractedByKey.get(key);
      if (!extracted?.level) continue;

      const currentLevel = toLevel(row.level);
      if (skillLevelRank(extracted.level) <= skillLevelRank(currentLevel)) continue;

      await supabase
        .from("candidate_skills")
        .update({ level: extracted.level })
        .eq("id", row.id)
        .eq("candidate_profile_id", profile.id);
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

      const resolvedSkillId = await resolveOrCreateSkillId(item.skill, item.category ?? null);
      if (!resolvedSkillId) continue;

      skillsToInsert.push({
        candidate_profile_id: String(profile.id),
        skill: item.skill,
        skill_id: resolvedSkillId,
        level: item.level,
      });
    }

    if (skillsToInsert.length > 0) {
      await supabase.from("candidate_skills").insert(skillsToInsert);
    }

    const cvTextPreview = cvText.slice(0, 4000);
    const resolvedSkillDebug = finalExtractedSkills.map((item) => ({
      skill: item.skill,
      category: item.category ?? null,
      level: item.level,
      resolved_skill_id: skillRows.find((row) => row.key === normalizeSkillKey(item.skill) || row.lower === item.skill.toLowerCase())?.id ?? null,
    }));

    const extractedYears =
      Number.isFinite(Number(parsed.years_experience))
        ? Math.max(0, Math.min(60, Number(parsed.years_experience)))
        : null;

    const currentYears =
      profile.years_experience === null || profile.years_experience === undefined
        ? null
        : Number(profile.years_experience);

    const yearsExperienceToStore =
      currentYears === null
        ? extractedYears
        : extractedYears === null
          ? currentYears
          : Math.max(currentYears, extractedYears);
    const levelFromAi = parsed.seniority ?? null;
    const currentLevel = normalizeWhitespace(String(profile.experience_level ?? ""));
    const currentLevelNormalized =
      currentLevel === "junior" || currentLevel === "mid" || currentLevel === "senior"
        ? currentLevel
        : null;

    const updatePayload: Record<string, unknown> = {
      resume_text: cvText || null,
      resume_summary: normalizeWhitespace(String(parsed.summary ?? "")).slice(0, 2000) || null,
      professional_bio_ai:
        normalizeWhitespace(String(parsed.professional_bio ?? "")).slice(0, 2500) || null,
      resume_analysis: {
        ...parsed,
        skills_added: skillsToInsert.length,
        extracted_from_cv: Boolean(cvText),
        debug: {
          analyzer_version: ANALYZER_VERSION,
          extraction_method: extractionMethod,
          cv_text_length: cvText.length,
          cv_text_preview: cvTextPreview,
          existing_skills_before_analysis: existingSkills,
          model_extracted_skills: extractedSkills,
          regex_detected_skills: detectedFromCv,
          merged_skills_before_resolution: finalExtractedSkills,
          resolved_skills: resolvedSkillDebug,
          inserted_skills: skillsToInsert,
        },
      },
      resume_last_analyzed_at: new Date().toISOString(),
    };

    if (yearsExperienceToStore !== null && Number.isFinite(yearsExperienceToStore)) {
      updatePayload.years_experience = yearsExperienceToStore;
    }

    if (levelFromAi && experienceLevelRank(levelFromAi) >= experienceLevelRank(currentLevelNormalized)) {
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
