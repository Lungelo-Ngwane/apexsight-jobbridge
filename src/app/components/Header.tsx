import { Button } from "@/app/components/ui/button";
import { Building2, User, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";
// import { useAuth } from '@/context/AuthContext';  // adjust path

interface HeaderProps {
  currentProduct: 'skilllink' | 'jobbridge' | 'landing';
  onProductSwitch?: (product: 'skilllink' | 'jobbridge') => void;
  onSignInClick?: () => void;
}

export function Header({ currentProduct, onProductSwitch, onSignInClick }: HeaderProps) {
  const { role, loading, signOut } = useAuth();

  // Optional: don't show anything fancy while loading
  if (loading) {
    return (
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-gray-900">ApexSight</h1>
            <p className="text-xs text-gray-500">Talent Infrastructure</p>
          </div>
          <div>Loading...</div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-gray-900">ApexSight</h1>
            <p className="text-xs text-gray-500">Talent Infrastructure</p>
          </div>

          {role && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onProductSwitch?.('skilllink')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${currentProduct === 'skilllink'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                SkillLink™
              </button>
              <button
                onClick={() => onProductSwitch?.('jobbridge')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${currentProduct === 'jobbridge'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                JobBridge™
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!role ? (
            <Button variant="ghost" onClick={onSignInClick}>
              Sign In
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                {role === 'employer' ? (
                  <Building2 className="w-4 h-4 text-blue-600" />
                ) : (
                  <User className="w-4 h-4 text-blue-600" />
                )}
                <span className="text-sm font-medium text-gray-700">
                  {role === 'employer' ? 'Employer Account' : 'Candidate Account'}
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={signOut}
                className="text-red-600 hover:text-red-700"
              >
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}