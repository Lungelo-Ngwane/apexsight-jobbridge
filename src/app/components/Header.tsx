import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { ChevronDown, Settings, LogOut, HelpCircle, MessageCircle, Briefcase, Inbox, CheckCheck, Moon, Sun, Menu, LayoutDashboard } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/app/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import whiteLogo from "../assets/apexsight_white_logo_transparent.png";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  type ConversationThread,
  getCandidateUnreadMessageCount,
  getConversationThreads,
  markAllMyMessagesRead,
  subscribeToMyMessageChanges,
} from "@/lib/messages";

interface HeaderProps {
  currentProduct: "skilllink" | "jobbridge" | "landing";
  onProductSwitch?: (product: "skilllink" | "jobbridge") => void;
  onProfileClick?: () => void;
  onSignInClick?: () => void;
  onGetStartedClick?: () => void;
  onPricingClick?: () => void;
}

export function Header({
  currentProduct,
  onProductSwitch,
  onProfileClick,
  onSignInClick,
  onGetStartedClick,
  onPricingClick,
}: HeaderProps) {
  const { user, role, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [candidateUnreadCount, setCandidateUnreadCount] = useState(0);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [candidateThreads, setCandidateThreads] = useState<ConversationThread[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const formatThreadTime = (value: string | null) => {
    if (!value) return "New";
    const date = new Date(value);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString();
  };

  const handleBrandClick = () => {
    if (role === "candidate") {
      navigate("/candidate/dashboard");
      return;
    }

    if (role === "employer") {
      navigate("/employer/dashboard");
      return;
    }

    navigate("/");
  };

  const refreshCandidateInboxData = () => {
    if (!user || role !== "candidate") return;

    getCandidateUnreadMessageCount()
      .then(setCandidateUnreadCount)
      .catch((error) => console.error("Failed to load candidate unread messages", error));

    if (inboxOpen) {
      setThreadsLoading(true);
      getConversationThreads()
        .then((threads) => setCandidateThreads(threads.slice(0, 8)))
        .catch((error) => console.error("Failed to load candidate inbox threads", error))
        .finally(() => setThreadsLoading(false));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    if (!user || role !== "candidate") {
      setCandidateUnreadCount(0);
      setCandidateThreads([]);
      return;
    }

    let unsub: (() => void) | null = null;
    const refresh = () => refreshCandidateInboxData();

    refresh();
    unsub = subscribeToMyMessageChanges(refresh);

    return () => {
      if (unsub) unsub();
    };
  }, [user, role, inboxOpen]);

  useEffect(() => {
    if (!inboxOpen || role !== "candidate") return;
    refreshCandidateInboxData();
  }, [inboxOpen, role]);

  if (loading) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-black/8 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/95">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3 sm:gap-8">
          <div className="min-w-0 flex items-center gap-3 sm:gap-6">
            <button
              type="button"
              onClick={handleBrandClick}
              className="flex min-w-0 items-center gap-2.5 rounded-2xl px-1 py-1 text-left transition"
              aria-label="Go to dashboard"
            >
              <img
                src={whiteLogo}
                alt="ApexSight Logo"
                width={192}
                height={48}
                className={`h-10 w-auto shrink-0 sm:h-12 ${theme === "dark" ? "" : "brightness-0"}`}
              />
              <div className="flex flex-col justify-center">
                <span className="text-sm font-semibold tracking-[0.04em] text-neutral-900 dark:text-white">
                  ApexSight
                </span>
                <p className="hidden text-[11px] tracking-[0.03em] text-neutral-500 dark:text-neutral-400 sm:block">
                  Talent platform
                </p>
              </div>
            </button>

            {isAuthenticated && role && (
              <button
                type="button"
                onClick={() => onProductSwitch?.(role === "candidate" ? "skilllink" : "jobbridge")}
                className="hidden items-center gap-3 text-sm font-bold text-neutral-700 transition hover:text-neutral-950 md:inline-flex"
              >
                <span className="text-neutral-300">|</span>
                <span className="dark:text-neutral-200">
                  {role === "candidate" ? "SkillLink" : "JobBridge"}
                  <sup className="ml-0.5 text-[0.55em] font-bold align-super">TM</sup>
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 sm:gap-4 md:flex">
              {!isAuthenticated ? (
                <>
                  {(currentProduct === "jobbridge" || currentProduct === "landing") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full px-3 text-neutral-700 hover:bg-white/70 hover:text-neutral-950 sm:px-4"
                      onClick={onPricingClick}
                    >
                      Pricing
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-3 text-neutral-700 hover:bg-white/70 hover:text-neutral-950 sm:px-4"
                    onClick={onSignInClick}
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full bg-neutral-950 px-4 text-white hover:bg-neutral-800 sm:px-5"
                    onClick={onGetStartedClick ?? onSignInClick}
                  >
                    Get Started
                  </Button>
                </>
              ) : (
                <>
                  {role === "candidate" && (
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/8 bg-white/80 text-neutral-700 transition hover:bg-white hover:text-neutral-950 dark:border-white/12 dark:bg-white/6 dark:text-neutral-200 dark:hover:bg-white/10 dark:hover:text-white"
                      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    >
                      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                  )}
                  {role === "candidate" && (
                    <button
                      onClick={() => setInboxOpen(true)}
                      className={`relative inline-flex h-10 items-center gap-2 rounded-full border px-3 transition ${
                        location.pathname === "/candidate/messages"
                          ? "border-neutral-900 bg-neutral-950 text-white"
                          : "border-black/8 bg-white/80 text-neutral-700 hover:bg-white"
                      }`}
                      aria-label="Open inbox"
                    >
                      <Inbox className="h-4 w-4" />
                      <span className="hidden text-sm font-medium sm:inline">Inbox</span>
                      {candidateUnreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                          {candidateUnreadCount > 99 ? "99+" : candidateUnreadCount}
                        </span>
                      )}
                    </button>
                  )}
                  {role === "candidate" && (
                    <button
                      onClick={() => navigate("/candidate/my-jobs")}
                      className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 transition ${
                        location.pathname === "/candidate/my-jobs"
                          ? "border-neutral-900 bg-neutral-950 text-white"
                          : "border-black/8 bg-white/80 text-neutral-700 hover:bg-white"
                      }`}
                      aria-label="Open my jobs"
                    >
                      <Briefcase className="h-4 w-4" />
                      <span className="hidden text-sm font-medium sm:inline">My Jobs</span>
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-3 py-2 shadow-[0_8px_24px_rgba(15,15,15,0.05)] hover:bg-white">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src="" />
                          <AvatarFallback className="bg-neutral-950 text-sm text-white">
                            {avatarInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden text-left md:block">
                          <div className="text-sm font-medium text-neutral-900">{fullName}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{displayRole}</div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-neutral-500" />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-56 border-black/5 bg-white">
                      <DropdownMenuLabel>
                        <div className="flex flex-col">
                          <span className="font-medium">{fullName}</span>
                          <span className="text-xs text-gray-500">{email}</span>
                        </div>
                      </DropdownMenuLabel>

                      <DropdownMenuSeparator />

                      {role === "candidate" && (
                        <DropdownMenuItem onClick={() => navigate("/candidate/dashboard")}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Dashboard
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem onClick={onProfileClick}>
                        <Settings className="mr-2 h-4 w-4" />
                        Profile Settings
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => setSupportOpen(true)}>
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help & Support
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/8 bg-white/80 text-neutral-700 transition hover:bg-white hover:text-neutral-950 md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-sm md:hidden">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-gray-200 p-5">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>
                Quick navigation and account actions
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!isAuthenticated ? (
                <>
                  {(currentProduct === "jobbridge" || currentProduct === "landing") && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onPricingClick?.();
                      }}
                    >
                      Pricing
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignInClick?.();
                    }}
                  >
                    Sign In
                  </Button>
                  <Button
                    className="w-full justify-start bg-neutral-950 text-white hover:bg-neutral-800"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      (onGetStartedClick ?? onSignInClick)?.();
                    }}
                  >
                    Get Started
                  </Button>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-neutral-950 text-sm text-white">
                          {avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">{fullName}</p>
                        <p className="truncate text-xs uppercase tracking-[0.16em] text-neutral-500">{displayRole}</p>
                      </div>
                    </div>
                  </div>

                  {role === "candidate" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate("/candidate/dashboard");
                      }}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Button>
                  )}

                  {role === "candidate" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        toggleTheme();
                      }}
                    >
                      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </Button>
                  )}

                  {role === "candidate" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setInboxOpen(true);
                      }}
                    >
                      <Inbox className="h-4 w-4" />
                      Inbox
                      {candidateUnreadCount > 0 && (
                        <Badge className="ml-auto border-red-200 bg-red-100 text-red-700">
                          {candidateUnreadCount > 99 ? "99+" : candidateUnreadCount}
                        </Badge>
                      )}
                    </Button>
                  )}

                  {role === "candidate" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate("/candidate/my-jobs");
                      }}
                    >
                      <Briefcase className="h-4 w-4" />
                      My Jobs
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onProfileClick?.();
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    Profile Settings
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setSupportOpen(true);
                    }}
                  >
                    <HelpCircle className="h-4 w-4" />
                    Help & Support
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={inboxOpen} onOpenChange={setInboxOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SheetTitle className="text-lg">Inbox</SheetTitle>
                  <SheetDescription className="mt-1 text-xs">
                    Recent conversations and updates
                  </SheetDescription>
                </div>
                {candidateUnreadCount > 0 && (
                  <Badge className="border-red-200 bg-red-100 text-red-700">
                    {candidateUnreadCount} unread
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {threadsLoading && (
                <div className="py-8">
                  <CircularLoader size="sm" label="Loading inbox..." />
                </div>
              )}

              {!threadsLoading && candidateThreads.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <p className="text-sm font-medium text-gray-800">No conversations yet</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Employers will appear here when they message you.
                  </p>
                </div>
              )}

              {!threadsLoading &&
                candidateThreads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setInboxOpen(false);
                      navigate("/candidate/messages");
                    }}
                    className="w-full rounded-xl border border-gray-200 p-3 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{thread.counterpartName}</p>
                        <p className="mt-1 truncate text-xs text-gray-600">
                          {thread.lastMessagePreview ?? "Start the conversation"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-gray-500">
                        {formatThreadTime(thread.lastMessageAt ?? thread.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-2 border-t border-gray-200 p-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  try {
                    await markAllMyMessagesRead();
                    await refreshCandidateInboxData();
                  } catch (error) {
                    console.error("Failed to mark all messages as read", error);
                  }
                }}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all read
              </Button>
              <Button
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  setInboxOpen(false);
                  navigate("/candidate/messages");
                }}
              >
                Open messages
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Help & Support</DialogTitle>
            <DialogDescription>
              Quick answers and ways to contact the ApexSight support team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Common questions</h3>
              <div className="mt-3 space-y-3 text-sm text-gray-700">
                <div>
                  <p className="font-medium text-gray-900">I forgot my password</p>
                  <p>Use the Forgot Password link on the sign-in form to receive a reset email.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">How do I complete my profile?</p>
                  <p>Open your profile from the top-right menu and fill in your details, skills, and CV.</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">How can I get my Overall Readiness Score to 100%?</p>
                  <p>
                    Complete your full profile, add your professional summary, location, experience,
                    at least one skill, upload your CV, and add certifications or assessment activity.
                    The score increases as more of these sections are completed.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Contact support</h3>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => window.location.assign("mailto:support@apexsight.co.za")}
                >
                  Email Support
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    window.location.assign("mailto:support@apexsight.co.za?subject=ApexSight%20Support%20Request")
                  }
                >
                  Report an Issue
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
