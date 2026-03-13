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
  Building2,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { NavLink } from "react-router-dom";
import { getEmployerUnreadMessageCount, subscribeToMyMessageChanges } from "@/lib/messages";
import { getSupabaseTransformedImageUrl } from "@/lib/image";
import { hasEmployerPaidAccess } from "@/lib/subscriptionAccess";
import { useTheme } from "../context/ThemeContext";
import type { EmployerMembershipRole } from "@/lib/employer";

interface EmployerLayoutProps {
  children: ReactNode;
  profile?: any | null;
  membershipRole?: EmployerMembershipRole | null;
}

export function EmployerLayout({
  children,
  profile = null,
  membershipRole = null,
}: EmployerLayoutProps) {
  const { user, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const hasCandidateMessagingAccess = hasEmployerPaidAccess(profile);
  const canManageWorkspace = membershipRole === "owner" || membershipRole === "admin";
  const desktopLogoUrl = getSupabaseTransformedImageUrl(profile?.logo_url, {
    width: 80,
    height: 80,
    resize: "cover",
    quality: 75,
  });
  const mobileLogoUrl = getSupabaseTransformedImageUrl(profile?.logo_url, {
    width: 64,
    height: 64,
    resize: "cover",
    quality: 75,
  });

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
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 md:flex">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 flex-col border-r border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-950 md:flex">
        {/* Sidebar Header */}
        <div className="border-b border-gray-100 p-6 dark:border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-neutral-900">
              {desktopLogoUrl ? (
                <img
                  src={desktopLogoUrl}
                  alt={`${profile?.company_name ?? "Company"} logo`}
                  width={40}
                  height={40}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 dark:text-white">
                {profile?.company_name ?? "Your Company"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Employer Portal</p>
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
          <SidebarItem icon={Crown} label="Plans" to={canManageWorkspace ? "/employer/plans" : undefined} />
          <SidebarItem icon={ShoppingBag} label="Add-ons" to={canManageWorkspace ? "/employer/addons" : undefined} />
          <SidebarItem icon={CreditCard} label="Billing" to={canManageWorkspace ? "/employer/billing" : undefined} />
          <SidebarItem icon={Settings} label="Settings" to={canManageWorkspace ? "/employer/settings" : undefined} />
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 dark:border-white/10">
          <Button
            variant="outline"
            className="mb-2 w-full justify-start border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-800"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="mr-3 h-4 w-4" /> : <Moon className="mr-3 h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="sticky top-16 z-40 border-b border-gray-200 bg-white dark:border-white/10 dark:bg-neutral-950 md:hidden">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white dark:border-white/10 dark:bg-neutral-900">
              {mobileLogoUrl ? (
                <img
                  src={mobileLogoUrl}
                  alt={`${profile?.company_name ?? "Company"} logo`}
                  width={32}
                  height={32}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
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
            <MobileNavItem label="Plans" to={canManageWorkspace ? "/employer/plans" : ""} />
            <MobileNavItem label="Add-ons" to={canManageWorkspace ? "/employer/addons" : ""} />
            <MobileNavItem label="Billing" to={canManageWorkspace ? "/employer/billing" : ""} />
            <MobileNavItem label="Settings" to={canManageWorkspace ? "/employer/settings" : ""} />
            <Button
              variant="outline"
              className="h-9 shrink-0 border-gray-200 px-3 text-gray-700 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-200"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === "dark" ? "Light" : "Dark"}
            </Button>
            <Button
              variant="ghost"
              className="h-9 shrink-0 px-3 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </nav>
      </div>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto md:ml-64">
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
      <button className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-left text-gray-400 transition-all dark:text-gray-500">
        <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
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
            ? "bg-blue-50 text-blue-700 font-medium dark:bg-neutral-900 dark:text-white"
            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-neutral-900 dark:hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`h-4 w-4 ${isActive ? "text-blue-600 dark:text-white" : "text-gray-500 dark:text-gray-400"}`} />
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
            ? "bg-blue-50 text-blue-700 font-medium dark:bg-neutral-900 dark:text-white"
            : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-neutral-900"
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
