import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Header } from '@/app/components/Header';
import { Seo } from '@/app/components/Seo';
import { useAuth } from './context/AuthContext';
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { supabase } from "@/lib/supabase";
import { clearPendingGoogleSignInIntent, hasPendingGoogleSignInIntent } from "@/lib/auth";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
// import { useAuth } from '../context/AuthContext'; // adjust path

const HomePage = lazy(() =>
  import("@/app/components/HomePage").then((module) => ({ default: module.HomePage })),
);
const SkillLinkLanding = lazy(() =>
  import("@/app/components/SkillLinkLanding").then((module) => ({ default: module.SkillLinkLanding })),
);
const JobBridgeLanding = lazy(() =>
  import("@/app/components/JobBridgeLanding").then((module) => ({ default: module.JobBridgeLanding })),
);
const CandidateDashboard = lazy(() =>
  import("@/app/components/CandidateDashboard").then((module) => ({ default: module.CandidateDashboard })),
);
const CandidateProfile = lazy(() =>
  import("@/app/components/CandidateProfile").then((module) => ({ default: module.CandidateProfile })),
);
const CandidateJobsPage = lazy(() => import("./components/CandidateJobsPage"));
const CandidateMyJobsPage = lazy(() => import("./components/CandidateMyJobsPage"));
const EmployerProfile = lazy(() =>
  import("@/app/components/EmployerProfile").then((module) => ({ default: module.EmployerProfile })),
);
const EmployerPublicProfilePage = lazy(() =>
  import("./components/EmployerPublicProfilePage").then((module) => ({ default: module.EmployerPublicProfilePage })),
);
const Login = lazy(() => import("@/app/components/Login"));
const EmployerApp = lazy(() =>
  import("./components/EmployerApp").then((module) => ({ default: module.EmployerApp })),
);
const EmployerDashboard = lazy(() =>
  import("./components/EmployerDashboard").then((module) => ({ default: module.EmployerDashboard })),
);
const EmployerJobsPage = lazy(() =>
  import("./components/employer/EmployerJobsPage").then((module) => ({ default: module.EmployerJobsPage })),
);
const EmployerJobReportPage = lazy(() =>
  import("./components/employer/EmployerJobReportPage").then((module) => ({ default: module.EmployerJobReportPage })),
);
const EmployerCandidatesPage = lazy(() =>
  import("./components/employer/EmployerCandidatesPage").then((module) => ({ default: module.EmployerCandidatesPage })),
);
const EmployerBillingPage = lazy(() =>
  import("./components/employer/EmployerBillingPage").then((module) => ({ default: module.EmployerBillingPage })),
);
const EmployerAddonsPage = lazy(() =>
  import("./components/employer/EmployerAddonsPage").then((module) => ({ default: module.EmployerAddonsPage })),
);
const EmployerPlansPage = lazy(() =>
  import("./components/employer/EmployerPlansPage").then((module) => ({ default: module.EmployerPlansPage })),
);
const EmployerSettingsPage = lazy(() =>
  import("./components/employer/EmployerSettingsPage").then((module) => ({ default: module.EmployerSettingsPage })),
);
const MessagesPage = lazy(() =>
  import("./components/messages/MessagesPage").then((module) => ({ default: module.MessagesPage })),
);
const AdminDashboardPage = lazy(() =>
  import("./components/admin/AdminDashboardPage").then((module) => ({ default: module.default })),
);
const AdminEntityDetailPage = lazy(() =>
  import("./components/admin/AdminEntityDetailPage").then((module) => ({ default: module.default })),
);

function RouteLoader({ label = "Loading page..." }: { label?: string }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <CircularLoader size="md" label={label} />
    </div>
  );
}

function withRouteSuspense(node: React.ReactNode, label?: string) {
  return <Suspense fallback={<RouteLoader label={label} />}>{node}</Suspense>;
}

type View = 'home' | 'candidate-dashboard' | 'employer-dashboard';

function getCandidateSeenDashboardKey(userId: string) {
  return `candidate_seen_dashboard_${userId}`;
}

function getCandidatePostLoginPath(userId?: string | null) {
  if (!userId) return "/candidate/dashboard";
  const seen =
    typeof window !== "undefined" &&
    window.localStorage.getItem(getCandidateSeenDashboardKey(userId)) === "1";
  return seen ? "/candidate/jobs" : "/candidate/dashboard";
}

