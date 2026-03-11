import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { getCurrentEmployerContext, getEmployerProfile, type EmployerMembershipRole } from "@/lib/employer";

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

      const [context, data] = await Promise.all([
        getCurrentEmployerContext().catch((error) => {
          console.error("Failed to load employer context", error);
          return null;
        }),
        getEmployerProfile().catch((error) => {
          console.error("Failed to load employer profile", error);
          return null;
        }),
      ]);

      lastLoadedUserIdRef.current = userId;
      setProfile(data); // profile may be null for new users
      setMembershipRole(context?.membershipRole ?? null);
      setLoading(false);
    }

    void loadProfile();
  }, [user?.id]);

  return { profile, membershipRole, loading };
}
