import { ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  CreditCard,
  Crown,
  ShoppingBag,
  Settings,
  LogOut,
  Building2
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useEmployerProfile } from "../../hooks/useEmployerProfile";
import { NavLink } from "react-router-dom";
import { getEmployerUnreadMessageCount, subscribeToMyMessageChanges } from "@/lib/messages";
import { hasEmployerPaidAccess } from "@/lib/subscriptionAccess";

interface EmployerLayoutProps {
  children: ReactNode;
}

export function EmployerLayout({ children }: EmployerLayoutProps) {
  const { user, role, signOut } = useAuth();
  const { profile } = useEmployerProfile();
  const [unreadCount, setUnreadCount] = useState(0);
  const hasCandidateMessagingAccess = hasEmployerPaidAccess(profile);

  useEffect(() => {
    if (!user || role !== "employer" || !hasCandidateMessagingAccess) {
      setUnreadCount(0);
      return;
    }

    const refresh = () => {
      getEmployerUnreadMessageCount()
        .then(setUnreadCount)
        .catch((error) => console.error("Failed to load employer unread messages", error));
    };

    refresh();
    const unsub = subscribeToMyMessageChanges(refresh);

    return () => {
      unsub();
    };
  }, [hasCandidateMessagingAccess, user, role]);

  return (
    <div className="min-h-screen md:flex bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col fixed left-0 top-16 h-[calc(100vh-4rem)] shadow-sm">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt={`${profile?.company_name ?? "Company"} logo`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              )}
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
          <SidebarItem
            icon={Users}
            label="Candidates"
            to={hasCandidateMessagingAccess ? "/employer/candidates" : undefined}
          />
          <SidebarItem
            icon={MessageSquare}
            label="Messages"
            to={hasCandidateMessagingAccess ? "/employer/messages" : undefined}
            badgeCount={hasCandidateMessagingAccess ? unreadCount : 0}
          />
          <SidebarItem icon={Crown} label="Plans" to="/employer/plans" />
          <SidebarItem icon={ShoppingBag} label="Add-ons" to="/employer/addons" />
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

      {/* Mobile top nav */}
      <div className="md:hidden bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md overflow-hidden border border-gray-200 bg-white flex items-center justify-center shrink-0">
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt={`${profile?.company_name ?? "Company"} logo`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {profile?.company_name ?? "Employer Portal"}
            </p>
          </div>
        </div>
        <nav className="px-2 pb-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <MobileNavItem label="Dashboard" to="/employer/dashboard" />
            <MobileNavItem label="Jobs" to="/employer/jobs" />
            <MobileNavItem
              label="Candidates"
              to={hasCandidateMessagingAccess ? "/employer/candidates" : ""}
            />
            <MobileNavItem
              label="Messages"
              to={hasCandidateMessagingAccess ? "/employer/messages" : ""}
              badgeCount={hasCandidateMessagingAccess ? unreadCount : 0}
            />
            <MobileNavItem label="Plans" to="/employer/plans" />
            <MobileNavItem label="Add-ons" to="/employer/addons" />
            <MobileNavItem label="Billing" to="/employer/billing" />
            <MobileNavItem label="Settings" to="/employer/settings" />
            <Button
              variant="ghost"
              className="h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </nav>
      </div>

      {/* Main content area */}
      <main className="flex-1 md:ml-64 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

interface SidebarItemProps {
  icon: any;
  label: string;
  to?: string;
  badgeCount?: number;
}

function SidebarItem({ icon: Icon, label, to, badgeCount = 0 }: SidebarItemProps) {
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
          {badgeCount > 0 && (
            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-semibold inline-flex items-center justify-center">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function MobileNavItem({ label, to, badgeCount = 0 }: { label: string; to: string; badgeCount?: number }) {
  if (!to) {
    return (
      <button className="h-9 px-3 rounded-lg text-sm whitespace-nowrap inline-flex items-center text-gray-400 cursor-not-allowed">
        <span>{label}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `h-9 px-3 rounded-lg text-sm whitespace-nowrap inline-flex items-center ${
          isActive
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-700 hover:bg-gray-50"
        }`
      }
    >
      <span>{label}</span>
      {badgeCount > 0 && (
        <span className="ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold inline-flex items-center justify-center">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </NavLink>
  );
}
