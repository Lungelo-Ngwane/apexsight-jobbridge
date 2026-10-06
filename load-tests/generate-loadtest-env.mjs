import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function parsePositiveInt(name, fallback) {
  const raw = optionalEnv(name, String(fallback));
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function listAllAuthUsers(serviceClient, maxPages = 20, perPage = 1000) {
  const users = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const pageUsers = data?.users ?? [];
    users.push(...pageUsers);
    if (pageUsers.length < perPage) break;
  }
  return users;
}

async function buildJwtList(anonClient, emails, password, maxCount) {
  const jwtList = [];
  for (const email of emails) {
    if (jwtList.length >= maxCount) break;
    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.session?.access_token) {
      // Continue on partial failures so one bad account does not block test setup.
      continue;
    }
    jwtList.push(data.session.access_token);
  }
  return jwtList;
}

async function main() {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const employerPassword = requiredEnv("TEST_EMPLOYER_PASSWORD");
  const candidatePassword = optionalEnv("TEST_CANDIDATE_PASSWORD", employerPassword);

  const maxEmployerUsers = parsePositiveInt("MAX_EMPLOYER_USERS", 5);
  const maxCandidateUsers = parsePositiveInt("MAX_CANDIDATE_USERS", 5);
  const maxJobIds = parsePositiveInt("MAX_JOB_IDS", 30);
  const maxApplicationIds = parsePositiveInt("MAX_APPLICATION_IDS", 50);
  const maxConversationIds = parsePositiveInt("MAX_CONVERSATION_IDS", 30);
  const writeEnvFile = optionalEnv("WRITE_ENV_FILE", "true").toLowerCase() !== "false";

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let profileRows = [];
  let profileKey = "user_id";
  {
    const userIdAttempt = await serviceClient
      .from("profiles")
      .select("user_id, role")
      .in("role", ["employer", "candidate"]);

    if (!userIdAttempt.error) {
      profileRows = userIdAttempt.data ?? [];
      profileKey = "user_id";
    } else if (String(userIdAttempt.error.code) === "42703") {
      const idAttempt = await serviceClient
        .from("profiles")
        .select("id, role")
        .in("role", ["employer", "candidate"]);

      if (idAttempt.error) throw idAttempt.error;
      profileRows = idAttempt.data ?? [];
      profileKey = "id";
    } else {
      throw userIdAttempt.error;
    }
  }

  const employerUserIds = Array.from(
    new Set(
      (profileRows ?? [])
        .filter((row) => String(row.role ?? "").toLowerCase() === "employer")
        .map((row) => String(row[profileKey] ?? "").trim())
        .filter(Boolean),
    ),
  );
  const candidateUserIds = Array.from(
    new Set(
      (profileRows ?? [])
        .filter((row) => String(row.role ?? "").toLowerCase() === "candidate")
        .map((row) => String(row[profileKey] ?? "").trim())
        .filter(Boolean),
    ),
  );

  const authUsers = await listAllAuthUsers(serviceClient);
  const emailByUserId = new Map(
    authUsers
      .map((user) => [String(user.id), String(user.email ?? "").trim()])
      .filter(([, email]) => email.length > 0),
  );

  const employerEmails = employerUserIds
    .map((id) => emailByUserId.get(id) ?? "")
    .filter(Boolean)
    .slice(0, maxEmployerUsers * 4);
  const candidateEmails = candidateUserIds
    .map((id) => emailByUserId.get(id) ?? "")
    .filter(Boolean)
    .slice(0, maxCandidateUsers * 4);

  const employerJwts = await buildJwtList(
    anonClient,
    employerEmails,
    employerPassword,
    maxEmployerUsers,
  );
  const candidateJwts = await buildJwtList(
    anonClient,
    candidateEmails,
    candidatePassword,
    maxCandidateUsers,
  );

  const { data: jobs, error: jobsError } = await serviceClient
    .from("jobs")
    .select("id")
    .eq("status", "open")
    .limit(maxJobIds);
  if (jobsError) throw jobsError;

  const { data: applications, error: applicationsError } = await serviceClient
    .from("job_applications")
    .select("id")
    .limit(maxApplicationIds);
  if (applicationsError) throw applicationsError;

  const { data: conversations, error: conversationsError } = await serviceClient
    .from("conversations")
    .select("id")
    .limit(maxConversationIds);
  if (conversationsError) throw conversationsError;

  const env = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: anonKey,
    EMPLOYER_JWTS: employerJwts.join(","),
    CANDIDATE_JWTS: candidateJwts.join(","),
    JOB_IDS: (jobs ?? []).map((row) => String(row.id)).join(","),
    APPLICATION_IDS: (applications ?? []).map((row) => String(row.id)).join(","),
    CONVERSATION_IDS: (conversations ?? []).map((row) => String(row.id)).join(","),
  };

  if (!env.EMPLOYER_JWTS) {
    throw new Error(
      "No employer JWTs were generated. Check TEST_EMPLOYER_PASSWORD and seeded employer users.",
    );
  }
  if (!env.JOB_IDS) {
    throw new Error("No open job IDs found. Seed open jobs first.");
  }

  const envText = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  console.log("Generated load-test configuration. Credentials are never printed.");
  if (writeEnvFile) {
    const outputPath = "load-tests/.env.generated";
    fs.writeFileSync(outputPath, `${envText}\n`, "utf8");
    console.log(`\nWrote ${outputPath}`);
  }
}

main().catch(() => {
  console.error("Load-test configuration generation failed. Check the isolated test environment and account configuration.");
  process.exit(1);
});
