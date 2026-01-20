import { Button } from "@/app/components/ui/button";
import { Building2, User, Menu } from "lucide-react";

interface HeaderProps {
  currentProduct: 'skilllink' | 'jobbridge' | 'landing';
  userType?: 'candidate' | 'employer' | null;
  onProductSwitch?: (product: 'skilllink' | 'jobbridge') => void;
}

export function Header({ currentProduct, userType, onProductSwitch }: HeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold text-gray-900">ApexSight</h1>
              <p className="text-xs text-gray-500">Talent Infrastructure</p>
            </div>
            
            {/* Product Tabs */}
            {userType && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => onProductSwitch?.('skilllink')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    currentProduct === 'skilllink'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  SkillLink™
                </button>
                <button
                  onClick={() => onProductSwitch?.('jobbridge')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    currentProduct === 'jobbridge'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  JobBridge™
                </button>
              </div>
            )}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {!userType ? (
              <>
                <Button variant="ghost" className="text-gray-700">
                  Sign In
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Get Started
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  {userType === 'employer' ? (
                    <Building2 className="w-4 h-4 text-blue-600" />
                  ) : (
                    <User className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {userType === 'employer' ? 'Employer Account' : 'Candidate Account'}
                  </span>
                </div>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
