import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { ChevronDown, Settings, LogOut, HelpCircle, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import logo from "../assets/ApexSight_logo.png";
import { useAuth } from "../context/AuthContext";
import { getCandidateUnreadMessageCount, subscribeToMyMessageChanges } from "@/lib/messages";

interface HeaderProps {
  currentProduct: "skilllink" | "jobbridge" | "landing";
  onProductSwitch?: (product: "skilllink" | "jobbridge") => void;
  onProfileClick?: () => void;
  onSignInClick?: () => void;
}

export function Header({
  currentProduct,
  onProductSwitch,
  onProfileClick,
  onSignInClick
}: HeaderProps) {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate(); // <-- for redirect after logout
  const [candidateUnreadCount, setCandidateUnreadCount] = useState(0);

  const isAuthenticated = !!user && !!role;

  const email = user?.email ?? "";
  const fullName = user?.user_metadata?.full_name || email.split("@")[0];
  const displayRole = role === "employer" ? "Employer" : "Candidate";
  const avatarInitials = fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ✅ Logout handler
  const handleLogout = async () => {
    try {
      await signOut();      // sign out from Supabase
      navigate("/");        // redirect to home page
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    if (!user || role !== "candidate") {
      setCandidateUnreadCount(0);
      return;
    }

    let unsub: (() => void) | null = null;

    const refresh = () => {
      getCandidateUnreadMessageCount()
        .then(setCandidateUnreadCount)
        .catch((error) => console.error("Failed to load candidate unread messages", error));
    };

    refresh();
    unsub = subscribeToMyMessageChanges(refresh);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      if (unsub) unsub();
      window.removeEventListener("focus", onFocus);
    };
  }, [user, role]);

  if (loading) return null;

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-8">
          {/* Logo + Products */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="ApexSight Logo" className="h-10 w-auto" />
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-gray-900">ApexSight</h1>
                <p className="text-[10px] text-gray-500 leading-none">Talent Infrastructure</p>
              </div>
            </div>

            {isAuthenticated && role && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {role === "candidate" && (
                  <button
                    onClick={() => onProductSwitch?.("skilllink")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      currentProduct === "skilllink"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    SkillLink™
                  </button>
                )}
                {role === "employer" && (
                  <button
                    onClick={() => onProductSwitch?.("jobbridge")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      currentProduct === "jobbridge"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    JobBridge™
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {!isAuthenticated ? (
              <>
                <Button variant="ghost"  onClick={onSignInClick}>Sign In</Button>
                <Button className="bg-blue-600 text-white hover:bg-blue-700">
                  Get Started
                </Button>
              </>
            ) : (
              <>
                {role === "candidate" && (
                  <button
                    onClick={() => navigate("/candidate/messages")}
                    className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
                    aria-label="Open messages"
                  >
                    <MessageCircle className="w-5 h-5 text-gray-700" />
                    {candidateUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {candidateUnreadCount > 99 ? "99+" : candidateUnreadCount}
                      </span>
                    )}
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-blue-600 text-white text-sm">
                          {avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden md:block text-left">
                        <div className="text-sm font-medium text-gray-900">{fullName}</div>
                        <div className="text-xs text-gray-500">{displayRole}</div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{fullName}</span>
                        <span className="text-xs text-gray-500">{email}</span>
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={onProfileClick}>
                      <Settings className="w-4 h-4 mr-2" />
                      Profile Settings
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Help & Support
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
