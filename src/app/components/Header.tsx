import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { ChevronDown, Settings, LogOut, HelpCircle, MessageCircle, Briefcase, Inbox, CheckCheck } from "lucide-react";
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
import logo from "../assets/ApexSight_logo.png";
import { useAuth } from "../context/AuthContext";
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
}

export function Header({
  currentProduct,
  onProductSwitch,
  onProfileClick,
  onSignInClick,
  onGetStartedClick
}: HeaderProps) {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate(); // <-- for redirect after logout
  const location = useLocation();
  const [candidateUnreadCount, setCandidateUnreadCount] = useState(0);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [candidateThreads, setCandidateThreads] = useState<ConversationThread[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);

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
      setCandidateThreads([]);
      return;
    }

    let unsub: (() => void) | null = null;

    const refresh = () => refreshCandidateInboxData();

    refresh();
    unsub = subscribeToMyMessageChanges(refresh);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      if (unsub) unsub();
      window.removeEventListener("focus", onFocus);
    };
  }, [user, role, inboxOpen]);

  useEffect(() => {
    if (!inboxOpen || role !== "candidate") return;
    refreshCandidateInboxData();
  }, [inboxOpen, role]);

  if (loading) return null;

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3 sm:gap-8">
          {/* Logo + Products */}
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <button
              type="button"
              onClick={handleBrandClick}
              className="flex items-center gap-2 sm:gap-2.5 min-w-0 rounded-lg px-1 py-1 text-left hover:bg-gray-50"
              aria-label="Go to dashboard"
            >
              <img src={logo} alt="ApexSight Logo" className="h-8 sm:h-10 w-auto shrink-0" />
              <div className="flex flex-col">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">ApexSight</h1>
                <p className="hidden sm:block text-[10px] text-gray-500 leading-none">Talent Infrastructure</p>
              </div>
            </button>

            {isAuthenticated && role && (
              <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1">
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
          <div className="flex items-center gap-2 sm:gap-4">
            {!isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" className="px-2 sm:px-4" onClick={onSignInClick}>Sign In</Button>
                <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700 px-3 sm:px-4" onClick={onGetStartedClick ?? onSignInClick}>
                  Get Started
                </Button>
              </>
            ) : (
              <>
                {role === "candidate" && (
                  <button
                    onClick={() => setInboxOpen(true)}
                    className={`relative inline-flex items-center gap-2 h-10 px-3 rounded-lg transition border ${
                      location.pathname === "/candidate/messages"
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                    aria-label="Open inbox"
                  >
                    <Inbox className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm font-medium">Inbox</span>
                    {candidateUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {candidateUnreadCount > 99 ? "99+" : candidateUnreadCount}
                      </span>
                    )}
                  </button>
                )}
                {role === "candidate" && (
                  <button
                    onClick={() => navigate("/candidate/my-jobs")}
                    className={`inline-flex items-center gap-2 h-10 px-3 rounded-lg transition border ${
                      location.pathname === "/candidate/my-jobs"
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                    aria-label="Open my jobs"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm font-medium">My Jobs</span>
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

                    <DropdownMenuItem onClick={() => setSupportOpen(true)}>
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
      <Sheet open={inboxOpen} onOpenChange={setInboxOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <div className="h-full flex flex-col">
            <SheetHeader className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SheetTitle className="text-lg">Inbox</SheetTitle>
                  <SheetDescription className="text-xs mt-1">
                    Recent conversations and updates
                  </SheetDescription>
                </div>
                {candidateUnreadCount > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-red-200">
                    {candidateUnreadCount} unread
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {threadsLoading && (
                <div className="py-8">
                  <CircularLoader size="sm" label="Loading inbox..." />
                </div>
              )}

              {!threadsLoading && candidateThreads.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
                  <MessageCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-800">No conversations yet</p>
                  <p className="text-xs text-gray-500 mt-1">
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
                    className="w-full text-left rounded-xl border border-gray-200 p-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{thread.counterpartName}</p>
                        <p className="text-xs text-gray-600 truncate mt-1">
                          {thread.lastMessagePreview ?? "Start the conversation"}
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-500 shrink-0">
                        {formatThreadTime(thread.lastMessageAt ?? thread.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
            </div>

            <div className="p-4 border-t border-gray-200 flex items-center gap-2">
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
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
                    Complete your full profile, add your professional summary, location, experience, at least one skill,
                    upload your CV, and add certifications or assessment activity. The score increases as more of these
                    sections are completed.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Contact support</h3>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => window.location.assign("mailto:support@apexsight.co.za")}
                >
                  Email Support
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.assign("mailto:support@apexsight.co.za?subject=ApexSight%20Support%20Request")}
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
