import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";

export function useEmployerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const lastLoadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;

    if (!userId) {
      lastLoadedUserIdRef.current = null;
      setProfile(null);
      setLoading(false);
      return;
    }

    async function loadProfile() {
      const shouldShowLoading = lastLoadedUserIdRef.current !== userId || profile === null;
      if (shouldShowLoading) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from("employer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(); // safe if row does not exist

      if (error) console.error("Failed to load employer profile", error);

      lastLoadedUserIdRef.current = userId;
      setProfile(data); // profile may be null for new users
      setLoading(false);
    }

    void loadProfile();
  }, [user?.id]);

  return { profile, loading };
}
