import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

export type UserRole = "candidate" | "employer" | null;

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const INACTIVITY_WARNING_MS = 9 * 60 * 1000;

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
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdownSeconds, setWarningCountdownSeconds] = useState(
    Math.floor((INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) / 1000),
  );
  const lastProfileUserIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const roleRef = useRef<UserRole>(null);
  const inactivityWarningTimeoutRef = useRef<number | null>(null);
  const inactivityLogoutTimeoutRef = useRef<number | null>(null);
  const inactivityCountdownIntervalRef = useRef<number | null>(null);
  const inactivitySigningOutRef = useRef(false);
  const inactivityWarningVisibleRef = useRef(false);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    inactivityWarningVisibleRef.current = showInactivityWarning;
  }, [showInactivityWarning]);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const clearInactivityTimers = () => {
      if (inactivityWarningTimeoutRef.current !== null) {
        window.clearTimeout(inactivityWarningTimeoutRef.current);
        inactivityWarningTimeoutRef.current = null;
      }

      if (inactivityLogoutTimeoutRef.current !== null) {
        window.clearTimeout(inactivityLogoutTimeoutRef.current);
        inactivityLogoutTimeoutRef.current = null;
      }

      if (inactivityCountdownIntervalRef.current !== null) {
        window.clearInterval(inactivityCountdownIntervalRef.current);
        inactivityCountdownIntervalRef.current = null;
      }
    };

    const performInactivityLogout = async () => {
      if (inactivitySigningOutRef.current) {
        return;
      }

      inactivitySigningOutRef.current = true;

      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error("Failed to sign out inactive user", error);
      } finally {
        inactivitySigningOutRef.current = false;
      }
    };

    const startWarningCountdown = () => {
      if (inactivityCountdownIntervalRef.current !== null) {
        window.clearInterval(inactivityCountdownIntervalRef.current);
      }

      let remainingSeconds = Math.floor((INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) / 1000);
      setWarningCountdownSeconds(remainingSeconds);
      inactivityCountdownIntervalRef.current = window.setInterval(() => {
        remainingSeconds = Math.max(remainingSeconds - 1, 0);
        setWarningCountdownSeconds(remainingSeconds);

        if (remainingSeconds === 0 && inactivityCountdownIntervalRef.current !== null) {
          window.clearInterval(inactivityCountdownIntervalRef.current);
          inactivityCountdownIntervalRef.current = null;
        }
      }, 1000);
    };

    const scheduleInactivityTimers = () => {
      clearInactivityTimers();
      inactivityWarningVisibleRef.current = false;
      setShowInactivityWarning(false);
      setWarningCountdownSeconds(Math.floor((INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) / 1000));

      inactivityWarningTimeoutRef.current = window.setTimeout(() => {
        inactivityWarningVisibleRef.current = true;
        setShowInactivityWarning(true);
        startWarningCountdown();
        inactivityLogoutTimeoutRef.current = window.setTimeout(() => {
          void performInactivityLogout();
        }, INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS);
      }, INACTIVITY_WARNING_MS);
    };

    if (!user) {
      inactivitySigningOutRef.current = false;
      inactivityWarningVisibleRef.current = false;
      setShowInactivityWarning(false);
      setWarningCountdownSeconds(Math.floor((INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) / 1000));
      clearInactivityTimers();
      return;
    }

    const handleActivity = () => {
      if (inactivityWarningVisibleRef.current) {
        return;
      }

      scheduleInactivityTimers();
    };

    scheduleInactivityTimers();

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      clearInactivityTimers();
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity);
      }
    };
  }, [user]);

  const continueSession = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (inactivityWarningTimeoutRef.current !== null) {
      window.clearTimeout(inactivityWarningTimeoutRef.current);
      inactivityWarningTimeoutRef.current = null;
    }

    if (inactivityLogoutTimeoutRef.current !== null) {
      window.clearTimeout(inactivityLogoutTimeoutRef.current);
      inactivityLogoutTimeoutRef.current = null;
    }

    if (inactivityCountdownIntervalRef.current !== null) {
      window.clearInterval(inactivityCountdownIntervalRef.current);
      inactivityCountdownIntervalRef.current = null;
    }

    inactivityWarningVisibleRef.current = false;
    setShowInactivityWarning(false);
    setWarningCountdownSeconds(Math.floor((INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) / 1000));
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
      <Dialog open={showInactivityWarning}>
        <DialogContent
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>Session expiring soon</DialogTitle>
            <DialogDescription>
              You have been inactive for a while. For security, you will be logged out in{" "}
              {warningCountdownSeconds} seconds unless you choose to stay signed in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => void signOut()}>
              Log Out Now
            </Button>
            <Button onClick={continueSession}>Stay Signed In</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
