import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";

export type UserRole = "candidate" | "employer" | null;

interface AuthContextType {
  user: any | null;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const lastProfileUserIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const roleRef = useRef<UserRole>(null);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const ensureBaseProfile = async (user: {
    id: string;
    email?: string | null;
    user_metadata?: {
      full_name?: string | null;
      role?: string | null;
    } | null;
  }) => {
    const normalizedRole = String(user.user_metadata?.role ?? "").trim().toLowerCase();
    const resolvedRole =
      normalizedRole === "candidate" || normalizedRole === "employer"
        ? normalizedRole
        : null;

    if (!resolvedRole) {
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: String(user.user_metadata?.full_name ?? user.email ?? "").trim() || null,
        role: resolvedRole,
      })
      .select("role")
      .single();

    if (error) {
      throw error;
    }

    return data;
  };

  const loadUserProfile = async (user: {
    id: string;
    email?: string | null;
    user_metadata?: {
      full_name?: string | null;
      role?: string | null;
    } | null;
  }) => {
    const userId = user.id;
    const maxAttempts = 8;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        if (currentUserIdRef.current !== userId) {
          return;
        }

        if (error) {
          console.error("Profile fetch error:", error);
        } else if (data?.role === "candidate" || data?.role === "employer") {
          setRole(data.role);
          return;
        } else if (attempt === 1) {
          const created = await ensureBaseProfile(user).catch((createError) => {
            console.error("Base profile creation failed:", createError);
            return null;
          });

          if (created?.role === "candidate" || created?.role === "employer") {
            setRole(created.role);
            return;
          }
        }
      } catch (err) {
        console.error("Profile load failed:", err);
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }
    }

    if (currentUserIdRef.current === userId) {
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function hydrateSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        lastProfileUserIdRef.current = null;
        currentUserIdRef.current = null;
        setRole(null);
        setLoading(false);
        return;
      }

      lastProfileUserIdRef.current = currentUser.id;
      currentUserIdRef.current = currentUser.id;
      await loadUserProfile(currentUser);

      if (mounted) {
        setLoading(false);
      }
    }

    void hydrateSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      const previousUserId = lastProfileUserIdRef.current;
      const nextUserId = currentUser?.id ?? null;

      if (
        event === "TOKEN_REFRESHED" &&
        currentUserIdRef.current !== null &&
        currentUserIdRef.current === nextUserId
      ) {
        return;
      }

      const sameUser =
        currentUserIdRef.current !== null &&
        currentUserIdRef.current === nextUserId;

      if (
        sameUser &&
        roleRef.current !== null &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION")
      ) {
        setUser(currentUser);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      if (!currentUser) {
        lastProfileUserIdRef.current = null;
        currentUserIdRef.current = null;
        setRole(null);
        setLoading(false);
        return;
      }

      const shouldRefreshRole =
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "INITIAL_SESSION" ||
        previousUserId !== nextUserId;

      lastProfileUserIdRef.current = nextUserId;
      currentUserIdRef.current = nextUserId;

      if (shouldRefreshRole) {
        setLoading(true);
        void loadUserProfile(currentUser).finally(() => {
          if (mounted && currentUserIdRef.current === currentUser.id) {
            setLoading(false);
          }
        });
        return;
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    lastProfileUserIdRef.current = null;
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
