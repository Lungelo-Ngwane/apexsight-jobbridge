import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";

export function useEmployerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    async function loadProfile() {
      setLoading(true);
      const { data, error } = await supabase
        .from("employer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(); // safe if row does not exist

      if (error) console.error("Failed to load employer profile", error);

      setProfile(data); // profile may be null for new users
      setLoading(false);
    }

    loadProfile();
  }, [user]);

  return { profile, loading };
}