export default function App() {
  const { user, role, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('home');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">("login");
  const [authInitialRole, setAuthInitialRole] = useState<"candidate" | "employer">("candidate");
  const [showPasswordRecoveryModal, setShowPasswordRecoveryModal] = useState(false);
  const [showRegistrationRequiredModal, setShowRegistrationRequiredModal] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);
  const location = useLocation();

  // useEffect(() => {
  //   if (loading) return;

  //   if (!user) {
  //     setCurrentView('home');
  //   } else if (role === 'candidate') {
  //     setCurrentView('candidate-dashboard');
  //   } else if (role === 'employer') {
  //     setCurrentView('employer-dashboard');
  //   }
  //   // if role is null but user exists → probably incomplete profile
  // }, [user, role, loading]);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const publicPaths = ["/", "/skilllink", "/jobbridge", "/reset-password"];
    const currentPath = location.pathname;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const isRecoveryFlow = currentPath === "/reset-password" || hashParams.get("type") === "recovery";

    if (isRecoveryFlow) {
      return;
    }

    // Only redirect on initial load, not every role change
    if (!user) {
      if (!publicPaths.includes(currentPath)) {
        navigate("/", { replace: true });
      }
    } else if (role === 'candidate' && currentPath === '/') {
      navigate(getCandidatePostLoginPath(user?.id), { replace: true });
    } else if (role === 'employer' && currentPath === '/') {
      navigate("/employer/dashboard", { replace: true });
    }
  }, [user, role, loading, navigate, location.pathname]);

  useEffect(() => {
    if (role === "candidate" || role === "employer") {
      clearPendingGoogleSignInIntent();
    }
  }, [role]);

  useEffect(() => {
    if (loading || !user || role !== null || !hasPendingGoogleSignInIntent()) {
      return;
    }

    let active = true;

    void (async () => {
      try {
        clearPendingGoogleSignInIntent();
        await supabase.auth.signOut();
      } catch (error) {
        console.error("Failed to sign out unregistered Google user", error);
      } finally {
        if (!active) {
          return;
        }

        setShowLoginModal(false);
        setShowRegistrationRequiredModal(true);
        navigate("/", { replace: true });
      }
    })();

    return () => {
      active = false;
    };
  }, [user, role, loading, navigate]);

  const getCurrentProduct = (): 'skilllink' | 'jobbridge' | 'landing' => {
    if (location.pathname === "/jobbridge") return "jobbridge";
    if (location.pathname === "/skilllink") return "skilllink";
    if (location.pathname === "/") return "landing";
    return role === 'candidate' ? 'skilllink' : 'jobbridge';
  };

  const handleProfileClick = () => {
    if (!role) return;

    if (role === "candidate") {
      navigate("/candidate/profile");
    }

    if (role === "employer") {
      navigate("/employer/profile");
    }
  };

  const openRegisterModal = (selectedRole: "candidate" | "employer") => {
    setAuthInitialMode("register");
    setAuthInitialRole(selectedRole);
    setShowLoginModal(true);
  };

  const openLoginModal = () => {
    setAuthInitialMode("login");
    setShowLoginModal(true);
  };

  const openContextualRegisterModal = () => {
    const path = window.location.pathname.toLowerCase();
    openRegisterModal(path === "/jobbridge" ? "employer" : "candidate");
  };

  const openJobBridgePricing = () => {
    if (window.location.pathname.toLowerCase() === "/jobbridge") {
      window.history.replaceState(null, "", "/jobbridge#pricing");
      const element = document.getElementById("jobbridge-pricing");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    navigate("/jobbridge#pricing");
  };

  const handleLoginSuccess = async (resolvedRole?: "candidate" | "employer" | null) => {
    setShowLoginModal(false);
    clearPendingGoogleSignInIntent();

    let authenticatedUserId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      authenticatedUserId = data.user?.id ?? null;
    } catch (error) {
      console.error("Failed to resolve authenticated user during login redirect", error);
    }

    if (resolvedRole === "candidate") {
      navigate(getCandidatePostLoginPath(authenticatedUserId ?? user?.id));
      return;
    }

    if (resolvedRole === "employer") {
      navigate("/employer/dashboard");
      return;
    }

    if (role === "candidate") {
      navigate(getCandidatePostLoginPath(authenticatedUserId ?? user?.id));
      return;
    }

    if (role === "employer") {
      navigate("/employer/dashboard");
    }
  };

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (
      location.pathname === "/reset-password" ||
      hashParams.get("type") === "recovery"
    ) {
      setShowPasswordRecoveryModal(true);
    }
  }, [location.pathname]);

  async function handlePasswordRecoverySubmit() {
    if (!recoveryPassword || recoveryPassword.length < 8) {
      window.alert("Password must be at least 8 characters long.");
      return;
    }

    if (recoveryPassword !== recoveryPasswordConfirm) {
      window.alert("Passwords do not match.");
      return;
    }

    try {
      setRecoverySaving(true);
      const { error } = await supabase.auth.updateUser({
        password: recoveryPassword,
      });

      if (error) throw error;

      setShowPasswordRecoveryModal(false);
      setRecoveryPassword("");
      setRecoveryPasswordConfirm("");
      navigate("/", { replace: true });
      window.alert("Your password has been updated. You can now sign in.");
    } catch (error) {
      console.error("Failed to update password", error);
      window.alert("We couldn't update your password right now. Please try the reset link again.");
    } finally {
      setRecoverySaving(false);
    }
  }


  return (
    <div className="min-h-screen bg-white">
      <Seo />
      <Header
        currentProduct={getCurrentProduct()}
        onSignInClick={openLoginModal}
        onGetStartedClick={openContextualRegisterModal}
        onProfileClick={handleProfileClick}
        onPricingClick={openJobBridgePricing}
      />

      {/* {currentView === 'home' && <HomePage />}
      {currentView === 'candidate-dashboard' && <CandidateDashboard />}
      {currentView === 'employer-dashboard' && <EmployerDashboard />} */}
      <Routes>
        <Route
          path="/"
          element={
            withRouteSuspense(<HomePage
              onSelectSkillLink={() => navigate("/skilllink")}
              onSelectJobBridge={() => navigate("/jobbridge")}
            />, "Loading home...")
          }
        />
        <Route
          path="/reset-password"
          element={
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
              <div className="max-w-md text-center">
                <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Use the password dialog to finish setting your new password.
                </p>
              </div>
            </div>
          }
        />
        <Route
          path="/skilllink"
          element={withRouteSuspense(<SkillLinkLanding onGetStarted={() => openRegisterModal("candidate")} />, "Loading SkillLink...")}
        />
        <Route
          path="/jobbridge"
          element={withRouteSuspense(<JobBridgeLanding onGetStarted={() => openRegisterModal("employer")} />, "Loading JobBridge...")}
        />

        <Route
          path="/candidate/dashboard"
          element={withRouteSuspense(<CandidateDashboard onViewJobs={() => navigate("/candidate/jobs")} />, "Loading dashboard...")}
        />
        <Route path="/candidate/jobs" element={withRouteSuspense(<CandidateJobsPage />, "Loading jobs...")} />
        <Route path="/candidate/my-jobs" element={withRouteSuspense(<CandidateMyJobsPage />, "Loading applications...")} />
        <Route path="/candidate/messages" element={withRouteSuspense(<MessagesPage />, "Loading messages...")} />
        <Route path="/candidate/profile" element={withRouteSuspense(<CandidateProfile />, "Loading profile...")} />
        <Route path="/admin/dashboard" element={withRouteSuspense(<AdminDashboardPage />, "Loading admin dashboard...")} />
        <Route path="/admin/entities/:kind/:id" element={withRouteSuspense(<AdminEntityDetailPage />, "Loading admin detail...")} />
        <Route path="/companies/:employerId" element={withRouteSuspense(<EmployerPublicProfilePage />, "Loading company profile...")} />

        <Route path="/employer" element={withRouteSuspense(<EmployerApp />, "Loading employer workspace...")}>
          <Route path="dashboard" element={withRouteSuspense(<EmployerDashboard />, "Loading dashboard...")} />
          <Route path="jobs" element={withRouteSuspense(<EmployerJobsPage />, "Loading jobs...")} />
          <Route path="jobs/:jobId/report" element={withRouteSuspense(<EmployerJobReportPage />, "Loading report...")} />
          <Route path="candidates" element={withRouteSuspense(<EmployerCandidatesPage />, "Loading candidates...")} />
          <Route path="messages" element={withRouteSuspense(<MessagesPage />, "Loading messages...")} />
          <Route path="plans" element={withRouteSuspense(<EmployerPlansPage />, "Loading plans...")} />
          <Route path="addons" element={withRouteSuspense(<EmployerAddonsPage />, "Loading add-ons...")} />
          <Route path="billing" element={withRouteSuspense(<EmployerBillingPage />, "Loading billing...")} />
          <Route path="settings" element={withRouteSuspense(<EmployerSettingsPage />, "Loading settings...")} />
        </Route>

        <Route path="/employer/profile" element={withRouteSuspense(<EmployerProfile />, "Loading employer profile...")} />
      </Routes>


      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-4 sm:p-8 w-full max-w-md transform transition-transform duration-300 scale-95 hover:scale-100"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-lg font-bold"
              onClick={() => setShowLoginModal(false)}
            >
              ✕
            </button>
            <Suspense fallback={<RouteLoader label="Loading sign-in..." />}>
              <Login
                initialMode={authInitialMode}
                initialRole={authInitialRole}
                onLoginSuccess={handleLoginSuccess}
              />
            </Suspense>
          </div>
        </div>
      )}
      <Dialog open={showPasswordRecoveryModal} onOpenChange={setShowPasswordRecoveryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
            <DialogDescription>
              Enter your new password to finish resetting your account access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="New password"
              value={recoveryPassword}
              onChange={(e) => setRecoveryPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={recoveryPasswordConfirm}
              onChange={(e) => setRecoveryPasswordConfirm(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordRecoveryModal(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordRecoverySubmit} disabled={recoverySaving}>
              {recoverySaving ? "Saving..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showRegistrationRequiredModal} onOpenChange={setShowRegistrationRequiredModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register before using Google sign-in</DialogTitle>
            <DialogDescription>
              We found a Google account, but there is no completed ApexSight registration for it
              yet. Please create your account first, then sign in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRegistrationRequiredModal(false);
                setAuthInitialMode("login");
                setShowLoginModal(true);
              }}
            >
              Back to Sign In
            </Button>
            <Button
              onClick={() => {
                setShowRegistrationRequiredModal(false);
                setAuthInitialMode("register");
                setAuthInitialRole(
                  window.location.pathname.toLowerCase() === "/jobbridge" ? "employer" : "candidate",
                );
                setShowLoginModal(true);
              }}
            >
              Register First
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
