import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { getAdminAccess } from "@/lib/admin";

const ADMIN_ACCESS_CACHE_TTL_MS = 30_000;

let cachedAdminAccess:
  | {
      userId: string;
      value: boolean;
      expiresAt: number;
    }
  | null = null;

export function useAdminAccess() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = user?.id ?? null;

    if (!userId) {
      cachedAdminAccess = null;
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (
      cachedAdminAccess &&
      cachedAdminAccess.userId === userId &&
      cachedAdminAccess.expiresAt > now
    ) {
      setIsAdmin(cachedAdminAccess.value);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getAdminAccess()
      .then((value) => {
        if (cancelled) return;
        cachedAdminAccess = {
          userId,
          value,
          expiresAt: Date.now() + ADMIN_ACCESS_CACHE_TTL_MS,
        };
        setIsAdmin(value);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to resolve admin access", error);
        setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isAdmin, loading };
}
