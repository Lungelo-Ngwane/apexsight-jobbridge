import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  applyForJob,
  getAppliedJobIds,
  getCandidateDashboardData,
  getCandidateSavedJobIds,
  getOpenJobs,
  recordJobView,
  toggleCandidateSavedJob,
} from "@/lib/candidate";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Briefcase,
  Gauge,
  Clock,
  Building2,
  Globe,
  ChevronLeft,
  X,
  CheckCircle,
  Bookmark,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/components/ui/sheet";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Label } from "@/app/components/ui/label";
import { Separator } from "@/app/components/ui/separator";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { calculateProfileCompletion, isCandidateProfileReadyForApplication } from "@/lib/profileCompletion";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { useTheme } from "../context/ThemeContext";

export interface Job {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  is_featured?: boolean;
  featured_until?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  experience_level?: string | null;
  skills_required?: string[] | null;
  created_at: string;
  employer: {
    company_name: string;
    industry?: string | null;
    logo_url?: string | null;
    plan?: string | null;
    brand_primary_color?: string | null;
    custom_domain?: string | null;
    careers_page_headline?: string | null;
    public_company_page?: boolean;
  };
}

const JOBS_PER_PAGE = 9;

export function CandidateJobsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
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
    Promise.all([getOpenJobs(), getAppliedJobIds(), getCandidateSavedJobIds(), getCandidateDashboardData()])
      .then(([jobsData, appliedIds, savedIds, profileData]) => {
        setJobs((jobsData as Job[]) ?? []);
        setAppliedJobIds(appliedIds ?? []);
        setSavedJobs(savedIds ?? []);
        setProfileCompletion(calculateProfileCompletion(profileData));
        setProfileReadyForApplication(isCandidateProfileReadyForApplication(profileData));
      })
      .catch((error) => {
        console.error("Failed to load candidate jobs page data", error);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const selectedJobId = String(
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
  }, [jobs, location.pathname, location.search, location.state, navigate, searchParams]);

  useEffect(() => {
    const state = location.state as { selectedJobId?: string; autoApply?: boolean } | null;
    const selectedJobId = String(state?.selectedJobId ?? searchParams.get("job") ?? "").trim();
    const shouldAutoApply = Boolean(state?.autoApply || searchParams.get("autoApply") === "1");
    if (!shouldAutoApply || !selectedJobId || jobs.length === 0) return;

    const targetJob = jobs.find((job) => job.id === selectedJobId);
    if (!targetJob) return;

    void handleApply(targetJob);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("job", selectedJobId);
      next.delete("autoApply");
      return next;
    }, { replace: true });
    navigate(location.pathname + `?job=${selectedJobId}`, { replace: true, state: { selectedJobId } });
  }, [jobs, location.pathname, location.state, navigate, searchParams, setSearchParams]);

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

  const toggleSaveJob = async (jobId: string) => {
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
        onBack={() => setSelectedJob(null)}
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
            {loading ? (
                <Card className="border-gray-200 p-10 text-center dark:border-white/10 dark:bg-neutral-900">
                <CircularLoader size="md" label="Loading jobs..." />
              </Card>
            ) : currentJobs.length > 0 ? (
              <div className="space-y-4">
                {currentJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => setSelectedJob(job)}
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

function JobCard({
  job,
  onClick,
  onSave,
  isSaved,
  onApply,
  isApplying,
  hasApplied,
}: {
  job: Job;
  onClick: () => void;
  onSave: () => void;
  isSaved: boolean;
  onApply: () => void;
  isApplying: boolean;
  hasApplied: boolean;
}) {
  const [logoBroken, setLogoBroken] = useState(false);
  const featuredActive =
    Boolean(job.is_featured) &&
    (!job.featured_until || new Date(job.featured_until).getTime() > Date.now());

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return null;
    const format = (num: number) => `${(num / 1000).toFixed(0)}k`;
    if (min && max) return `${format(min)} - ${format(max)}`;
    if (min) return `From ${format(min)}`;
    if (max) return `Up to ${format(max)}`;
    return null;
  };

  const getTimeAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const salary = formatSalary(job.salary_min, job.salary_max);

  return (
    <Card className="group relative cursor-pointer overflow-hidden rounded-xl border-gray-200 bg-white transition-all duration-200 hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-neutral-900" onClick={onClick}>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/70 to-white opacity-0 transition-opacity group-hover:opacity-100 dark:from-neutral-900 dark:to-neutral-950" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-10 h-10 border border-gray-200 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
                style={!job.employer.logo_url || logoBroken ? { backgroundColor: job.employer.brand_primary_color ?? "#f5f5f5" } : undefined}
              >
                {job.employer.logo_url && !logoBroken ? (
                  <img
                    src={job.employer.logo_url}
                    alt={`${job.employer.company_name} logo`}
                    className="w-full h-full object-cover rounded-lg"
                    onError={() => setLogoBroken(true)}
                  />
                ) : (
                  <Building2 className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{job.employer.company_name}</p>
                {job.employer.industry && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{job.employer.industry}</p>}
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? "fill-blue-600 text-blue-600" : "text-gray-400"}`} />
          </button>
        </div>

        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white">{job.title}</h3>
          {featuredActive && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0">
              Featured
            </Badge>
          )}
        </div>

        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {job.location && (
              <>
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{job.location}</span>
                <span className="text-gray-400">|</span>
              </>
            )}
            <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{job.employment_type || "Not specified"}</span>
            {job.experience_level && (
              <>
                <span className="text-gray-400">|</span>
                <Gauge className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{job.experience_level}</span>
              </>
            )}
          </div>
          {salary && (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <span>{salary}</span>
            </div>
          )}
        </div>

        {job.skills_required && job.skills_required.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {job.skills_required.slice(0, 3).map((skill, index) => (
              <Badge key={`${job.id}-${skill}-${index}`} variant="secondary" className="border-gray-200 bg-gray-100 text-xs text-gray-700 dark:border-white/10 dark:bg-neutral-950 dark:text-gray-300">
                {skill}
              </Badge>
            ))}
            {job.skills_required.length > 3 && (
              <Badge variant="secondary" className="border-gray-200 bg-gray-100 text-xs text-gray-700 dark:border-white/10 dark:bg-neutral-950 dark:text-gray-300">
                +{job.skills_required.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            {getTimeAgo(job.created_at)}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs dark:border-white/10 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800" onClick={(e) => { e.stopPropagation(); onClick(); }}>
              View Details
            </Button>
            <Button size="sm" className="!border-emerald-700 !bg-emerald-600 !bg-none !text-white text-xs hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300" disabled={hasApplied || isApplying} onClick={(e) => { e.stopPropagation(); onApply(); }}>
              {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FilterContent({
  employmentTypes,
  experienceLevels,
  locations,
  selectedTypes,
  selectedLevels,
  selectedLocations,
  onTypeChange,
  onLevelChange,
  onLocationChange,
  onClearAll,
  activeCount,
}: {
  employmentTypes: string[];
  experienceLevels: string[];
  locations: string[];
  selectedTypes: string[];
  selectedLevels: string[];
  selectedLocations: string[];
  onTypeChange: (type: string) => void;
  onLevelChange: (level: string) => void;
  onLocationChange: (location: string) => void;
  onClearAll: () => void;
  activeCount: number;
}) {
  return (
    <div className="space-y-6 pb-6">
      {activeCount > 0 && (
        <Button variant="outline" onClick={onClearAll} className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-400/20 dark:hover:bg-red-950/30">
          Clear all filters ({activeCount})
        </Button>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Employment Type</h3>
        <div className="space-y-3">
          {employmentTypes.map((type) => (
            <div key={type} className="flex items-center">
              <Checkbox id={`type-${type}`} checked={selectedTypes.includes(type)} onCheckedChange={() => onTypeChange(type)} className="rounded border-gray-300" />
              <Label htmlFor={`type-${type}`} className="ml-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300">{type}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Experience Level</h3>
        <div className="space-y-3">
          {experienceLevels.map((level) => (
            <div key={level} className="flex items-center">
              <Checkbox id={`level-${level}`} checked={selectedLevels.includes(level)} onCheckedChange={() => onLevelChange(level)} className="rounded border-gray-300" />
              <Label htmlFor={`level-${level}`} className="ml-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300">{level}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Location</h3>
        <div className="space-y-3">
          {locations.map((location) => (
            <div key={location} className="flex items-center">
              <Checkbox id={`location-${location}`} checked={selectedLocations.includes(location)} onCheckedChange={() => onLocationChange(location)} className="rounded border-gray-300" />
              <Label htmlFor={`location-${location}`} className="ml-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300">{location}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JobDetailsView({
  job,
  onBack,
  onSave,
  isSaved,
  onApply,
  isApplying,
  hasApplied,
}: {
  job: Job;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
  onApply: () => void;
  isApplying: boolean;
  hasApplied: boolean;
}) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [logoBroken, setLogoBroken] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const brandColor = job.employer.brand_primary_color ?? "#111111";
  const companyProfileEnabled =
    job.employer.public_company_page !== false &&
    String(job.employer.plan ?? "free").toLowerCase() === "enterprise";
  const customDomainHref = job.employer.custom_domain
    ? `https://${String(job.employer.custom_domain).replace(/^https?:\/\//i, "").trim()}`
    : null;
  const featuredActive =
    Boolean(job.is_featured) &&
    (!job.featured_until || new Date(job.featured_until).getTime() > Date.now());
  const descriptionText = String(job.description ?? "").trim();
  const descriptionNeedsExpand = descriptionText.length > 520;
  const visibleDescription = descriptionNeedsExpand && !showFullDescription
    ? `${descriptionText.slice(0, 520).trimEnd()}...`
    : descriptionText;
  const postedDate = new Date(job.created_at).toLocaleDateString();
  const heroBackground =
    theme === "dark"
      ? `linear-gradient(135deg, ${brandColor}24 0%, rgba(255,255,255,0.02) 38%, rgba(10,10,11,0) 100%)`
      : `linear-gradient(135deg, ${brandColor}10 0%, rgba(255,255,255,0) 55%)`;
  const quickActionBackground =
    theme === "dark"
      ? `linear-gradient(180deg, ${brandColor}22 0%, rgba(24,24,27,0.98) 36%, rgba(9,9,11,1) 100%)`
      : `linear-gradient(180deg, ${brandColor}16 0%, #ffffff 42%, #ffffff 100%)`;
  const detailStats = [
    {
      label: "Work setup",
      value: job.location || "Location flexible",
      icon: MapPin,
    },
    {
      label: "Employment type",
      value: job.employment_type || "Not specified",
      icon: Briefcase,
    },
    {
      label: "Experience level",
      value: job.experience_level || "Open to multiple levels",
      icon: Gauge,
    },
    {
      label: "Posted",
      value: postedDate,
      icon: Clock,
    },
  ];

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return "Salary not disclosed";
    const format = (num: number) => `${(num / 1000).toFixed(0)}k`;
    if (min && max) return `${format(min)} - ${format(max)} per month`;
    if (min) return `From ${format(min)} per month`;
    if (max) return `Up to ${format(max)} per month`;
    return "Salary not disclosed";
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f7fa_0%,#f8fafc_220px,#ffffff_220px)] dark:bg-[linear-gradient(180deg,#09090b_0%,#111827_220px,#09090b_220px)]">
      <div className="sticky top-16 z-20 border-b border-gray-200 bg-white/92 backdrop-blur-lg shadow-sm dark:border-white/10 dark:bg-neutral-950/88">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onBack} className="gap-2 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white">
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to jobs</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button className="!border-emerald-700 !bg-emerald-600 !bg-none !text-white hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300" onClick={onApply} disabled={hasApplied || isApplying}>
                {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply"}
              </Button>
              <Button variant="outline" onClick={onSave} className="gap-2">
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
                <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Card className="mb-6 overflow-hidden border-gray-200/80 bg-white shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-neutral-950">
          <div
            className="border-b border-gray-200/80 px-6 py-6 sm:px-8 dark:border-white/10"
            style={{ background: heroBackground }}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900"
                  style={!job.employer.logo_url || logoBroken ? { backgroundColor: brandColor } : undefined}
                >
                  {job.employer.logo_url && !logoBroken ? (
                    <img
                      src={job.employer.logo_url}
                      alt={`${job.employer.company_name} logo`}
                      className="h-full w-full rounded-2xl object-cover"
                      onError={() => setLogoBroken(true)}
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-white" />
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-gray-200 bg-gray-100 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                      {job.employer.company_name}
                    </Badge>
                    {featuredActive ? (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
                        Featured role
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl dark:text-white">
                      {job.title}
                    </h1>
                    <p className="mt-2 max-w-3xl text-base leading-7 text-gray-600 dark:text-gray-300">
                      A structured role summary with the key job facts upfront, followed by the full brief and company context.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {job.location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        {job.location}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-gray-400" />
                      Posted {postedDate}
                    </span>
                    {job.featured_until ? (
                      <span className="text-gray-500 dark:text-gray-400">
                        Featured until {new Date(job.featured_until).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Button className="w-full !border-emerald-700 !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300" onClick={onApply} disabled={hasApplied || isApplying}>
                  {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply now"}
                </Button>
                <Button variant="outline" onClick={onSave} className="w-full border-gray-300 dark:border-white/15 dark:bg-neutral-900 dark:text-white">
                  <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
                  {isSaved ? "Saved" : "Save job"}
                </Button>
                {companyProfileEnabled ? (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/companies/${job.employer_id}`)}
                    className="w-full border-gray-300 sm:col-span-2 lg:col-span-1 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Company Profile
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-gray-200/80 bg-gray-50/80 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4 dark:border-white/10 dark:bg-white/[0.02]">
            {detailStats.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-neutral-900"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
                    <Icon className="h-4 w-4 text-gray-700 dark:text-gray-200" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-950">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-950 dark:text-white">Role overview</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Everything a candidate should understand before applying.
                  </p>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                  {formatSalary(job.salary_min, job.salary_max)}
                </div>
              </div>
              <div className="space-y-4">
                <p className="whitespace-pre-line text-[15px] leading-7 text-gray-700 dark:text-gray-300">
                  {visibleDescription}
                </p>
                {descriptionNeedsExpand ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-gray-900 transition hover:text-black dark:text-gray-100 dark:hover:text-white"
                    onClick={() => setShowFullDescription((prev) => !prev)}
                  >
                    {showFullDescription ? "Show less" : "Read full description"}
                  </button>
                ) : null}
              </div>
            </Card>

            {job.skills_required && job.skills_required.length > 0 ? (
              <Card className="border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-950">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-950 dark:text-white">Core skills</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    The capabilities this employer is actively looking for.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {job.skills_required.map((skill, index) => (
                    <Badge
                      key={`${skill}-${index}`}
                      className="rounded-full border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                    >
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <Card
              className="border-gray-200/80 p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-neutral-950"
              style={{ background: quickActionBackground }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Quick action
              </p>
              <h3 className="mt-2 text-xl font-semibold text-gray-950 dark:text-white">Ready to apply?</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                Save the role or submit your application now while the job is still active.
              </p>
              <div className="mt-5 space-y-3">
                <Button className="w-full !border-emerald-700 !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300" onClick={onApply} disabled={hasApplied || isApplying}>
                  {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply now"}
                </Button>
                <Button variant="outline" onClick={onSave} className="w-full border-gray-300 bg-white/80 dark:border-white/15 dark:bg-neutral-900 dark:text-white">
                  <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
                  {isSaved ? "Saved" : "Save for later"}
                </Button>
              </div>
            </Card>

            <Card
              className="border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-950"
              style={{ borderTop: `4px solid ${brandColor}` }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Company
              </p>
              <h3 className="mt-2 text-xl font-semibold text-gray-950 dark:text-white">About {job.employer.company_name}</h3>
              <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                {job.employer.industry ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>{job.employer.industry}</span>
                  </div>
                ) : null}
                {job.employer.careers_page_headline ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                    {job.employer.careers_page_headline}
                  </div>
                ) : (
                  <p>Explore the company profile and active roles before deciding where to apply.</p>
                )}
              </div>
              <div className="mt-5 space-y-3">
                {companyProfileEnabled ? (
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 bg-white dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                    onClick={() => navigate(`/companies/${job.employer_id}`)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Company Profile
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full border-gray-300 bg-white dark:border-white/15 dark:bg-neutral-900 dark:text-white" disabled>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Company profile hidden
                  </Button>
                )}
                {customDomainHref ? (
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 bg-white dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                    onClick={() => window.open(customDomainHref, "_blank", "noopener,noreferrer")}
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    Visit Careers Site
                  </Button>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateJobsPage;
