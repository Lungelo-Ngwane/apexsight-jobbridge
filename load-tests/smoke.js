import http from "k6/http";
import { check } from "k6";

const SUPABASE_URL = (__ENV.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = (__ENV.SUPABASE_ANON_KEY || "").trim();
const EMPLOYER_JWT = (__ENV.EMPLOYER_JWT || "").trim();
const JOB_ID = (__ENV.JOB_ID || "").trim();
const APPLICATION_ID = (__ENV.APPLICATION_ID || "").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !EMPLOYER_JWT || !JOB_ID) {
  throw new Error(
    "Missing env vars. Required: SUPABASE_URL, SUPABASE_ANON_KEY, EMPLOYER_JWT, JOB_ID",
  );
}

export const options = {
  vus: 1,
  iterations: 1,
};

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${EMPLOYER_JWT}`,
  };
}

export default function () {
  const autoMatch = http.post(
    `${SUPABASE_URL}/functions/v1/auto-match`,
    JSON.stringify({ job_id: JOB_ID }),
    { headers: headers() },
  );

  check(autoMatch, {
    "auto-match reachable": (r) => [200, 402, 404, 409].includes(r.status),
  });

  if (APPLICATION_ID) {
    const authorize = http.post(
      `${SUPABASE_URL}/functions/v1/authorize-candidate-view`,
      JSON.stringify({ applicationId: APPLICATION_ID }),
      { headers: headers() },
    );

    check(authorize, {
      "authorize-candidate-view reachable": (r) => [200, 402, 404, 409].includes(r.status),
    });
  }
}
