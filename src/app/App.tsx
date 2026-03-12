import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from 'react';
import { Header } from '@/app/components/Header';
import { Seo } from '@/app/components/Seo';
import Login from '@/app/components/Login';
import { HomePage } from '@/app/components/HomePage';
import { SkillLinkLanding } from '@/app/components/SkillLinkLanding';
import { JobBridgeLanding } from '@/app/components/JobBridgeLanding';
import { CandidateDashboard } from '@/app/components/CandidateDashboard';
import { EmployerDashboard } from '@/app/components/EmployerDashboard';
import { CandidateProfile } from "@/app/components/CandidateProfile";
import { EmployerProfile } from "@/app/components/EmployerProfile";
import { useAuth } from './context/AuthContext';
import CandidateJobsPage from "./components/CandidateJobsPage";
import CandidateMyJobsPage from "./components/CandidateMyJobsPage";
import { EmployerApp } from "./components/EmployerApp";
import { EmployerJobsPage } from "./components/employer/EmployerJobsPage";
import { EmployerJobReportPage } from "./components/employer/EmployerJobReportPage";
import { EmployerCandidatesPage } from "./components/employer/EmployerCandidatesPage";
import { EmployerBillingPage } from "./components/employer/EmployerBillingPage";
import { EmployerAddonsPage } from "./components/employer/EmployerAddonsPage";
import { EmployerPlansPage } from "./components/employer/EmployerPlansPage";
import { EmployerSettingsPage } from "./components/employer/EmployerSettingsPage";
import { MessagesPage } from "./components/messages/MessagesPage";
import { supabase } from "@/lib/supabase";
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
            <HomePage
              onSelectSkillLink={() => navigate("/skilllink")}
              onSelectJobBridge={() => navigate("/jobbridge")}
            />
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
          element={<SkillLinkLanding onGetStarted={() => openRegisterModal("candidate")} />}
        />
        <Route
          path="/jobbridge"
          element={<JobBridgeLanding onGetStarted={() => openRegisterModal("employer")} />}
        />

        <Route
          path="/candidate/dashboard"
          element={<CandidateDashboard onViewJobs={() => navigate("/candidate/jobs")} />}
        />
        <Route path="/candidate/jobs" element={<CandidateJobsPage />} />
        <Route path="/candidate/my-jobs" element={<CandidateMyJobsPage />} />
        <Route path="/candidate/messages" element={<MessagesPage />} />
        <Route path="/candidate/profile" element={<CandidateProfile />} />

        <Route path="/employer" element={<EmployerApp />}>
          <Route path="dashboard" element={<EmployerDashboard />} />
          <Route path="jobs" element={<EmployerJobsPage />} />
          <Route path="jobs/:jobId/report" element={<EmployerJobReportPage />} />
          <Route path="candidates" element={<EmployerCandidatesPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="plans" element={<EmployerPlansPage />} />
          <Route path="addons" element={<EmployerAddonsPage />} />
          <Route path="billing" element={<EmployerBillingPage />} />
          <Route path="settings" element={<EmployerSettingsPage />} />
        </Route>

        <Route path="/employer/profile" element={<EmployerProfile />} />
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
            <Login
              initialMode={authInitialMode}
              initialRole={authInitialRole}
              onLoginSuccess={handleLoginSuccess}
            />
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
    </div>
  );
}
