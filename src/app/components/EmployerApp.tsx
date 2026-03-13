import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import { hasEmployerPaidAccess } from "@/lib/subscriptionAccess";
import { EmployerLayout } from "./EmployerLayout";
import { EmployerOnboarding } from "./EmployerOnBoarding";

export function EmployerApp() {
  const location = useLocation();
  const { profile, membershipRole, loading } = useEmployerProfile();
  const [canShowMissingProfile, setCanShowMissingProfile] = useState(false);

  useEffect(() => {
    if (loading || profile) {
      setCanShowMissingProfile(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setCanShowMissingProfile(true);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [loading, profile]);

  if (loading || (!profile && !canShowMissingProfile)) {
    return (
      <EmployerLayout profile={profile} membershipRole={membershipRole}>
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8">
          <CircularLoader size="md" label="Loading employer workspace..." />
        </div>
      </EmployerLayout>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-red-600">
        Employer profile not found
      </div>
    );
  }

  if ((profile.onboarding_step ?? 0) < 3) {
    return <EmployerOnboarding initialStep={profile.onboarding_step ?? 0} />;
  }

  const hasCandidateMessagingAccess = hasEmployerPaidAccess(profile);
  const canManageWorkspace = membershipRole === "owner" || membershipRole === "admin";

  if (!hasCandidateMessagingAccess) {
    const path = location.pathname.toLowerCase();
    if (path === "/employer/candidates" || path === "/employer/messages") {
      return <Navigate to="/employer/dashboard" replace />;
    }
  }

  if (!canManageWorkspace) {
    const path = location.pathname.toLowerCase();
    if (
      path === "/employer/plans" ||
      path === "/employer/addons" ||
      path === "/employer/billing" ||
      path === "/employer/settings"
    ) {
      return <Navigate to="/employer/dashboard" replace />;
    }
  }

  return (
    <EmployerLayout profile={profile} membershipRole={membershipRole}>
      <Outlet />
    </EmployerLayout>
  );
}
