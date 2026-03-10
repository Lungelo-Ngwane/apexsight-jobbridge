import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  Plus,
  Users,
  Briefcase,
  Clock,
  TrendingUp,
  Eye,
  Star,
  CheckCircle,
  MessageSquare,
  Filter,
  Search,
  MoreVertical,
  Crown,
  Bot
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { useNavigate } from "react-router-dom";
// import { PostJobModal } from "./components/PostJobModal";
import { useAuth } from "../context/AuthContext";
import {
  createJob,
  getEmployerCredits,
  getEmployerJobs,
  getEmployerUsageSnapshot,
  getJobApplicants,
  updateJobStatus,
  updateApplicationStatus,
  getEmployerAnalytics,
  getEmployerPremiumDashboardInsights,
  type EmployerRecentActivityItem,
  type EmployerCreditBalance,
  type EmployerPremiumDashboardInsights,
  type EmployerUsageSnapshot,
} from '@/lib/employer';
import { StatBox } from "./ui/statbox";
import { PostJobModal } from "./PostJobModal";
import { JobCandidatesModal } from "./JobCandidatesModal";
import { useEmployerProfile } from "../../hooks/useEmployerProfile";
import { UpgradeModal } from "./UpgradeModal";
import { Skeleton } from "./ui/skeleton";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { getCachedQuery, invalidateQueryCacheByPrefix } from "@/lib/queryCache";
import { hasEmployerPaidAccess, isActiveEmployerTrial } from "@/lib/subscriptionAccess";
import { CircularLoader } from "@/app/components/ui/circular-loader";

// import { getEmployerOpenJobs } from "../../lib/employer";


interface EmployerDashboardProps {
  onPostJob: () => void;
  onViewCandidates: () => void;
}

const RECENT_ACTIVITY_LIMIT = 4;

function mergeRecentActivities(
  latest: EmployerRecentActivityItem[],
  existing: EmployerRecentActivityItem[],
  limit = RECENT_ACTIVITY_LIMIT,
) {
  const combined = [...latest, ...existing];
  const deduped = new Map<string, EmployerRecentActivityItem>();

  for (const item of combined) {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit);
}

