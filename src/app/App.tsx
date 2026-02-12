import { Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, useState } from 'react';
import { Header } from '@/app/components/Header';
import Login from '@/app/components/Login';
import { HomePage } from '@/app/components/HomePage';
import { CandidateDashboard } from '@/app/components/CandidateDashboard';
import { EmployerDashboard } from '@/app/components/EmployerDashboard';
import { CandidateProfile } from "@/app/components/CandidateProfile";
import { EmployerProfile } from "@/app/components/EmployerProfile";
import { useAuth } from './context/AuthContext';
import CandidateJobsPage from "./components/CandidateJobsPage";
import { EmployerApp } from "./components/EmployerApp";
import { EmployerJobsPage } from "./components/employer/EmployerJobsPage";
import { EmployerBillingPage } from "./components/employer/EmployerBillingPage";
import { EmployerSettingsPage } from "./components/employer/EmployerSettingsPage";
// import { useAuth } from '../context/AuthContext'; // adjust path

type View = 'home' | 'candidate-dashboard' | 'employer-dashboard';

export default function App() {
  const { user, role, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('home');
  const [showLoginModal, setShowLoginModal] = useState(false);

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

    // Only redirect on initial load, not every role change
    if (!user) {
      navigate('/');
    } else if (role === 'candidate' && window.location.pathname === '/') {
      navigate('/candidate/dashboard');
    } else if (role === 'employer' && window.location.pathname === '/') {
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


  return (
    <div className="min-h-screen bg-white">
      <Header
        currentProduct={getCurrentProduct()}
        userType={role}                      // ← now from context
        onSignInClick={() => setShowLoginModal(true)}
        onProfileClick={handleProfileClick}
      />

      {/* {currentView === 'home' && <HomePage />}
      {currentView === 'candidate-dashboard' && <CandidateDashboard />}
      {currentView === 'employer-dashboard' && <EmployerDashboard />} */}
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/candidate/dashboard"
          element={<CandidateDashboard onViewJobs={() => navigate("/candidate/jobs")} />}
        />
        <Route path="/candidate/jobs" element={<CandidateJobsPage />} />
        <Route path="/candidate/profile" element={<CandidateProfile />} />

        <Route path="/employer" element={<EmployerApp />}>
          <Route path="dashboard" element={<EmployerDashboard />} />
          <Route path="jobs" element={<EmployerJobsPage />} />
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
            <Login onLoginSuccess={() => setShowLoginModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
