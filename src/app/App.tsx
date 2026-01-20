import { useState } from 'react';
import { Header } from '@/app/components/Header';
import { HomePage } from '@/app/components/HomePage';
import { SkillLinkLanding } from '@/app/components/SkillLinkLanding';
import { CandidateDashboard } from '@/app/components/CandidateDashboard';
import { SkillAssessment } from '@/app/components/SkillAssessment';
import { JobReadinessSummary } from '@/app/components/JobReadinessSummary';
import { JobBridgeLanding } from '@/app/components/JobBridgeLanding';
import { EmployerDashboard } from '@/app/components/EmployerDashboard';
import { JobPostingFlow } from '@/app/components/JobPostingFlow';
import { CandidateReview } from '@/app/components/CandidateReview';

type View = 
  | 'home'
  | 'skilllink-landing'
  | 'candidate-dashboard'
  | 'skill-assessment'
  | 'job-readiness'
  | 'jobbridge-landing'
  | 'employer-dashboard'
  | 'job-posting'
  | 'candidate-review';

type UserType = 'candidate' | 'employer' | null;

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [userType, setUserType] = useState<UserType>(null);

  const getCurrentProduct = (): 'skilllink' | 'jobbridge' | 'landing' => {
    if (currentView === 'home') {
      return 'landing';
    }
    if (currentView.includes('candidate') || currentView.includes('skill') || currentView.includes('readiness')) {
      return 'skilllink';
    } else if (currentView.includes('employer') || currentView.includes('job') || currentView.includes('posting')) {
      return 'jobbridge';
    }
    return 'landing';
  };

  const handleProductSwitch = (product: 'skilllink' | 'jobbridge') => {
    if (product === 'skilllink') {
      setCurrentView('candidate-dashboard');
      setUserType('candidate');
    } else {
      setCurrentView('employer-dashboard');
      setUserType('employer');
    }
  };

  const handleSelectSkillLink = () => {
    setCurrentView('skilllink-landing');
  };

  const handleSelectJobBridge = () => {
    setCurrentView('jobbridge-landing');
  };

  const handleGetStartedSkillLink = () => {
    setCurrentView('candidate-dashboard');
    setUserType('candidate');
  };

  const handleGetStartedJobBridge = () => {
    setCurrentView('employer-dashboard');
    setUserType('employer');
  };

  const handleStartAssessment = () => {
    setCurrentView('skill-assessment');
  };

  const handleCompleteAssessment = () => {
    setCurrentView('job-readiness');
  };

  const handleViewJobs = () => {
    setCurrentView('jobbridge-landing');
  };

  const handlePostJob = () => {
    setCurrentView('job-posting');
  };

  const handleViewCandidates = () => {
    setCurrentView('candidate-review');
  };

  const handleCompleteJobPosting = () => {
    setCurrentView('employer-dashboard');
  };

  const handleCancelJobPosting = () => {
    setCurrentView('employer-dashboard');
  };

  const handleBackToDashboard = () => {
    if (userType === 'employer') {
      setCurrentView('employer-dashboard');
    } else {
      setCurrentView('candidate-dashboard');
    }
  };

  const handleShortlist = () => {
    setCurrentView('employer-dashboard');
  };

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomePage onSelectSkillLink={handleSelectSkillLink} onSelectJobBridge={handleSelectJobBridge} />;
      
      case 'skilllink-landing':
        return <SkillLinkLanding onGetStarted={handleGetStartedSkillLink} />;
      
      case 'candidate-dashboard':
        return (
          <CandidateDashboard 
            onViewJobs={handleViewJobs} 
            onStartAssessment={handleStartAssessment}
          />
        );
      
      case 'skill-assessment':
        return (
          <SkillAssessment 
            onComplete={handleCompleteAssessment}
            onBack={handleBackToDashboard}
          />
        );
      
      case 'job-readiness':
        return <JobReadinessSummary onViewJobs={handleViewJobs} />;
      
      case 'jobbridge-landing':
        return <JobBridgeLanding onGetStarted={handleGetStartedJobBridge} />;
      
      case 'employer-dashboard':
        return (
          <EmployerDashboard 
            onPostJob={handlePostJob}
            onViewCandidates={handleViewCandidates}
          />
        );
      
      case 'job-posting':
        return (
          <JobPostingFlow 
            onComplete={handleCompleteJobPosting}
            onCancel={handleCancelJobPosting}
          />
        );
      
      case 'candidate-review':
        return (
          <CandidateReview 
            onBack={handleBackToDashboard}
            onShortlist={handleShortlist}
          />
        );
      
      default:
        return <SkillLinkLanding onGetStarted={handleGetStartedSkillLink} />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header 
        currentProduct={getCurrentProduct()}
        userType={userType}
        onProductSwitch={handleProductSwitch}
      />
      {renderView()}
    </div>
  );
}