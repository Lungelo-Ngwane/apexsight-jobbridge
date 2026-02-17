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
import { getEmployerJobs, updateJobStatus } from "@/lib/employer";
import { PostJobModal } from "../PostJobModal";
import { JobCandidatesModal } from "../JobCandidatesModal";
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

type JobStatusTab = "active" | "draft" | "closed";

type JobRow = {
  id: string;
  title: string;
  status: "open" | "closed" | "archived";
  location: string | null;
  description: string;
  employment_type: string | null;
  experience_level: string | null;
  created_at: string;
  job_applications?: { id: string; status: string }[];
};

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
    } catch (error) {
      console.error("Failed to update job status", error);
      alert("Unable to update job status right now. Please try again.");
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

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
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

      <div className="max-w-7xl mx-auto px-6 py-8">
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
              {loadingJobs && <Card className="p-6 text-center text-gray-500">Loading jobs...</Card>}

              {!loadingJobs && filteredJobsForActiveTab.length === 0 && activeTab === tab && (
                <Card className="p-6 text-center text-gray-500">No jobs match your filters.</Card>
              )}

              {!loadingJobs &&
                activeTab === tab &&
                filteredJobsForActiveTab.map((job) => {
                  const applicants = job.job_applications?.length ?? 0;
                  const shortlisted =
                    job.job_applications?.filter((app) => app.status === "shortlisted").length ?? 0;
                  const interviewed =
                    job.job_applications?.filter((app) => app.status === "interview").length ?? 0;

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
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
                        </div>
                        <Badge className={`border ${statusBadgeClass(job.status)}`}>
                          {statusToLabel(job.status)}
                        </Badge>
                      </div>

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
                          <Button variant="outline" className="border-gray-300" onClick={() => handleStatusChange(job.id, "open")}>
                            Reopen
                          </Button>
                        )}
                        {job.status === "archived" && (
                          <Button variant="outline" className="border-gray-300" onClick={() => handleStatusChange(job.id, "open")}>
                            Publish
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
    </div>
  );
}
