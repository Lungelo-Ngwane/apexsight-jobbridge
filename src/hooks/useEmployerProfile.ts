import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { getCurrentEmployerContext, getEmployerProfile, type EmployerMembershipRole } from "@/lib/employer";

const EMPLOYER_PROFILE_CACHE_TTL_MS = 10_000;

type EmployerProfileSnapshot = {
  profile: any | null;
  membershipRole: EmployerMembershipRole | null;
};

let cachedEmployerProfile:
  | {
      userId: string;
      value: EmployerProfileSnapshot;
      expiresAt: number;
    }
  | null = null;
let employerProfileInFlight:
  | {
      userId: string;
      promise: Promise<EmployerProfileSnapshot>;
    }
  | null = null;

async function loadEmployerProfileSnapshot(userId: string): Promise<EmployerProfileSnapshot> {
  const now = Date.now();
  if (
    cachedEmployerProfile &&
    cachedEmployerProfile.userId === userId &&
    cachedEmployerProfile.expiresAt > now
  ) {
    return cachedEmployerProfile.value;
  }

  if (employerProfileInFlight?.userId === userId) {
    return employerProfileInFlight.promise;
  }

  const request = (async () => {
    const context = await getCurrentEmployerContext().catch((error) => {
      console.error("Failed to load employer context", error);
      return null;
    });
    const profile = context
      ? await getEmployerProfile(context).catch((error) => {
          console.error("Failed to load employer profile", error);
          return null;
        })
      : null;

    const snapshot = {
      profile,
      membershipRole: context?.membershipRole ?? null,
    } satisfies EmployerProfileSnapshot;

    cachedEmployerProfile = {
      userId,
      value: snapshot,
      expiresAt: Date.now() + EMPLOYER_PROFILE_CACHE_TTL_MS,
    };

    return snapshot;
  })();

  employerProfileInFlight = {
    userId,
    promise: request,
  };

  return request.finally(() => {
    if (employerProfileInFlight?.userId === userId) {
      employerProfileInFlight = null;
    }
  });
}

export function useEmployerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [membershipRole, setMembershipRole] = useState<EmployerMembershipRole | null>(null);
  const [loading, setLoading] = useState(true);
  const lastLoadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;

    if (!userId) {
      lastLoadedUserIdRef.current = null;
      cachedEmployerProfile = null;
      employerProfileInFlight = null;
      setProfile(null);
      setMembershipRole(null);
      setLoading(false);
      return;
    }

    async function loadProfile() {
      const shouldShowLoading = lastLoadedUserIdRef.current !== userId || profile === null;
      if (shouldShowLoading) {
        setLoading(true);
      }

      const snapshot = await loadEmployerProfileSnapshot(userId);

      lastLoadedUserIdRef.current = userId;
      setProfile(snapshot.profile); // profile may be null for new users
      setMembershipRole(snapshot.membershipRole);
      setLoading(false);
    }

    void loadProfile();
  }, [user?.id]);

  return { profile, membershipRole, loading };
}
