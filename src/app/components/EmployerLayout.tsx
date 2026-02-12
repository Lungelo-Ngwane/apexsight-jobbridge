import { ReactNode } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Building2
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useEmployerProfile } from "../../hooks/useEmployerProfile";
import { NavLink } from "react-router-dom";

interface EmployerLayoutProps {
  children: ReactNode;
}

export function EmployerLayout({ children }: EmployerLayoutProps) {
  const { user, signOut } = useAuth();
  const { profile } = useEmployerProfile();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Fixed Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed left-0 top-16 h-[calc(100vh-4rem)] shadow-sm">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">
                {profile?.company_name ?? "Your Company"}
              </h2>
              <p className="text-xs text-gray-500">Employer Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/employer/dashboard" />
          <SidebarItem icon={Briefcase} label="Jobs" to="/employer/jobs" />
          <SidebarItem icon={Users} label="Candidates" />
          <SidebarItem icon={CreditCard} label="Billing" to="/employer/billing" />
          <SidebarItem icon={Settings} label="Settings" to="/employer/settings" />
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content area with left margin for sidebar */}
      <main className="flex-1 ml-64 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

interface SidebarItemProps {
  icon: any;
  label: string;
  to?: string;
}

function SidebarItem({ icon: Icon, label, to }: SidebarItemProps) {
  if (!to) {
    return (
      <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-all text-gray-400 cursor-not-allowed">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-sm">{label}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-all ${
          isActive
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
          <span className="text-sm">{label}</span>
        </>
      )}
    </NavLink>
  );
}
