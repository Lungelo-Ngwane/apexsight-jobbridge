import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/app/components/ui/dialog";
import { FeedbackDialog,useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { Input } from "@/app/components/ui/input";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
Sheet,
SheetContent,
SheetHeader,
SheetTitle,
SheetTrigger,
} from "@/app/components/ui/sheet";
import {
applyForJob,
getAppliedJobIds,
getCandidateDashboardData,
getCandidateSavedJobIds,
getOpenJobs,
recordJobView,
toggleCandidateSavedJob,
} from "@/lib/candidate";
import { calculateProfileCompletion,isCandidateProfileReadyForApplication } from "@/lib/profileCompletion";
import {
ChevronLeft,
Search,
SlidersHorizontal,
X
} from "lucide-react";
import { useEffect,useMemo,useState } from "react";
import { useLocation,useNavigate,useParams,useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { FilterContent } from "./candidate/jobs/FilterContent";
import { JobCard } from "./candidate/jobs/JobCard";
import { JobDetailsView } from "./candidate/jobs/JobDetailsView";
import type { Job } from "./candidate/jobs/types";
export type { Job } from "./candidate/jobs/types";
const JOBS_PER_PAGE = 9;

export function CandidateJobsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId: routeJobId } = useParams<{ jobId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [showApplySuccessModal, setShowApplySuccessModal] = useState(false);
  const [showCompleteProfileModal, setShowCompleteProfileModal] = useState(false);
  const [appliedJobTitle, setAppliedJobTitle] = useState("");
  const [profileCompletion, setProfileCompletion] = useState<number | null>(null);
  const [profileReadyForApplication, setProfileReadyForApplication] = useState<boolean | null>(null);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        setAppliedJobIds([]); setSavedJobs([]); setProfileReadyForApplication(null);
        const jobsData = await getOpenJobs();
        if (!active) return;

        setJobs((jobsData as Job[]) ?? []);

        if (user && role === "candidate") {
          const [appliedIds, savedIds, profileData] = await Promise.all([
            getAppliedJobIds(),
            getCandidateSavedJobIds(),
            getCandidateDashboardData(),
          ]);

          if (!active) return;

          setAppliedJobIds(appliedIds ?? []);
          setSavedJobs(savedIds ?? []);
          setProfileCompletion(calculateProfileCompletion(profileData));
          setProfileReadyForApplication(isCandidateProfileReadyForApplication(profileData));
          return;
        }

        setAppliedJobIds([]);
        setSavedJobs([]);
        setProfileCompletion(null);
        setProfileReadyForApplication(null);
      } catch (error) {
        console.error("Failed to load candidate jobs page data", error);
        if (active) setLoadError("We couldn't load jobs. Please try again.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, role, reload]);

  useEffect(() => {
    const selectedJobId = String(
      routeJobId ??
      (location.state as { selectedJobId?: string } | null)?.selectedJobId ??
      searchParams.get("job") ??
      "",
    ).trim();
    if (!selectedJobId || jobs.length === 0) return;

    const preselectedJob = jobs.find((job) => job.id === selectedJobId);
    if (preselectedJob) {
      setSelectedJob(preselectedJob);
    }

    if ((location.state as { selectedJobId?: string } | null)?.selectedJobId) {
      navigate(location.pathname + (location.search || ""), { replace: true, state: null });
    }
  }, [jobs, location.pathname, location.search, location.state, navigate, routeJobId, searchParams]);

  useEffect(() => {
    const state = location.state as { selectedJobId?: string; autoApply?: boolean } | null;
    const selectedJobId = String(routeJobId ?? state?.selectedJobId ?? searchParams.get("job") ?? "").trim();
    const shouldAutoApply = Boolean(state?.autoApply || searchParams.get("autoApply") === "1");
    if (!shouldAutoApply || !selectedJobId || jobs.length === 0) return;

    const targetJob = jobs.find((job) => job.id === selectedJobId);
    if (!targetJob) return;

    void handleApply(targetJob);
    if (!user || role !== "candidate") return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("autoApply");
      return next;
    }, { replace: true });
    navigate(`/jobs/${selectedJobId}`, { replace: true, state: { selectedJobId } });
  }, [jobs, location.state, navigate, role, routeJobId, searchParams, setSearchParams, user]);

  useEffect(() => {
    const pendingSaveId = String(searchParams.get("save") ?? "").trim();
    if (!pendingSaveId || !user || role !== "candidate") return;

    void (async () => {
      await toggleSaveJob(pendingSaveId);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("save");
        return next;
      }, { replace: true });
    })();
  }, [role, searchParams, setSearchParams, user]);

  const employmentTypes = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.employment_type).filter(Boolean))) as string[],
    [jobs],
  );

  const experienceLevels = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.experience_level).filter(Boolean))) as string[],
    [jobs],
  );

  const locations = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location).filter(Boolean))) as string[],
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        job.title.toLowerCase().includes(searchLower) ||
        job.employer.company_name.toLowerCase().includes(searchLower) ||
        (job.location ?? "").toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower);

      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(job.employment_type ?? "");
      const matchesLevel = selectedLevels.length === 0 || selectedLevels.includes(job.experience_level ?? "");
      const matchesLocation = selectedLocations.length === 0 || selectedLocations.includes(job.location ?? "");

      return matchesSearch && matchesType && matchesLevel && matchesLocation;
    });
  }, [jobs, searchQuery, selectedTypes, selectedLevels, selectedLocations]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PER_PAGE));
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const endIndex = startIndex + JOBS_PER_PAGE;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selectedJob?.id) return;

    recordJobView(selectedJob.id).catch((error) => {
      console.warn("Failed to record job view", error);
    });
  }, [selectedJob?.id]);

  const activeFiltersCount = selectedTypes.length + selectedLevels.length + selectedLocations.length;

  const handleClearFilters = () => {
    setSelectedTypes([]);
    setSelectedLevels([]);
    setSelectedLocations([]);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const requestCandidateAuth = (returnTo: string) => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("apexsight:auth-required", {
        detail: {
          mode: "login",
          role: "candidate",
          returnTo,
        },
      }),
    );
  };

  const toggleSaveJob = async (jobId: string) => {
    if (!user) {
      const params = new URLSearchParams(searchParams);
      params.set("save", jobId);
      const query = params.toString();
      requestCandidateAuth(`/jobs/${jobId}${query ? `?${query}` : ""}`);
      return;
    }

    if (role !== "candidate") {
      showFeedback(
        "Candidate account required",
        "Sign in with a candidate account to save jobs.",
      );
      return;
    }

    const previous = [...savedJobs];
    const optimistic = previous.includes(jobId)
      ? previous.filter((id) => id !== jobId)
      : [...previous, jobId];
    setSavedJobs(optimistic);

    try {
      const persisted = await toggleCandidateSavedJob(jobId);
      setSavedJobs(persisted);
    } catch {
      setSavedJobs(previous);
      showFeedback(
        "Could not update saved jobs",
        "Please try again.",
      );
    }
  };

  async function handleApply(job: Job) {
    if (!user) {
      const params = new URLSearchParams(searchParams);
      params.set("autoApply", "1");
      const query = params.toString();
      requestCandidateAuth(`/jobs/${job.id}${query ? `?${query}` : ""}`);
      return;
    }

    if (role !== "candidate") {
      showFeedback(
        "Candidate account required",
        "Sign in with a candidate account to apply for jobs.",
      );
      return;
    }

    if (appliedJobIds.includes(job.id)) return;
    if (profileReadyForApplication === false) {
      setShowCompleteProfileModal(true);
      return;
    }

    try {
      setApplyingJobId(job.id);
      await applyForJob(job.id);
      setAppliedJobIds((prev) => [...new Set([...prev, job.id])]);
      setAppliedJobTitle(job.title);
      setShowApplySuccessModal(true);
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("already applied")) {
        setAppliedJobIds((prev) => [...new Set([...prev, job.id])]);
      } else {
        console.error("Failed to apply for job", error);
        showFeedback(
          "Application failed",
          "We couldn't submit your application right now. Please try again.",
        );
      }
    } finally {
      setApplyingJobId(null);
    }
  }

  if (selectedJob) {
    return (
        <JobDetailsView
        job={selectedJob}
        onBack={() => {
          setSelectedJob(null);
          navigate("/jobs");
        }}
        onSave={() => toggleSaveJob(selectedJob.id)}
        isSaved={savedJobs.includes(selectedJob.id)}
        onApply={() => handleApply(selectedJob)}
        isApplying={applyingJobId === selectedJob.id}
        hasApplied={appliedJobIds.includes(selectedJob.id)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
      <div className="sticky top-16 z-20 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-lg dark:border-white/10 dark:bg-neutral-950/95">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 flex items-center justify-end gap-3">
              <p className="hidden text-sm text-slate-500 dark:text-gray-400 sm:block">
                Find verified roles across South Africa
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search jobs, companies, or keywords..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-12 rounded-lg bg-white pl-10 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-white/10 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="lg" className="relative h-12 px-4 border-gray-300 rounded-xl lg:hidden">
                    <SlidersHorizontal className="w-5 h-5" />
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle className="text-xl font-bold">Filters</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
                    <FilterContent
                      employmentTypes={employmentTypes}
                      experienceLevels={experienceLevels}
                      locations={locations}
                      selectedTypes={selectedTypes}
                      selectedLevels={selectedLevels}
                      selectedLocations={selectedLocations}
                      onTypeChange={(type) => {
                        setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
                        setCurrentPage(1);
                      }}
                      onLevelChange={(level) => {
                        setSelectedLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
                        setCurrentPage(1);
                      }}
                      onLocationChange={(location) => {
                        setSelectedLocations((prev) => (prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]));
                        setCurrentPage(1);
                      }}
                      onClearAll={handleClearFilters}
                      activeCount={activeFiltersCount}
                    />
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {selectedTypes.map((type) => (
                  <Badge key={type} variant="secondary" className="pl-3 pr-2 py-1.5 bg-blue-100 text-blue-700 border-blue-200">
                    {type}
                    <button
                      onClick={() => {
                        setSelectedTypes((prev) => prev.filter((t) => t !== type));
                        setCurrentPage(1);
                      }}
                      className="ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedLevels.map((level) => (
                  <Badge key={level} variant="secondary" className="pl-3 pr-2 py-1.5 bg-purple-100 text-purple-700 border-purple-200">
                    {level}
                    <button
                      onClick={() => {
                        setSelectedLevels((prev) => prev.filter((l) => l !== level));
                        setCurrentPage(1);
                      }}
                      className="ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedLocations.map((location) => (
                  <Badge key={location} variant="secondary" className="pl-3 pr-2 py-1.5 bg-emerald-100 text-emerald-700 border-emerald-200">
                    {location}
                    <button
                      onClick={() => {
                        setSelectedLocations((prev) => prev.filter((l) => l !== location));
                        setCurrentPage(1);
                      }}
                      className="ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            {filteredJobs.length === 0 ? "No jobs found" : `${filteredJobs.length} open positions`}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {Math.min(startIndex + 1, filteredJobs.length)}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} verified opportunities
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="hidden lg:block">
            <Card className="sticky top-36 rounded-xl border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    Clear
                  </Button>
                )}
              </div>
              <FilterContent
                employmentTypes={employmentTypes}
                experienceLevels={experienceLevels}
                locations={locations}
                selectedTypes={selectedTypes}
                selectedLevels={selectedLevels}
                selectedLocations={selectedLocations}
                onTypeChange={(type) => {
                  setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
                  setCurrentPage(1);
                }}
                onLevelChange={(level) => {
                  setSelectedLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
                  setCurrentPage(1);
                }}
                onLocationChange={(location) => {
                  setSelectedLocations((prev) => (prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]));
                  setCurrentPage(1);
                }}
                onClearAll={handleClearFilters}
                activeCount={activeFiltersCount}
              />
            </Card>
          </aside>

          <div>
            {loadError ? <div role="alert" className="p-6"><p>{loadError}</p><Button onClick={() => setReload(value => value + 1)}>Try again</Button></div> : loading ? (
                <Card className="border-gray-200 p-10 text-center dark:border-white/10 dark:bg-neutral-900">
                <CircularLoader size="md" label="Loading jobs..." />
              </Card>
            ) : currentJobs.length > 0 ? (
              <div className="space-y-4">
                {currentJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    onSave={() => toggleSaveJob(job.id)}
                    isSaved={savedJobs.includes(job.id)}
                    onApply={() => handleApply(job)}
                    isApplying={applyingJobId === job.id}
                    hasApplied={appliedJobIds.includes(job.id)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-gray-200 p-12 text-center dark:border-white/10 dark:bg-neutral-900">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">No jobs found</h3>
                <p className="mb-4 text-gray-600 dark:text-gray-400">Try adjusting your filters or search terms</p>
                <Button onClick={handleClearFilters} variant="outline">Clear all filters</Button>
              </Card>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-lg hidden sm:inline-flex"
                >
                  First
                </Button>
              <Button variant="outline" onClick={() => setCurrentPage((prev) => prev - 1)} disabled={currentPage === 1} className="rounded-lg">
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Previous</span>
              </Button>
              <div className="flex gap-2">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    page = currentPage - 2 + i;
                    if (page > totalPages) page = totalPages - (4 - i);
                  }
                  return (
                    <Button key={page} variant={currentPage === page ? "default" : "outline"} onClick={() => setCurrentPage(page)} className={`w-10 h-10 rounded-lg ${currentPage === page ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}>
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button variant="outline" onClick={() => setCurrentPage((prev) => prev + 1)} disabled={currentPage === totalPages} className="rounded-lg">
                <span className="hidden sm:inline mr-2">Next</span>
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="rounded-lg hidden sm:inline-flex"
              >
                Last
              </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showApplySuccessModal} onOpenChange={setShowApplySuccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Application sent</DialogTitle>
            <DialogDescription>
              Congratulations! You have successfully applied for {appliedJobTitle ? `"${appliedJobTitle}"` : "this job"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowApplySuccessModal(false)}>Awesome</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showCompleteProfileModal} onOpenChange={setShowCompleteProfileModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete your profile first</DialogTitle>
            <DialogDescription>
              Add your full name, at least one skill, and a CV before applying.
              {profileCompletion !== null ? ` Your current profile completion is ${profileCompletion}%.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteProfileModal(false)}>
              Maybe Later
            </Button>
            <Button
              onClick={() => {
                setShowCompleteProfileModal(false);
                navigate("/candidate/profile");
              }}
            >
              Complete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FeedbackDialog
        open={feedback.open}
        title={feedback.title}
        description={feedback.description}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
}

export default CandidateJobsPage;
