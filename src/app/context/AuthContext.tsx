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

  const loadUserProfile = async (userId: string) => {
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
      await loadUserProfile(currentUser.id);

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
        void loadUserProfile(currentUser.id).finally(() => {
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
