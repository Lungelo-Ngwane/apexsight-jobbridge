import { EmployerLayout } from "./EmployerLayout";
import { EmployerOnboarding } from "./EmployerOnBoarding";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasEmployerPaidAccess } from "@/lib/subscriptionAccess";
import { CircularLoader } from "@/app/components/ui/circular-loader";

export function EmployerApp() {
  const location = useLocation();
  const { profile, loading } = useEmployerProfile();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <CircularLoader size="md" label="Loading employer data..." />
      </div>
    );
  }

  // 🚨 HARD GUARD — prevents crashes
  if (!profile) {
    return (
      <div className="p-8 text-red-600">
        Employer profile not found
      </div>
    );
  }

  console.log("Employer Profile:", profile);

  // 👇 onboarding gate
  if ((profile.onboarding_step ?? 0) < 3) {
    return (
      <EmployerOnboarding
        initialStep={profile.onboarding_step ?? 0}
      />
    );
  }

  const hasCandidateMessagingAccess = hasEmployerPaidAccess(profile);

  if (!hasCandidateMessagingAccess) {
    const path = location.pathname.toLowerCase();
    if (path === "/employer/candidates" || path === "/employer/messages") {
      return <Navigate to="/employer/dashboard" replace />;
    }
  }

  return (
    <EmployerLayout>
      <Outlet />
    </EmployerLayout>
  );
}
