import { useEffect, useMemo, useState } from "react";
import { applyForJob, getAppliedJobIds, getCandidateDashboardData, getOpenJobs } from "@/lib/candidate";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  Building2,
  ChevronLeft,
  X,
  CheckCircle,
  Bookmark,
  ArrowLeft,
  Share2,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export interface Job {
  id: string;
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
  };
}

const JOBS_PER_PAGE = 9;

export function CandidateJobsPage() {
  const navigate = useNavigate();
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
    Promise.all([getOpenJobs(), getAppliedJobIds(), getCandidateDashboardData()])
      .then(([jobsData, appliedIds, profileData]) => {
        setJobs((jobsData as Job[]) ?? []);
        setAppliedJobIds(appliedIds ?? []);
        setProfileCompletion(calculateProfileCompletion(profileData));
        setProfileReadyForApplication(isCandidateProfileReadyForApplication(profileData));
      })
      .catch((error) => {
        console.error("Failed to load candidate jobs page data", error);
      })
      .finally(() => setLoading(false));
  }, []);

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

  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const endIndex = startIndex + JOBS_PER_PAGE;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  const activeFiltersCount = selectedTypes.length + selectedLevels.length + selectedLocations.length;

  const handleClearFilters = () => {
    setSelectedTypes([]);
    setSelectedLevels([]);
    setSelectedLocations([]);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const toggleSaveJob = (jobId: string) => {
    setSavedJobs((prev) => (prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]));
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
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-lg border-slate-300 text-slate-700"
                onClick={() => navigate("/candidate/dashboard")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Button>
              <p className="hidden sm:block text-sm text-slate-500">
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
                  className="pl-10 h-12 border-gray-300 focus:ring-2 focus:ring-blue-500 rounded-lg bg-white"
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {filteredJobs.length === 0 ? "No jobs found" : `${filteredJobs.length} open positions`}
          </h1>
          <p className="text-sm text-gray-600">
            Showing {Math.min(startIndex + 1, filteredJobs.length)}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} verified opportunities
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="hidden lg:block">
            <Card className="p-4 border-gray-200 sticky top-36 rounded-xl shadow-sm bg-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
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
              <Card className="p-10 text-center border-gray-200">Loading jobs...</Card>
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
              <Card className="p-12 text-center border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your filters or search terms</p>
                <Button onClick={handleClearFilters} variant="outline">Clear all filters</Button>
              </Card>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2">
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
    const format = (num: number) => `R${(num / 1000).toFixed(0)}k`;
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
    <Card className="group relative overflow-hidden border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white rounded-xl" onClick={onClick}>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/70 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
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
                <p className="text-sm font-medium text-gray-900 truncate">{job.employer.company_name}</p>
                {job.employer.industry && <p className="text-xs text-gray-500 truncate">{job.employer.industry}</p>}
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? "fill-blue-600 text-blue-600" : "text-gray-400"}`} />
          </button>
        </div>

        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">{job.title}</h3>
          {featuredActive && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0">
              Featured
            </Badge>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
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
                <span>{job.experience_level}</span>
              </>
            )}
          </div>
          {salary && (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <DollarSign className="w-4 h-4 flex-shrink-0" />
              <span>{salary}</span>
            </div>
          )}
        </div>

        {job.skills_required && job.skills_required.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {job.skills_required.slice(0, 3).map((skill, index) => (
              <Badge key={`${job.id}-${skill}-${index}`} variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200 text-xs">
                {skill}
              </Badge>
            ))}
            {job.skills_required.length > 3 && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200 text-xs">
                +{job.skills_required.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            {getTimeAgo(job.created_at)}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); onClick(); }}>
              View Details
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs" disabled={hasApplied || isApplying} onClick={(e) => { e.stopPropagation(); onApply(); }}>
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
        <Button variant="outline" onClick={onClearAll} className="w-full border-red-200 text-red-600 hover:bg-red-50">
          Clear all filters ({activeCount})
        </Button>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Employment Type</h3>
        <div className="space-y-3">
          {employmentTypes.map((type) => (
            <div key={type} className="flex items-center">
              <Checkbox id={`type-${type}`} checked={selectedTypes.includes(type)} onCheckedChange={() => onTypeChange(type)} className="rounded border-gray-300" />
              <Label htmlFor={`type-${type}`} className="ml-3 text-sm text-gray-700 cursor-pointer">{type}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Experience Level</h3>
        <div className="space-y-3">
          {experienceLevels.map((level) => (
            <div key={level} className="flex items-center">
              <Checkbox id={`level-${level}`} checked={selectedLevels.includes(level)} onCheckedChange={() => onLevelChange(level)} className="rounded border-gray-300" />
              <Label htmlFor={`level-${level}`} className="ml-3 text-sm text-gray-700 cursor-pointer">{level}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Location</h3>
        <div className="space-y-3">
          {locations.map((location) => (
            <div key={location} className="flex items-center">
              <Checkbox id={`location-${location}`} checked={selectedLocations.includes(location)} onCheckedChange={() => onLocationChange(location)} className="rounded border-gray-300" />
              <Label htmlFor={`location-${location}`} className="ml-3 text-sm text-gray-700 cursor-pointer">{location}</Label>
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
  const [logoBroken, setLogoBroken] = useState(false);
  const featuredActive =
    Boolean(job.is_featured) &&
    (!job.featured_until || new Date(job.featured_until).getTime() > Date.now());

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return "Salary not disclosed";
    const format = (num: number) => `R${(num / 1000).toFixed(0)}k`;
    if (min && max) return `${format(min)} - ${format(max)} per year`;
    if (min) return `From ${format(min)} per year`;
    if (max) return `Up to ${format(max)} per year`;
    return "Salary not disclosed";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onBack} className="gap-2">
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to jobs</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/candidate/dashboard")}
                className="hidden sm:inline-flex"
              >
                Dashboard
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white" onClick={onApply} disabled={hasApplied || isApplying}>
                {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply"}
              </Button>
              <Button variant="outline" onClick={onSave} className="gap-2">
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
                <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
              </Button>
              <Button variant="outline" className="gap-2">
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <Card className="p-6 sm:p-8 mb-6 border-gray-200 shadow-lg">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              {job.employer.logo_url && !logoBroken ? (
                <img
                  src={job.employer.logo_url}
                  alt={`${job.employer.company_name} logo`}
                  className="w-full h-full object-cover rounded-xl"
                  onError={() => setLogoBroken(true)}
                />
              ) : (
                <Building2 className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-gray-700">{job.employer.company_name}</p>
            </div>
          </div>
          {featuredActive && (
            <Badge className="mb-3 bg-amber-100 text-amber-700 border-amber-200">
              Featured Position
              {job.featured_until ? ` until ${new Date(job.featured_until).toLocaleDateString()}` : ""}
            </Badge>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            {job.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gray-400" />
                {job.location}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-gray-400" />
              {job.employment_type || "Not specified"}
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 shadow-md mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-emerald-700 font-medium">Compensation</p>
              <p className="text-xl font-bold text-gray-900">{formatSalary(job.salary_min, job.salary_max)}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 border-gray-200 shadow-md lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Job Description</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{job.description}</p>

            {job.skills_required && job.skills_required.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.skills_required.map((skill, index) => (
                    <Badge key={`${skill}-${index}`} className="px-3 py-1.5 bg-blue-100 text-blue-700 border-blue-200 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-6 border-gray-200 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ready to apply?</h3>
              <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg mb-3" onClick={onApply} disabled={hasApplied || isApplying}>
                {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply Now"}
              </Button>
              <Button variant="outline" onClick={onSave} className="w-full border-gray-300">
                <Bookmark className={`w-4 h-4 mr-2 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
                {isSaved ? "Saved" : "Save for later"}
              </Button>
            </Card>

            <Card className="p-6 border-gray-200 shadow-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">About the Company</h3>
              <p className="text-sm text-gray-700 mb-3">{job.employer.company_name}</p>
              {job.employer.industry && <p className="text-sm text-gray-600 mb-3">{job.employer.industry}</p>}
              <Button variant="outline" className="w-full mt-2 border-gray-300">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Company Profile
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateJobsPage;
