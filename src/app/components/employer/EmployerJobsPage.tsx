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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { featureJob, generateAiReport, getEmployerJobs, renewJobVisibility, runAutoMatch, updateJobStatus } from "@/lib/employer";
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

type JobStatusTab = "active" | "draft" | "closed";

type JobRow = {
  id: string;
  title: string;
  status: "open" | "closed" | "archived";
  location: string | null;
  description: string;
  employment_type: string | null;
  experience_level: string | null;
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

  async function loadJobs() {
    try {
      setLoadingJobs(true);
      const data = await getEmployerJobs();
      setJobs((data ?? []) as JobRow[]);
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
    try {
      setActionLoading(`report-${job.id}`);
      const data = await generateAiReport(job.id);
      setLatestReport((data?.report ?? null) as Record<string, unknown> | null);
      setReportModalOpen(true);
    } catch (error: any) {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("insufficient")) {
        setUpsell({
          open: true,
          addonType: "ai_report",
          actionLabel: "generate this AI report",
        });
      } else {
        console.error("Failed to generate AI report", error);
        showFeedback(
          "AI report failed",
          "We couldn't generate this AI report right now. Please try again.",
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRunAutoMatch(job: JobRow) {
    try {
      setActionLoading(`match-${job.id}`);
      const data = await runAutoMatch(job.id);
      const matchesFound = Number(data?.matches_found ?? 0);
      showFeedback(
        "AI match complete",
        `${matchesFound} candidate${matchesFound === 1 ? "" : "s"} matched this job.`,
      );
    } catch (error: any) {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("insufficient")) {
        setUpsell({
          open: true,
          addonType: "ai_credit",
          actionLabel: "run AI matching for this job",
        });
      } else {
        console.error("Failed to run AI match", error);
        showFeedback(
          "AI match failed",
          "We couldn't run AI matching right now. Please try again.",
        );
      }
    } finally {
      setActionLoading(null);
    }
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Job Management</h1>
              <p className="text-sm text-gray-600">Manage all your job postings and track applications</p>
            </div>
            <Button
              onClick={handleNewJob}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Post New Job
            </Button>
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
                          onClick={() => handleRunAutoMatch(job)}
                          disabled={actionLoading === `match-${job.id}`}
                        >
                          {actionLoading === `match-${job.id}` ? "Running..." : "AI Match"}
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
                  status: editingJob.status,
                  experience_level: editingJob.experience_level,
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Hiring Report</DialogTitle>
            <DialogDescription>
              Generated from your current pipeline data and job context.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[420px] overflow-auto rounded-md bg-gray-100 p-3 text-xs">
            {JSON.stringify(latestReport ?? {}, null, 2)}
          </pre>
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
