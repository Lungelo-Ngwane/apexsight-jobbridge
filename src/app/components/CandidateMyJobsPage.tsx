import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { BookmarkCheck, Briefcase, Building2, Clock3, MapPin } from "lucide-react";
import { applyForJob, getAppliedJobIds, getCandidateDashboardData, getCandidateSavedJobIds, getJobsByIds } from "@/lib/candidate";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { isCandidateProfileReadyForApplication } from "@/lib/profileCompletion";

type MyJob = {
  id: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  created_at: string;
  status?: string | null;
  employer: {
    company_name: string;
    industry?: string | null;
    logo_url?: string | null;
    brand_primary_color?: string | null;
    custom_domain?: string | null;
    careers_page_headline?: string | null;
    public_company_page?: boolean;
  };
};

type ActiveTab = "applied" | "saved";

export default function CandidateMyJobsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("applied");
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [jobsById, setJobsById] = useState<Record<string, MyJob>>({});
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [profileReadyForApplication, setProfileReadyForApplication] = useState<boolean | null>(null);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  useEffect(() => {
    Promise.all([getAppliedJobIds(), getCandidateSavedJobIds(), getCandidateDashboardData()])
      .then(async ([appliedIds, savedIds, profileData]) => {
        const applied = appliedIds ?? [];
        const saved = savedIds ?? [];
        setAppliedJobIds(applied);
        setSavedJobIds(saved);
        setProfileReadyForApplication(isCandidateProfileReadyForApplication(profileData));

        const ids = Array.from(new Set([...applied, ...saved]));
        if (ids.length === 0) {
          setJobsById({});
          return;
        }

        const jobs = (await getJobsByIds(ids)) as MyJob[];
        const map = jobs.reduce((acc, job) => {
          acc[job.id] = job;
          return acc;
        }, {} as Record<string, MyJob>);
        setJobsById(map);
      })
      .catch(() => {
        setAppliedJobIds([]);
        setSavedJobIds([]);
        setJobsById({});
      })
      .finally(() => setLoading(false));
  }, []);

  const appliedJobs = useMemo(
    () => appliedJobIds.map((id) => jobsById[id]).filter(Boolean) as MyJob[],
    [appliedJobIds, jobsById],
  );
  const savedJobs = useMemo(
    () => savedJobIds.map((id) => jobsById[id]).filter(Boolean) as MyJob[],
    [savedJobIds, jobsById],
  );
  const visibleJobs = activeTab === "applied" ? appliedJobs : savedJobs;

  async function handleApply(job: MyJob) {
    if (appliedJobIds.includes(job.id) || job.status !== "open") return;
    if (profileReadyForApplication === false) {
      showFeedback(
        "Complete your profile first",
        "Finish your profile details before applying so employers can review a complete application.",
      );
      return;
    }

    try {
      setApplyingJobId(job.id);
      await applyForJob(job.id);
      setAppliedJobIds((prev) => [...new Set([...prev, job.id])]);
      showFeedback("Application sent", `Your application for ${job.title} has been submitted.`);
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("already applied")) {
        setAppliedJobIds((prev) => [...new Set([...prev, job.id])]);
      } else {
        showFeedback(
          "Application failed",
          "We couldn't submit your application right now. Please try again.",
        );
      }
    } finally {
      setApplyingJobId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Jobs</h1>
            <p className="text-sm text-slate-600">Track jobs you applied for and jobs you saved.</p>
          </div>
          <Button onClick={() => navigate("/candidate/jobs")} className="bg-blue-600 hover:bg-blue-700 text-white">
            Browse Jobs
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button
            variant={activeTab === "applied" ? "default" : "outline"}
            onClick={() => setActiveTab("applied")}
            className={activeTab === "applied" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
          >
            <Briefcase className="w-4 h-4 mr-2" />
            Applied ({appliedJobs.length})
          </Button>
          <Button
            variant={activeTab === "saved" ? "default" : "outline"}
            onClick={() => setActiveTab("saved")}
            className={activeTab === "saved" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
          >
            <BookmarkCheck className="w-4 h-4 mr-2" />
            Saved ({savedJobs.length})
          </Button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <CircularLoader size="md" label="Loading your jobs..." />
          </div>
        ) : visibleJobs.length === 0 ? (
          <Card className="p-8 text-center border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {activeTab === "applied" ? "No applied jobs yet" : "No saved jobs yet"}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {activeTab === "applied"
                ? "When you apply to jobs, they will appear here."
                : "Save roles from the Jobs page to keep a shortlist here."}
            </p>
            <Button onClick={() => navigate("/candidate/jobs")} variant="outline">
              Go to Jobs
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleJobs.map((job) => (
              <Card key={job.id} className="p-5 border-gray-200">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-11 h-11 border border-gray-200 rounded-lg flex items-center justify-center shrink-0"
                    style={!job.employer.logo_url ? { backgroundColor: job.employer.brand_primary_color ?? "#f5f5f5" } : undefined}
                  >
                    {job.employer.logo_url ? (
                      <img
                        src={job.employer.logo_url}
                        alt={`${job.employer.company_name} logo`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <Building2 className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{job.title}</p>
                    <p className="text-sm text-gray-600 truncate">{job.employer.company_name}</p>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-3 text-sm text-gray-600 mb-3">
                  {job.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {job.location}
                    </span>
                  )}
                  {job.employment_type && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="w-4 h-4 text-gray-400" />
                      {job.employment_type}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="w-4 h-4 text-gray-400" />
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    {activeTab === "applied" ? "Applied" : "Saved"}
                  </Badge>
                  {job.status && job.status !== "open" && (
                    <Badge variant="outline" className="text-gray-700 border-gray-300">
                      {job.status}
                    </Badge>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate("/candidate/jobs", { state: { selectedJobId: job.id } })}
                  >
                    View
                  </Button>
                  {activeTab === "saved" ? (
                    <Button
                      className="flex-1 !border-emerald-700 !bg-emerald-600 !bg-none !text-white hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300"
                      onClick={() => void handleApply(job)}
                      disabled={appliedJobIds.includes(job.id) || applyingJobId === job.id || job.status !== "open"}
                    >
                      {appliedJobIds.includes(job.id)
                        ? "Applied"
                        : applyingJobId === job.id
                          ? "Applying..."
                          : "Apply"}
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <FeedbackDialog
        open={feedback.open}
        title={feedback.title}
        description={feedback.description}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
}