export function EmployerDashboard({ onPostJob, onViewCandidates }: EmployerDashboardProps) {
  const navigate = useNavigate();
  const analyticsSectionRef = useRef<HTMLDivElement | null>(null);
  const { user, role, loading } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [showPostJob, setShowPostJob] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<any | null>(null);
  const [activeJobMenuId, setActiveJobMenuId] = useState<string | null>(null);
  const [totalOpenJobs, setTotalOpenJobs] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const JOBS_PER_PAGE = 3;
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE);
  const [showJobFilters, setShowJobFilters] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const { profile, loading: profileLoading } = useEmployerProfile();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [creditBalances, setCreditBalances] = useState<EmployerCreditBalance[]>([]);
  const [usageSnapshot, setUsageSnapshot] = useState<EmployerUsageSnapshot | null>(null);
  const [premiumInsights, setPremiumInsights] = useState<EmployerPremiumDashboardInsights | null>(null);
  const [premiumInsightsLoading, setPremiumInsightsLoading] = useState(false);
  const showAnalyticsSkeleton = useDelayedLoading(analyticsLoading && !stats, 180);
  const recentActivityStorageKey = user?.id ? `employer_recent_activity_${user.id}` : null;

  const cachePrefix = user?.id ? `employer-dashboard:${user.id}` : null;
  const keyFor = useCallback(
    (segment: string) => (cachePrefix ? `${cachePrefix}:${segment}` : segment),
    [cachePrefix],
  );

  const loadDashboardMetrics = useCallback(
    async (options?: { force?: boolean }) => {
      if (!user) return;
      const force = Boolean(options?.force);

      try {
        setAnalyticsLoading(true);

        const [analytics, credits, usage] = await Promise.all([
          getCachedQuery(keyFor("analytics"), 60_000, getEmployerAnalytics, { force }),
          getCachedQuery(keyFor("credits"), 45_000, getEmployerCredits, { force }),
          getCachedQuery(keyFor("usage"), 20_000, getEmployerUsageSnapshot, { force }),
        ]);

        setStats(analytics);
        setCreditBalances(credits);
        setUsageSnapshot(usage);
      } catch (error) {
        console.error("Failed to load employer dashboard metrics", error);
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [keyFor, user],
  );

  const loadJobs = useCallback(
    async (options?: { force?: boolean }) => {
      if (!user) return;
      const force = Boolean(options?.force);

      try {
        setJobsLoading(true);
        const data = await getCachedQuery(keyFor("jobs"), 20_000, getEmployerJobs, { force });
        setJobs(data || []);
        setVisibleCount(JOBS_PER_PAGE);
      } catch (err) {
        console.error("Failed to load jobs", err);
      } finally {
        setJobsLoading(false);
      }
    },
    [keyFor, user],
  );

  const loadPremiumInsights = useCallback(
    async (options?: { force?: boolean }) => {
      if (!user) return;
      const force = Boolean(options?.force);

      try {
        setPremiumInsightsLoading(true);
        const data = await getCachedQuery(
          keyFor("premium-insights"),
          30_000,
          getEmployerPremiumDashboardInsights,
          { force },
        );
        setPremiumInsights((prev) => {
          const mergedRecentActivity = mergeRecentActivities(
            data?.recentActivity ?? [],
            prev?.recentActivity ?? [],
          );
          const nextInsights = {
            ...data,
            recentActivity: mergedRecentActivity,
          };

          if (recentActivityStorageKey && typeof window !== "undefined") {
            window.localStorage.setItem(
              recentActivityStorageKey,
              JSON.stringify(mergedRecentActivity),
            );
          }

          return nextInsights;
        });
      } catch (error) {
        console.error("Failed to load premium dashboard insights", error);
      } finally {
        setPremiumInsightsLoading(false);
      }
    },
    [keyFor, recentActivityStorageKey, user],
  );

  useEffect(() => {
    if (!recentActivityStorageKey || typeof window === "undefined") return;

    const cachedValue = window.localStorage.getItem(recentActivityStorageKey);
    if (!cachedValue) return;

    try {
      const parsed = JSON.parse(cachedValue) as EmployerRecentActivityItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      setPremiumInsights((prev) => ({
        recentActivity: mergeRecentActivities(parsed, prev?.recentActivity ?? []),
        talentPoolInsights: prev?.talentPoolInsights ?? [],
      }));
    } catch (error) {
      console.error("Failed to parse cached employer recent activity", error);
    }
  }, [recentActivityStorageKey]);

  useEffect(() => {
    void loadDashboardMetrics();
  }, [loadDashboardMetrics]);

  useEffect(() => {
    function handleCandidateViewConsumed(
      event: Event,
    ) {
      const custom = event as CustomEvent<{
        candidateViewsUsedThisMonth?: number;
        candidateViewLimit?: number | null;
      }>;
      const used = Number(custom.detail?.candidateViewsUsedThisMonth ?? NaN);
      const limit = custom.detail?.candidateViewLimit;

      if (Number.isFinite(used)) {
        setUsageSnapshot((prev) =>
          prev
            ? {
                ...prev,
                candidateViewsUsedThisMonth: used,
                candidateViewLimit:
                  limit === undefined ? prev.candidateViewLimit : limit,
              }
            : prev,
        );
      } else {
        void loadDashboardMetrics({ force: true });
      }
    }

    window.addEventListener("candidate-view-consumed", handleCandidateViewConsumed);
    return () => {
      window.removeEventListener("candidate-view-consumed", handleCandidateViewConsumed);
    };
  }, [loadDashboardMetrics]);


  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    function handleWindowClick() {
      setActiveJobMenuId(null);
    }

    if (!activeJobMenuId) return;

    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, [activeJobMenuId]);

  const openJobs = jobs.filter((job) => job.status === 'open');
  const employmentTypeOptions = Array.from(
    new Set(
      openJobs
        .map((job) => String(job.employment_type ?? "").trim())
        .filter(Boolean),
    ),
  );
  const filteredOpenJobs = openJobs.filter((job) => {
    const normalizedSearch = jobSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      String(job.title ?? "").toLowerCase().includes(normalizedSearch) ||
      String(job.location ?? "").toLowerCase().includes(normalizedSearch);
    const normalizedType = String(job.employment_type ?? "").trim();
    const matchesType =
      jobTypeFilter === "all" || normalizedType.toLowerCase() === jobTypeFilter.toLowerCase();

    return matchesSearch && matchesType;
  });
  const activeJobFilterCount =
    (jobSearchQuery.trim() ? 1 : 0) + (jobTypeFilter !== "all" ? 1 : 0);

  const plan = profile?.plan ?? "free";
  const trialActive = isActiveEmployerTrial(profile);
  const trialEndsAtMs = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : null;
  const trialDaysLeft =
    trialActive && trialEndsAtMs
      ? Math.max(1, Math.ceil((trialEndsAtMs - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;
  const selectedPlanRaw = String(
    (profile as { selected_plan?: string | null } | null)?.selected_plan ?? "",
  ).toLowerCase();
  const selectedPendingPlan =
    selectedPlanRaw === "starter" || selectedPlanRaw === "professional" || selectedPlanRaw === "enterprise"
      ? selectedPlanRaw
      : null;
  const hasPendingPayment =
    String((profile as { subscription_status?: string | null } | null)?.subscription_status ?? "").toLowerCase() === "pending_payment" &&
    Boolean(selectedPendingPlan);
  const hasResolvedPlan = !profileLoading;
  const hasPaidAccess = hasEmployerPaidAccess(profile);
  const hasAnalytics = hasPaidAccess;
  const hasPremium = hasPaidAccess;
  const hasPremiumInsights = hasPaidAccess;
  const hasCandidateMessagingAccess = hasPaidAccess;
  const activeJobs = Number(usageSnapshot?.activeJobs ?? 0);
  const finiteJobLimit =
    typeof usageSnapshot?.jobLimit === "number" ? usageSnapshot.jobLimit : null;
  const isOverJobLimit = finiteJobLimit !== null && activeJobs >= finiteJobLimit;

  const refreshDashboardData = useCallback(async () => {
    if (!cachePrefix) return;
    invalidateQueryCacheByPrefix(cachePrefix);

    await Promise.all([
      loadDashboardMetrics({ force: true }),
      loadJobs({ force: true }),
      hasPremiumInsights ? loadPremiumInsights({ force: true }) : Promise.resolve(),
    ]);
  }, [cachePrefix, hasPremiumInsights, loadDashboardMetrics, loadJobs, loadPremiumInsights]);

  const handleCloseJob = useCallback(
    async (jobId: string) => {
      try {
        await updateJobStatus(jobId, "closed");
        await refreshDashboardData();
      } catch (error) {
        console.error("Failed to close job", error);
      }
    },
    [refreshDashboardData],
  );

  function formatTimeAgo(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInsights() {
      if (!hasPremiumInsights) {
        setPremiumInsights(null);
        return;
      }

      if (cancelled) return;
      await loadPremiumInsights();
    }

    void loadInsights();

    return () => {
      cancelled = true;
    };
  }, [hasPremiumInsights, loadPremiumInsights]);

  const analyticsStats = [
    {
      label: "Open Job Postings",
      value: stats?.activeJobs ?? "—",
      change: "Currently open jobs",
      icon: Briefcase,
      color: "bg-blue-500",
      premium: false
    },
    {
      label: "Total Applicants",
      value: stats?.totalApplicants ?? "—",
      change: "All-time applications",
      icon: Users,
      color: "bg-emerald-500",
      premium: false
    },
    {
      label: "Avg. Time-to-Hire",
      value: stats?.avgTimeToHire && stats.avgTimeToHire > 0 ? `${stats.avgTimeToHire} days` : "N/A",
      change: "Available after hires are recorded",
      icon: Clock,
      color: "bg-purple-500",
      premium: true
    },
    {
      label: "Interview Ready",
      value: stats?.shortlisted ?? "—",
      change: "Candidates shortlisted",
      icon: Star,
      color: "bg-amber-500",
      premium: true
    }
  ];

  const prettifyCreditType = (creditType: string) => {
    const normalized = String(creditType ?? "").trim().toLowerCase();
    if (normalized === "ai_credit") return "AI Matching Credits";
    if (normalized === "ai_report") return "AI Hiring Report";
    if (normalized === "candidate_profile_view" || normalized === "candidate_unlock") {
      return "Candidate Unlock Credits";
    }
    if (normalized === "featured_job") return "Featured Job Credits";
    if (normalized === "job_slot") return "Extra Job Slot Credits";
    return String(creditType ?? "");
  };

  const getCreditIcon = (creditType: string) => {
    const normalized = String(creditType ?? "").trim().toLowerCase();
    if (normalized === "ai_credit") return Bot;
    if (normalized === "featured_job") return Star;
    if (normalized === "candidate_profile_view" || normalized === "candidate_unlock") return Eye;
    return CheckCircle;
  };



  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <CircularLoader size="md" label="Loading..." />
      </div>
    );
  }

  if (!user || role !== 'employer') {
    return (
      <div className="p-8 text-center text-gray-600">
        Access denied
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Employer Dashboard</h1>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-gray-600">
                {profile?.company_name ?? "Your Company"} - Talent Acquisition
              </p>
              {trialActive && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  Trial Active{trialDaysLeft ? ` - ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left` : ""}
                </Badge>
              )}
            </div>
          </div>

          <Button
            onClick={() => setShowPostJob(true)}
            disabled={isOverJobLimit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Post New Job
          </Button>
        </div>

        {hasPendingPayment && (
          <Card className="p-5 mb-6 border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-900">Plan activation pending payment</p>
                <p className="text-sm text-amber-800">
                  Complete checkout for the {selectedPendingPlan} plan to unlock premium features.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-amber-300 bg-white hover:bg-amber-100"
                onClick={() => navigate("/employer/billing")}
              >
                Complete Payment
              </Button>
            </div>
          </Card>
        )}

        {/* Stats Overview */}
        <div
          ref={analyticsSectionRef}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          {analyticsStats.map((stat, index) => {
            const isLocked = hasResolvedPlan && stat.premium && !hasPremium;

            return (
              <div key={index} className="relative">
                <Card
                  className={`
            p-6 border-gray-200 transition
            ${isLocked ? "blur-sm pointer-events-none select-none" : ""}
          `}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {showAnalyticsSkeleton ? (
                      <Skeleton className="h-9 w-16 rounded-md" />
                    ) : (
                      stat.value
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {stat.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {stat.change}
                  </div>
                </Card>

                {/* 🔒 Upgrade overlay */}
                {isLocked && (
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg"
                  >
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-full shadow-lg">
                      <Crown className="w-4 h-4" />
                      Upgrade to Unlock
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <Card className="p-6 border-gray-200 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Add-on Credit Balances</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creditBalances.length === 0 && (
              <p className="text-sm text-gray-500">No add-on credits available yet.</p>
            )}
            {creditBalances.map((credit) => {
              const CreditIcon = getCreditIcon(credit.creditType);
              return (
                <div
                  key={credit.creditType}
                  className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {prettifyCreditType(credit.creditType)}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-gray-900">{credit.remaining}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                      <CreditIcon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 border-gray-200 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Plan Usage Counters</h3>
          {!usageSnapshot ? (
            <div className="py-2">
              <CircularLoader size="sm" label="Loading usage..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {usageSnapshot.activeJobs}
                  <span className="text-base font-medium text-gray-500 ml-1">
                    / {usageSnapshot.jobLimit ?? "Unlimited"}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Candidate Views This Month</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {usageSnapshot.candidateViewsUsedThisMonth}
                  <span className="text-base font-medium text-gray-500 ml-1">
                    / {usageSnapshot.candidateViewLimit ?? "Unlimited"}
                  </span>
                </p>
              </div>
            </div>
          )}
        </Card>



        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Job Postings */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Active Job Postings</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowJobFilters((prev) => !prev)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filter{activeJobFilterCount > 0 ? ` (${activeJobFilterCount})` : ""}
                </Button>
              </div>
            </div>

            {showJobFilters && (
              <Card className="border-gray-200 p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={jobSearchQuery}
                      onChange={(e) => {
                        setJobSearchQuery(e.target.value);
                        setVisibleCount(JOBS_PER_PAGE);
                      }}
                      placeholder="Search active jobs by title or location"
                      className="pl-9"
                    />
                  </div>
                  <select
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    value={jobTypeFilter}
                    onChange={(e) => {
                      setJobTypeFilter(e.target.value);
                      setVisibleCount(JOBS_PER_PAGE);
                    }}
                  >
                    <option value="all">All job types</option>
                    {employmentTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setJobSearchQuery("");
                      setJobTypeFilter("all");
                      setVisibleCount(JOBS_PER_PAGE);
                    }}
                    disabled={activeJobFilterCount === 0}
                  >
                    Clear
                  </Button>
                </div>
              </Card>
            )}

            <div className="space-y-4">
              {jobsLoading && (
                <Card className="p-6 text-center text-gray-500">
                  <CircularLoader size="md" label="Loading job postings..." />
                </Card>
              )}

              {!jobsLoading && openJobs.length === 0 && (
                <Card className="p-6 text-center text-gray-500">
                  No jobs posted yet
                </Card>
              )}

              {!jobsLoading && openJobs.length > 0 && filteredOpenJobs.length === 0 && (
                <Card className="p-6 text-center text-gray-500">
                  No active jobs match the current filters.
                </Card>
              )}

              {filteredOpenJobs.slice(0, visibleCount).map((job) => (
                <Card
                  key={job.id}
                  className="p-6 border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {job.title}
                        </h3>
                        <Badge className="bg-green-100 text-green-700">
                          {job.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{job.employment_type ?? "—"}</span>
                        <span>•</span>
                        <span>{job.location ?? "Remote"}</span>
                        <span>•</span>
                        <span>
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {/* <div>
                        <p className="mt-2 text-sm text-gray-700">
                          {job.description}
                        </p>
                      </div> */}
                    </div>

                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveJobMenuId((prev) => (prev === job.id ? null : job.id));
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      {activeJobMenuId === job.id && (
                        <div
                          className="absolute right-0 top-12 z-20 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Job Actions
                          </p>
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => {
                              setSelectedJobId(job.id);
                              setActiveJobMenuId(null);
                            }}
                          >
                            View candidates
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => {
                              setJobToEdit(job);
                              setShowPostJob(true);
                              setActiveJobMenuId(null);
                            }}
                          >
                            Edit job
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => {
                              navigate("/employer/jobs");
                              setActiveJobMenuId(null);
                            }}
                          >
                            Open jobs page
                          </button>
                          <div className="my-1 h-px bg-gray-200" />
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            onClick={() => {
                              void handleCloseJob(job.id);
                              setActiveJobMenuId(null);
                            }}
                          >
                            Close job
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-medium">Applicants</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">{job.job_applications?.length ?? 0}</div>
                    </div>
                    {/* <StatBox
                      icon={Users}
                      label="Applicants"
                      value={job.job_applications?.length ?? 0}
                    /> */}
                    {/* <StatBox
                      icon={Star}
                      label="Shortlisted"
                      value={
                        job.job_applications?.filter(
                          (a) => a.status === "shortlisted"
                        ).length ?? 0
                      }
                    /> */}
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <Star className="w-4 h-4" />
                        <span className="text-xs font-medium">Shortlisted</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">{job.job_applications?.filter(
                        (a) => a.status === "shortlisted"
                      ).length ?? 0}</div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Interviewed</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">{job.job_applications?.filter(
                        (a) => a.status === "interview"
                      ).length ?? 0}</div>
                    </div>

                    <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-purple-600 mb-1">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs font-medium">Views</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">{job.view_count ?? 0}</div>
                    </div>

                    {/* <StatBox icon={Eye} label="Views" value={job.view_count ?? 0} /> */}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setSelectedJobId(job.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      View Candidates
                    </Button>

                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => void handleCloseJob(job.id)}
                    >
                      Close Job
                    </Button>
                  </div>
                </Card>
              ))}

            </div>

            {visibleCount < filteredOpenJobs.length && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisibleCount((prev) => prev + JOBS_PER_PAGE)}
              >
                Show more jobs
              </Button>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="p-6 border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button
                  onClick={() => setShowPostJob(true)}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isOverJobLimit}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isOverJobLimit ? "Job Limit Reached" : "Post New Job"}
                </Button>

                {hasAnalytics ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate("/employer/candidates")}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Browse Talent Pool
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-blue-600"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Browse Talent Pool
                  </Button>
                )}
                {hasCandidateMessagingAccess ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate("/employer/messages")}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message Candidates
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-blue-600"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Message Candidates
                  </Button>
                )}
                {hasAnalytics ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      analyticsSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    View Analytics
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-blue-600"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Analytics
                  </Button>
                )}

              </div>
            </Card>

            {/* Recent Activity */}
            {hasPremiumInsights && (
              <Card className="p-6 border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
                {premiumInsightsLoading ? (
                  <CircularLoader size="sm" label="Loading recent activity..." />
                ) : premiumInsights?.recentActivity?.length ? (
                  <div className="space-y-4">
                    {premiumInsights.recentActivity.map((activity) => (
                      <div key={activity.id} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">{activity.action}</span>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                            {activity.score}%
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{activity.detail}</p>
                        <p className="text-xs text-gray-500">{formatTimeAgo(activity.time)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No recent activity yet.</p>
                )}
              </Card>
            )}

            {/* Skill Insights */}
            {hasPremiumInsights && (
              <Card className="p-6 border-gray-200 bg-blue-50">
                <h3 className="font-semibold text-gray-900 mb-2">Talent Pool Insights</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Top skills available in your talent pool this week
                </p>
                {premiumInsightsLoading ? (
                  <CircularLoader size="sm" label="Loading talent pool insights..." />
                ) : premiumInsights?.talentPoolInsights?.length ? (
                  <div className="space-y-2">
                    {premiumInsights.talentPoolInsights.map((item) => (
                      <div key={item.skill} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.skill}</span>
                        <span className="font-medium text-gray-900">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No talent pool insight data yet.</p>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => navigate("/employer/candidates")}
                >
                  View Full Report
                </Button>
              </Card>
            )}
            {!hasPremiumInsights && (
              <Card className="p-6 border-dashed border-2 border-purple-300 bg-purple-50">
                <h3 className="font-semibold text-purple-900 mb-2">
                  Talent Insights (Premium)
                </h3>
                <p className="text-sm text-purple-700 mb-4">
                  See top skills, candidate trends, and hiring performance.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  Upgrade to Unlock
                </Button>
              </Card>
            )}


          </div>
        </div>
      </div>
      {showPostJob && (
        <PostJobModal
          onClose={() => {
            setShowPostJob(false);
            setJobToEdit(null);
          }}
          onSuccess={() => void refreshDashboardData()}
          job={jobToEdit ?? undefined}
        />
      )}
      {selectedJobId && (
        <JobCandidatesModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
      {showUpgradeModal && (
        <UpgradeModal plan={profile?.plan ?? "free"} onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}

