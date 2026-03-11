import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import {
  Plus,
  Users,
  Eye,
  Star,
  Search,
  Filter,
  Briefcase,
  MapPin,
  Clock,
  CheckCircle,
  Lock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { featureJob, generateAiReport, getEmployerCredits, getEmployerJobs, getEmployerUsageSnapshot, renewJobVisibility, updateJobStatus, type EmployerCreditBalance, type EmployerUsageSnapshot } from "@/lib/employer";
import { PostJobModal } from "../PostJobModal";
import { JobCandidatesModal } from "../JobCandidatesModal";
import { AddonUpsellModal } from "./AddonUpsellModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { useNavigate } from "react-router-dom";

type JobStatusTab = "active" | "draft" | "closed";

type JobRow = {
  id: string;
  title: string;
  status: "open" | "closed" | "archived";
  location: string | null;
  description: string;
  employment_type: string | null;
  work_mode?: string | null;
  department?: string | null;
  min_years_experience?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  benefits?: string | null;
  experience_level: string | null;
  job_skills?: Array<{
    skill_id: string;
    required?: boolean | null;
    min_score?: number | null;
    skills?: { name?: string | null } | null;
  }>;
  is_featured?: boolean;
  featured_until?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  job_applications?: { id: string; status: string }[];
};

function isJobFeaturedActive(job: Pick<JobRow, "is_featured" | "featured_until">) {
  if (!job.is_featured) return false;
  if (!job.featured_until) return true;
  return new Date(job.featured_until).getTime() > Date.now();
}

function tabToStatus(tab: JobStatusTab): JobRow["status"] {
  if (tab === "active") return "open";
  if (tab === "draft") return "archived";
  return "closed";
}

function statusToLabel(status: JobRow["status"]) {
  if (status === "open") return "Active";
  if (status === "archived") return "Draft";
  return "Closed";
}

function statusBadgeClass(status: JobRow["status"]) {
  if (status === "open") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "archived") return "bg-gray-100 text-gray-700 border-gray-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function getDaysUntilExpiry(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function EmployerJobsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<JobStatusTab>("active");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showPostJobModal, setShowPostJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<JobRow | null>(null);
  const [jobToClose, setJobToClose] = useState<JobRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [usageSnapshot, setUsageSnapshot] = useState<EmployerUsageSnapshot | null>(null);
  const [creditBalances, setCreditBalances] = useState<EmployerCreditBalance[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [latestReport, setLatestReport] = useState<Record<string, unknown> | null>(null);
  const [upsell, setUpsell] = useState<{
    open: boolean;
    addonType: string | null;
    actionLabel: string;
  }>({
    open: false,
    addonType: null,
    actionLabel: "perform this action",
  });
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  const reportArray = (value: unknown) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") as string[] : []);
  const reportCandidates = Array.isArray(latestReport?.top_candidates)
    ? (latestReport?.top_candidates as Array<Record<string, unknown>>)
    : [];
  const activeJobsUsed = Number(usageSnapshot?.activeJobs ?? 0);
  const finiteJobLimit = typeof usageSnapshot?.jobLimit === "number" ? usageSnapshot.jobLimit : null;
  const extraJobSlotCredits = Number(usageSnapshot?.extraJobSlotCredits ?? 0);
  const creditedJobSlotBalance = Number(
    creditBalances.find((credit) => String(credit.creditType ?? "").toLowerCase() === "job_slot")?.remaining ?? 0,
  );
  const availableJobSlotCredits = Math.max(extraJobSlotCredits, creditedJobSlotBalance);
  const isOverJobLimit = finiteJobLimit !== null && activeJobsUsed >= finiteJobLimit;
  const isPostingLocked = isOverJobLimit && availableJobSlotCredits <= 0;

  async function loadJobs() {
    try {
      setLoadingJobs(true);
      const [data, usage, credits] = await Promise.all([
        getEmployerJobs(),
        getEmployerUsageSnapshot(),
        getEmployerCredits(),
      ]);
      setJobs((data ?? []) as JobRow[]);
      setUsageSnapshot(usage);
      setCreditBalances(credits);
    } catch (error) {
      console.error("Failed to load employer jobs", error);
    } finally {
      setLoadingJobs(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  const jobsByStatus = useMemo(
    () => ({
      active: jobs.filter((job) => job.status === "open"),
      draft: jobs.filter((job) => job.status === "archived"),
      closed: jobs.filter((job) => job.status === "closed"),
    }),
    [jobs],
  );

  const uniqueTypes = useMemo(
    () =>
      Array.from(
        new Set(
          jobs
            .map((job) => (job.employment_type ?? "").trim())
            .filter((type) => type.length > 0),
        ),
      ),
    [jobs],
  );

  const uniqueLocations = useMemo(
    () =>
      Array.from(
        new Set(
          jobs
            .map((job) => (job.location ?? "").trim())
            .filter((location) => location.length > 0),
        ),
      ),
    [jobs],
  );

  const filteredJobsForActiveTab = useMemo(() => {
    const tabStatus = tabToStatus(activeTab);
    const query = searchTerm.trim().toLowerCase();

    return jobs
      .filter((job) => job.status === tabStatus)
      .filter((job) => {
        const matchesSearch =
          !query ||
          job.title.toLowerCase().includes(query) ||
          (job.description ?? "").toLowerCase().includes(query) ||
          (job.location ?? "").toLowerCase().includes(query) ||
          (job.employment_type ?? "").toLowerCase().includes(query);

        const matchesType =
          selectedType === "all" ||
          (job.employment_type ?? "").toLowerCase() === selectedType.toLowerCase();

        const matchesLocation =
          selectedLocation === "all" ||
          (job.location ?? "").toLowerCase() === selectedLocation.toLowerCase();

        return matchesSearch && matchesType && matchesLocation;
      })
      .sort((a, b) => {
        const aFeatured = isJobFeaturedActive(a) ? 1 : 0;
        const bFeatured = isJobFeaturedActive(b) ? 1 : 0;
        if (aFeatured !== bFeatured) return bFeatured - aFeatured;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [activeTab, jobs, searchTerm, selectedLocation, selectedType]);

  const stats = useMemo(() => {
    const activeJobs = jobsByStatus.active;
    const totalApplicants = activeJobs.reduce(
      (sum, job) => sum + (job.job_applications?.length ?? 0),
      0,
    );
    const shortlisted = activeJobs.reduce(
      (sum, job) =>
        sum +
        (job.job_applications?.filter((app) => app.status === "shortlisted").length ?? 0),
      0,
    );
    const interviewed = activeJobs.reduce(
      (sum, job) =>
        sum + (job.job_applications?.filter((app) => app.status === "interview").length ?? 0),
      0,
    );

    return [
      {
        label: "Total Active Jobs",
        value: activeJobs.length,
        icon: Briefcase,
        color: "from-blue-500 to-blue-600",
      },
      {
        label: "Total Applicants",
        value: totalApplicants,
        icon: Users,
        color: "from-emerald-500 to-emerald-600",
      },
      {
        label: "Shortlisted",
        value: shortlisted,
        icon: Star,
        color: "from-amber-500 to-amber-600",
      },
      {
        label: "Interviewed",
        value: interviewed,
        icon: Eye,
        color: "from-purple-500 to-purple-600",
      },
    ];
  }, [jobsByStatus.active]);

  async function handleStatusChange(jobId: string, nextStatus: JobRow["status"]) {
    try {
      await updateJobStatus(jobId, nextStatus);
      await loadJobs();
    } catch (error: any) {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("plan_limit_reached")) {
        setUpsell({
          open: true,
          addonType: "job_slot",
          actionLabel: "publish more open jobs",
        });
        return;
      }
      console.error("Failed to update job status", error);
      showFeedback(
        "Status update failed",
        "We couldn't update this job status right now. Please try again.",
      );
    }
  }

  function handleEdit(job: JobRow) {
    setEditingJob(job);
    setShowPostJobModal(true);
  }

  function handleNewJob() {
    setEditingJob(null);
    setShowPostJobModal(true);
  }

  function handleJobSlotUpsell() {
    setUpsell({
      open: true,
      addonType: "job_slot",
      actionLabel: "publish more open jobs",
    });
  }

  async function handleFeatureJob(job: JobRow) {
    try {
      setActionLoading(`feature-${job.id}`);
      await featureJob(job.id, 7);
      showFeedback(
        "Job featured",
        "This job is now featured for 7 days.",
      );
      await loadJobs();
    } catch (error: any) {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("insufficient")) {
        setUpsell({
          open: true,
          addonType: "featured_job",
          actionLabel: "feature this job",
        });
      } else {
        console.error("Failed to feature job", error);
        showFeedback(
          "Unable to feature job",
          "We couldn't feature this job right now. Please try again.",
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGenerateAiReport(job: JobRow) {
    navigate(`/employer/jobs/${job.id}/report`);
  }

  async function handleRenewJob(job: JobRow) {
    try {
      setActionLoading(`renew-${job.id}`);
      await renewJobVisibility(job.id);
      showFeedback("Visibility extended", "This job is now visible for another 30 days.");
      await loadJobs();
      setActiveTab("active");
    } catch (error) {
      console.error("Failed to renew job visibility", error);
      showFeedback(
        "Renewal failed",
        "We couldn't extend this job visibility right now. Please try again.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Job Management</h1>
              <p className="text-sm text-gray-600">Manage all your job postings and track applications</p>
            </div>
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <Button
                onClick={handleNewJob}
                disabled={isPostingLocked}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                size="lg"
              >
                {isPostingLocked ? <Lock className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                {isPostingLocked ? "Job Limit Reached" : "Post New Job"}
              </Button>
              {isPostingLocked ? (
                <div className="flex flex-col items-start gap-2 text-sm text-gray-600 lg:items-end">
                  <span>
                    You are using {activeJobsUsed}
                    {finiteJobLimit !== null ? ` / ${finiteJobLimit}` : ""} active job slots.
                  </span>
                  <Button variant="outline" size="sm" onClick={handleJobSlotUpsell}>
                    Buy Job Slot Add-on
                  </Button>
                </div>
              ) : availableJobSlotCredits > 0 ? (
                <div className="text-sm text-gray-600">
                  {availableJobSlotCredits} unused extra job slot credit{availableJobSlotCredits === 1 ? "" : "s"} available.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="relative overflow-hidden border-0 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-gray-300/50 transition-all duration-300"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-[0.03]`} />
              <div className="relative p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-gray-600">{stat.label}</div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-4 mb-6 border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, description, location, or type..."
                className="pl-10 border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="all">All types</option>
                {uniqueTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="all">All locations</option>
                {uniqueLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedType("all");
                  setSelectedLocation("all");
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as JobStatusTab)}>
          <TabsList className="mb-6 bg-gray-100/80 backdrop-blur p-1">
            <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Active Jobs ({jobsByStatus.active.length})
            </TabsTrigger>
            <TabsTrigger value="draft" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Drafts ({jobsByStatus.draft.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Closed ({jobsByStatus.closed.length})
            </TabsTrigger>
          </TabsList>

          {(["active", "draft", "closed"] as JobStatusTab[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {loadingJobs && (
                <Card className="p-6 text-center text-gray-500">
                  <CircularLoader size="md" label="Loading jobs..." />
                </Card>
              )}

              {!loadingJobs && filteredJobsForActiveTab.length === 0 && activeTab === tab && (
                <Card className="p-6 text-center text-gray-500">No jobs match your filters.</Card>
              )}

              {!loadingJobs &&
                activeTab === tab &&
                filteredJobsForActiveTab.map((job) => {
                  const featuredActive = isJobFeaturedActive(job);
                  const applicants = job.job_applications?.length ?? 0;
                  const shortlisted =
                    job.job_applications?.filter((app) => app.status === "shortlisted").length ?? 0;
                  const interviewed =
                    job.job_applications?.filter((app) => app.status === "interview").length ?? 0;
                  const expiresInDays = getDaysUntilExpiry(job.expires_at);
                  const expiryWarning =
                    typeof expiresInDays === "number" &&
                    job.status === "open" &&
                    expiresInDays <= 7 &&
                    expiresInDays >= 0;

                  return (
                    <Card key={job.id} className="p-6 border-gray-200 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                              <Briefcase className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {job.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mt-1">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {job.location ?? "Remote"}
                                </span>
                                <span>•</span>
                                <span>{job.employment_type ?? "N/A"}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {new Date(job.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {job.expires_at && (
                                <p className="text-xs mt-1 text-gray-500">
                                  Visible until {new Date(job.expires_at).toLocaleDateString()} (30-day listing window)
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
                        </div>
                        <Badge className={`border ${statusBadgeClass(job.status)}`}>
                          {statusToLabel(job.status)}
                        </Badge>
                      </div>

                      {featuredActive && (
                        <div className="mb-3">
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                            Featured
                            {job.featured_until ? ` until ${new Date(job.featured_until).toLocaleDateString()}` : ""}
                          </Badge>
                        </div>
                      )}

                      {expiryWarning && (
                        <div className="mb-3">
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                            {expiresInDays === 0
                              ? "Expires today"
                              : `Expires in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}`}
                          </Badge>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-medium">Applicants</span>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">{applicants}</div>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-amber-600 mb-1">
                            <Star className="w-4 h-4" />
                            <span className="text-xs font-medium">Shortlisted</span>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">{shortlisted}</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-emerald-600 mb-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Interviewed</span>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">{interviewed}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          className="flex-1 min-w-[160px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                          onClick={() => setSelectedJobId(job.id)}
                        >
                          View Candidates
                        </Button>

                        <Button variant="outline" className="flex-1 min-w-[140px] border-gray-300" onClick={() => handleEdit(job)}>
                          Edit Job
                        </Button>

                        <Button
                          variant="outline"
                          className="border-gray-300"
                          onClick={() => handleFeatureJob(job)}
                          disabled={actionLoading === `feature-${job.id}` || featuredActive}
                        >
                          {actionLoading === `feature-${job.id}`
                            ? "Featuring..."
                            : featuredActive
                              ? "Featured"
                              : "Feature Job"}
                        </Button>

                        <Button
                          variant="outline"
                          className="border-gray-300"
                          onClick={() => handleGenerateAiReport(job)}
                          disabled={actionLoading === `report-${job.id}`}
                        >
                          {actionLoading === `report-${job.id}` ? "Generating..." : "AI Report"}
                        </Button>

                        {job.status === "open" && (
                          <Button
                            variant="outline"
                            className="border-gray-300"
                            onClick={() => setJobToClose(job)}
                          >
                            Close
                          </Button>
                        )}
                        {job.status === "closed" && (
                          <Button variant="outline" className="border-gray-300" onClick={() => handleRenewJob(job)}>
                            {actionLoading === `renew-${job.id}` ? "Renewing..." : "Renew 30 Days"}
                          </Button>
                        )}
                        {job.status === "archived" && (
                          <Button variant="outline" className="border-gray-300" onClick={() => handleStatusChange(job.id, "open")}>
                            Publish
                          </Button>
                        )}
                        {job.status === "open" && (
                          <Button variant="outline" className="border-gray-300" onClick={() => handleRenewJob(job)}>
                            {actionLoading === `renew-${job.id}` ? "Renewing..." : "Extend 30 Days"}
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {showPostJobModal && (
        <PostJobModal
          job={
            editingJob
              ? {
                  id: editingJob.id,
                  title: editingJob.title,
                  description: editingJob.description,
                  location: editingJob.location,
                  employment_type: editingJob.employment_type,
                  work_mode: editingJob.work_mode,
                  department: editingJob.department,
                  min_years_experience: editingJob.min_years_experience,
                  salary_min: editingJob.salary_min,
                  salary_max: editingJob.salary_max,
                  benefits: editingJob.benefits,
                  status: editingJob.status,
                  experience_level: editingJob.experience_level,
                  job_skills: editingJob.job_skills,
                }
              : undefined
          }
          onClose={() => {
            setShowPostJobModal(false);
            setEditingJob(null);
          }}
          onSuccess={loadJobs}
        />
      )}

      {selectedJobId && (
        <JobCandidatesModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}

      <AlertDialog open={Boolean(jobToClose)} onOpenChange={(open) => !open && setJobToClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this job?</AlertDialogTitle>
            <AlertDialogDescription>
              {jobToClose
                ? `You are about to close "${jobToClose.title}". It will move to the Closed Jobs tab.`
                : "You are about to close this job."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!jobToClose) return;
                const jobId = jobToClose.id;
                setJobToClose(null);
                await handleStatusChange(jobId, "closed");
                setActiveTab("closed");
              }}
            >
              Close Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="w-[min(96vw,1100px)] max-w-none">
          <DialogHeader>
            <DialogTitle>AI Hiring Report</DialogTitle>
            <DialogDescription>
              Generated from your current pipeline data, candidate match scores, and structured job requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-6 overflow-auto pr-1">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-5 text-white shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  {typeof latestReport?.score_band === "string" ? (
                    <Badge className="bg-white text-slate-900 hover:bg-white">{String(latestReport.score_band)}</Badge>
                  ) : null}
                  {typeof latestReport?.confidence === "string" ? (
                    <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">Confidence: {String(latestReport.confidence)}</Badge>
                  ) : null}
                </div>
                {typeof latestReport?.summary === "string" ? (
                  <p className="mt-4 break-words text-base leading-7 text-white/95">{String(latestReport.summary)}</p>
                ) : null}
                {typeof latestReport?.overall_hiring_outlook === "string" ? (
                  <p className="mt-3 break-words text-sm leading-6 text-white/75">{String(latestReport.overall_hiring_outlook)}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Card className="border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Top candidates</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{reportCandidates.length}</p>
                  <p className="mt-1 text-sm text-slate-600">Ranked directly from current match data.</p>
                </Card>
                <Card className="border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Comparison notes</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{reportArray(latestReport?.candidate_comparison).length}</p>
                  <p className="mt-1 text-sm text-slate-600">Cross-candidate observations in this report.</p>
                </Card>
              </div>
            </div>

            {reportCandidates.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-900">Top Candidates</h4>
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Shortlist briefing</p>
                </div>
                <div className="space-y-3">
                  {reportCandidates.map((candidate, index) => {
                    const strengths = Array.isArray(candidate.strengths)
                      ? candidate.strengths.filter((item) => typeof item === "string") as string[]
                      : [];
                    const risks = Array.isArray(candidate.risks)
                      ? candidate.risks.filter((item) => typeof item === "string") as string[]
                      : [];
                    const matchedSkills = Array.isArray(candidate.matched_required_skills)
                      ? candidate.matched_required_skills.filter((item) => typeof item === "string") as string[]
                      : [];
                    const missingSkills = Array.isArray(candidate.missing_required_skills)
                      ? candidate.missing_required_skills.filter((item) => typeof item === "string") as string[]
                      : [];

                    return (
                      <Card key={`${candidate.name ?? "candidate"}-${index}`} className="overflow-hidden border-slate-200 p-0">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">#{index + 1}</Badge>
                              <p className="break-words text-base font-semibold text-gray-900">{String(candidate.name ?? "Candidate")}</p>
                            </div>
                            <p className="mt-2 break-words text-sm text-gray-600">{String(candidate.recommendation ?? "")}</p>
                          </div>
                          <div className="grid min-w-[210px] grid-cols-3 gap-2 text-center text-sm">
                            <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                              <p className="text-[11px] uppercase tracking-wide text-slate-500">Hybrid</p>
                              <p className="mt-1 font-semibold text-indigo-600">{Number(candidate.hybrid_score ?? 0)}%</p>
                            </div>
                            <p className="text-gray-600">Rule {Number(candidate.rule_based_score ?? 0)}% • AI {Number(candidate.ai_similarity ?? 0)}%</p>
                          </div>
                        </div>
                        {matchedSkills.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Matched required skills</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {matchedSkills.map((skill) => (
                                <Badge key={`${candidate.name ?? "candidate"}-matched-${skill}`} variant="secondary">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {missingSkills.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Missing required skills</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {missingSkills.map((skill) => (
                                <Badge key={`${candidate.name ?? "candidate"}-missing-${skill}`} className="bg-red-100 text-red-700">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {strengths.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Strengths</p>
                            <ul className="mt-2 space-y-1 text-sm leading-6 text-gray-700">
                              {strengths.map((item) => (
                                <li key={`${candidate.name ?? "candidate"}-strength-${item}`}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {risks.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Risks</p>
                            <ul className="mt-2 space-y-1 text-sm leading-6 text-gray-700">
                              {risks.map((item) => (
                                <li key={`${candidate.name ?? "candidate"}-risk-${item}`}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {reportArray(latestReport?.candidate_comparison).length > 0 ? (
              <section>
                <h4 className="mb-2 font-semibold text-gray-900">Candidate Comparison</h4>
                <ul className="space-y-2 text-sm leading-6 text-gray-700">
                  {reportArray(latestReport?.candidate_comparison).map((item) => (
                    <li key={`comparison-${item}`}>• {item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="space-y-4">
              {[
                { title: "Strengths", items: reportArray(latestReport?.strengths) },
                { title: "Risks", items: reportArray(latestReport?.risks) },
                { title: "Recommendations", items: reportArray(latestReport?.recommendations) },
              ].map((section) => (
                <Card
                  key={section.title}
                  className={`overflow-hidden p-5 ${
                    section.title === "Strengths"
                      ? "border-emerald-100 bg-emerald-50"
                      : section.title === "Risks"
                        ? "border-amber-100 bg-amber-50"
                        : "border-blue-100 bg-blue-50"
                  }`}
                >
                  <h4
                    className={`font-semibold ${
                      section.title === "Strengths"
                        ? "text-emerald-900"
                        : section.title === "Risks"
                          ? "text-amber-900"
                          : "text-blue-900"
                    }`}
                  >
                    {section.title}
                  </h4>
                  <ul
                    className={`mt-3 space-y-2 break-words text-sm leading-7 ${
                      section.title === "Strengths"
                        ? "text-emerald-950"
                        : section.title === "Risks"
                          ? "text-amber-950"
                          : "text-blue-950"
                    }`}
                  >
                    {section.items.length > 0 ? (
                      section.items.map((item) => <li key={`${section.title}-${item}`}>• {item}</li>)
                    ) : (
                      <li className="text-gray-500">No {section.title.toLowerCase()} generated.</li>
                    )}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setReportModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddonUpsellModal
        open={upsell.open}
        onOpenChange={(open) =>
          setUpsell((prev) => ({
            ...prev,
            open,
          }))
        }
        addonType={upsell.addonType}
        actionLabel={upsell.actionLabel}
      />
      <FeedbackDialog
        open={feedback.open}
        title={feedback.title}
        description={feedback.description}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
}
