import { Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, useState } from 'react';
import { Header } from '@/app/components/Header';
import Login from '@/app/components/Login';
import { HomePage } from '@/app/components/HomePage';
import { CandidateDashboard } from '@/app/components/CandidateDashboard';
import { EmployerDashboard } from '@/app/components/EmployerDashboard';
import { useAuth } from './context/AuthContext';
import  CandidateJobsPage  from "./components/CandidateJobsPage";
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

  return (
    <div className="min-h-screen bg-white">
      <Header
        currentProduct={getCurrentProduct()}
        userType={role}                      // ← now from context
        onSignInClick={() => setShowLoginModal(true)}
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
        <Route path="/employer/dashboard" element={<EmployerDashboard />} />
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