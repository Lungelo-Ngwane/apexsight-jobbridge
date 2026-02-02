import { EmployerLayout } from "./EmployerLayout";
import { EmployerDashboard } from "./EmployerDashboard";
import { EmployerOnboarding } from "./EmployerOnboarding";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";

export function EmployerApp() {
  const { profile, loading } = useEmployerProfile();

  if (loading) {
    return <div className="p-8">Loading employer data...</div>;
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

  return (
    <EmployerLayout>
      <EmployerDashboard />
    </EmployerLayout>
  );
}
