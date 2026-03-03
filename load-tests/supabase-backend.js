import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const errors = new Counter("scenario_errors");
const edgeLatency = new Trend("edge_latency", true);
const restLatency = new Trend("rest_latency", true);

function requiredEnv(name) {
  const value = (__ENV[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseCsvEnv(name) {
  const raw = (__ENV[name] || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function pickOne(values) {
  if (!values.length) return null;
  return values[Math.floor(Math.random() * values.length)];
}

const SUPABASE_URL = requiredEnv("SUPABASE_URL").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = requiredEnv("SUPABASE_ANON_KEY");

const EMPLOYER_JWTS = parseCsvEnv("EMPLOYER_JWTS");
const CANDIDATE_JWTS = parseCsvEnv("CANDIDATE_JWTS");
const JOB_IDS = parseCsvEnv("JOB_IDS");
const APPLICATION_IDS = parseCsvEnv("APPLICATION_IDS");
const CONVERSATION_IDS = parseCsvEnv("CONVERSATION_IDS");

function authHeaders(jwt) {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${jwt}`,
  };
}

function edgePost(functionName, jwt, payload) {
  const res = http.post(
    `${SUPABASE_URL}/functions/v1/${functionName}`,
    JSON.stringify(payload),
    {
      headers: authHeaders(jwt),
      tags: { target: functionName, kind: "edge" },
    },
  );
  edgeLatency.add(res.timings.duration, { target: functionName });
  return res;
}

function restGet(path, jwt, tag) {
  const res = http.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(jwt),
    tags: { target: tag, kind: "rest" },
  });
  restLatency.add(res.timings.duration, { target: tag });
  return res;
}

export const options = {
  discardResponseBodies: false,
  scenarios: {
    auto_match: {
      executor: "ramping-arrival-rate",
      exec: "autoMatchScenario",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 50,
      stages: [
        { target: 3, duration: "1m" },
        { target: 10, duration: "3m" },
        { target: 0, duration: "1m" },
      ],
    },
    authorize_candidate_view: {
      executor: "ramping-arrival-rate",
      exec: "authorizeCandidateViewScenario",
      startTime: "10s",
      startRate: 2,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 60,
      stages: [
        { target: 10, duration: "1m" },
        { target: 20, duration: "3m" },
        { target: 0, duration: "1m" },
      ],
    },
    feature_job: {
      executor: "ramping-arrival-rate",
      exec: "featureJobScenario",
      startTime: "20s",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 5,
      maxVUs: 20,
      stages: [
        { target: 2, duration: "1m" },
        { target: 5, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
    generate_ai_report: {
      executor: "ramping-arrival-rate",
      exec: "generateAiReportScenario",
      startTime: "30s",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 5,
      maxVUs: 20,
      stages: [
        { target: 2, duration: "1m" },
        { target: 4, duration: "2m" },
        { target: 0, duration: "1m" },
      ],
    },
    rest_reads: {
      executor: "ramping-arrival-rate",
      exec: "restReadScenario",
      startTime: "5s",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { target: 30, duration: "1m" },
        { target: 80, duration: "4m" },
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:edge}": ["p(95)<2500", "p(99)<5000"],
    "http_req_duration{kind:rest}": ["p(95)<600", "p(99)<1200"],
    scenario_errors: ["count<100"],
  },
};

export function setup() {
  if (!EMPLOYER_JWTS.length) {
    throw new Error("EMPLOYER_JWTS is required (comma-separated JWTs).");
  }
  if (!JOB_IDS.length) {
    throw new Error("JOB_IDS is required (comma-separated job UUIDs).");
  }
  return { ready: true };
}

export function autoMatchScenario() {
  const jwt = pickOne(EMPLOYER_JWTS);
  const jobId = pickOne(JOB_IDS);
  if (!jwt || !jobId) return;

  const res = edgePost("auto-match", jwt, { job_id: jobId });

  const ok = check(res, {
    "auto-match status ok": (r) => [200, 402, 409].includes(r.status),
    "auto-match response json": (r) => !!r.body,
  });

  if (!ok) errors.add(1);
  sleep(Math.random() * 0.4);
}

export function authorizeCandidateViewScenario() {
  const jwt = pickOne(EMPLOYER_JWTS);
  const applicationId = pickOne(APPLICATION_IDS);
  if (!jwt || !applicationId) return;

  const res = edgePost("authorize-candidate-view", jwt, { applicationId });

  const ok = check(res, {
    "authorize-view status ok": (r) => [200, 402, 404, 409].includes(r.status),
    "authorize-view response json": (r) => !!r.body,
  });

  if (!ok) errors.add(1);
  sleep(Math.random() * 0.3);
}

export function featureJobScenario() {
  const jwt = pickOne(EMPLOYER_JWTS);
  const jobId = pickOne(JOB_IDS);
  if (!jwt || !jobId) return;

  const res = edgePost("feature-job", jwt, { jobId, days: 7 });

  const ok = check(res, {
    "feature-job status ok": (r) => [200, 402, 404, 409].includes(r.status),
  });

  if (!ok) errors.add(1);
  sleep(Math.random() * 0.5);
}

export function generateAiReportScenario() {
  const jwt = pickOne(EMPLOYER_JWTS);
  const jobId = pickOne(JOB_IDS);
  if (!jwt || !jobId) return;

  const res = edgePost("generate-ai-report", jwt, { jobId });

  const ok = check(res, {
    "generate-ai-report status ok": (r) => [200, 402, 404, 409].includes(r.status),
  });

  if (!ok) errors.add(1);
  sleep(Math.random() * 0.6);
}

export function restReadScenario() {
  const employerJwt = pickOne(EMPLOYER_JWTS);
  const candidateJwt = pickOne(CANDIDATE_JWTS.length ? CANDIDATE_JWTS : EMPLOYER_JWTS);
  if (!employerJwt) return;

  const jobsRes = restGet(
    "jobs?select=id,title,status,created_at&status=eq.open&order=created_at.desc&limit=20",
    candidateJwt || employerJwt,
    "jobs-list",
  );
  const convRes = restGet(
    "conversations?select=id,last_message_at,created_at&order=last_message_at.desc.nullslast&limit=20",
    employerJwt,
    "conversations-list",
  );

  let msgRes = null;
  const conversationId = pickOne(CONVERSATION_IDS);
  if (conversationId && employerJwt) {
    msgRes = restGet(
      `messages?select=id,created_at,sender_role&conversation_id=eq.${conversationId}&order=created_at.desc&limit=30`,
      employerJwt,
      "messages-list",
    );
  }

  const ok = check(jobsRes, {
    "jobs-list status ok": (r) => r.status === 200,
  }) &&
    check(convRes, {
      "conversations-list status ok": (r) => r.status === 200,
    }) &&
    (msgRes
      ? check(msgRes, {
          "messages-list status ok": (r) => r.status === 200,
        })
      : true);

  if (!ok) errors.add(1);
  sleep(Math.random() * 0.2);
}
