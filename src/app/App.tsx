import { Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, useState } from 'react';
import { Header } from '@/app/components/Header';
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
import { EmployerApp } from "./components/EmployerApp";
import { EmployerJobsPage } from "./components/employer/EmployerJobsPage";
import { EmployerCandidatesPage } from "./components/employer/EmployerCandidatesPage";
import { EmployerBillingPage } from "./components/employer/EmployerBillingPage";
import { EmployerAddonsPage } from "./components/employer/EmployerAddonsPage";
import { EmployerSettingsPage } from "./components/employer/EmployerSettingsPage";
import { MessagesPage } from "./components/messages/MessagesPage";
// import { useAuth } from '../context/AuthContext'; // adjust path

type View = 'home' | 'candidate-dashboard' | 'employer-dashboard';

export default function App() {
  const { user, role, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('home');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">("login");
  const [authInitialRole, setAuthInitialRole] = useState<"candidate" | "employer">("candidate");

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
    const publicPaths = ["/", "/skilllink", "/jobbridge"];
    const currentPath = window.location.pathname;

    // Only redirect on initial load, not every role change
    if (!user) {
      if (!publicPaths.includes(currentPath)) {
        navigate('/');
      }
    } else if (role === 'candidate' && currentPath === '/') {
      navigate('/candidate/dashboard');
    } else if (role === 'employer' && currentPath === '/') {
      navigate('/employer/dashboard');
    }
  }, [user, role, loading, navigate]);

  const getCurrentProduct = (): 'skilllink' | 'jobbridge' | 'landing' => {
    if (currentView === 'home') return 'landing';
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

  const handleLoginSuccess = (resolvedRole?: "candidate" | "employer" | null) => {
    setShowLoginModal(false);

    if (resolvedRole === "candidate") {
      navigate("/candidate/dashboard");
      return;
    }

    if (resolvedRole === "employer") {
      navigate("/employer/dashboard");
      return;
    }

    if (role === "candidate") {
      navigate("/candidate/dashboard");
      return;
    }

    if (role === "employer") {
      navigate("/employer/dashboard");
    }
  };


  return (
    <div className="min-h-screen bg-white">
      <Header
        currentProduct={getCurrentProduct()}
        userType={role}                      // ← now from context
        onSignInClick={openLoginModal}
        onGetStartedClick={openLoginModal}
        onProfileClick={handleProfileClick}
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
          path="/skilllink"
          element={<SkillLinkLanding onGetStarted={openLoginModal} />}
        />
        <Route
          path="/jobbridge"
          element={<JobBridgeLanding onGetStarted={openLoginModal} />}
        />

        <Route
          path="/candidate/dashboard"
          element={<CandidateDashboard onViewJobs={() => navigate("/candidate/jobs")} />}
        />
        <Route path="/candidate/jobs" element={<CandidateJobsPage />} />
        <Route path="/candidate/messages" element={<MessagesPage />} />
        <Route path="/candidate/profile" element={<CandidateProfile />} />

        <Route path="/employer" element={<EmployerApp />}>
          <Route path="dashboard" element={<EmployerDashboard />} />
          <Route path="jobs" element={<EmployerJobsPage />} />
          <Route path="candidates" element={<EmployerCandidatesPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="addons" element={<EmployerAddonsPage />} />
          <Route path="billing" element={<EmployerBillingPage />} />
          <Route path="settings" element={<EmployerSettingsPage />} />
        </Route>

        <Route path="/employer/profile" element={<EmployerProfile />} />
      </Routes>


      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 w-96 max-w-full transform transition-transform duration-300 scale-95 hover:scale-100"
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
    </div>
  );
}
