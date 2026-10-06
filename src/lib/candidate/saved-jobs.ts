import { supabase } from "../supabase";
const CANDIDATE_SAVED_JOBS_KEY_PREFIX = "candidate_saved_jobs_";
function getSavedJobsStorageKey(userId: string) {
  return `${CANDIDATE_SAVED_JOBS_KEY_PREFIX}${userId}`;
}

function parseSavedJobIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0)));
  } catch {
    return [];
  }
}

async function resolveCurrentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function getCandidateSavedJobIds() {
  const userId = await resolveCurrentUserId();
  if (!userId || typeof window === "undefined") return [];
  return parseSavedJobIds(window.localStorage.getItem(getSavedJobsStorageKey(userId)));
}

export async function setCandidateSavedJobIds(jobIds: string[]) {
  const userId = await resolveCurrentUserId();
  if (!userId || typeof window === "undefined") return [];
  const normalizedJobIds = Array.from(new Set((jobIds ?? []).map((id) => String(id)).filter(Boolean)));
  window.localStorage.setItem(getSavedJobsStorageKey(userId), JSON.stringify(normalizedJobIds));
  return normalizedJobIds;
}

export async function toggleCandidateSavedJob(jobId: string) {
  const normalizedId = String(jobId ?? "").trim();
  if (!normalizedId) return [];
  const userId = await resolveCurrentUserId();
  if (!userId || typeof window === "undefined") return [];
  const key = getSavedJobsStorageKey(userId);
  const current = parseSavedJobIds(window.localStorage.getItem(key));
  const next = current.includes(normalizedId)
    ? current.filter((id) => id !== normalizedId)
    : [...current, normalizedId];
  window.localStorage.setItem(key, JSON.stringify(next));
  return next;
}

