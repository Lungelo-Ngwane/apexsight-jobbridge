import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { Separator } from "@/app/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { AddonUpsellModal } from "./AddonUpsellModal";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import {
  generateAiReport,
  getEmployerJobReportPageData,
  type EmployerJobReportPageData,
} from "@/lib/employer";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Users,
  Target,
  Award,
  Clock,
  MapPin,
  Briefcase,
  Star,
  CheckCircle2,
  AlertCircle,
  Download,
  Share2,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

type CandidateReportCard = {
  name: string;
  score: number;
  location: string;
  experience: string;
  status: string;
  skills: string[];
  recommendation: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown" : parsed.toLocaleDateString();
}

function formatCompensation(min?: unknown, max?: unknown) {
  const minValue = Number(min ?? 0);
  const maxValue = Number(max ?? 0);
  if (minValue > 0 && maxValue > 0) {
    return `${minValue.toLocaleString()} - ${maxValue.toLocaleString()}/month`;
  }
  if (minValue > 0) return `From ${minValue.toLocaleString()}/month`;
  if (maxValue > 0) return `Up to ${maxValue.toLocaleString()}/month`;
  return "Salary not disclosed";
}

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") as string[] : [];
}

function normalizeSkillKey(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bjs\b/g, "javascript")
    .replace(/\bts\b/g, "typescript")
    .replace(/[^a-z0-9+#]/g, "");
}

function formatCandidateStatus(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "shortlisted") return "Shortlisted";
  if (normalized === "interview") return "Interviewed";
  if (normalized === "hired") return "Hired";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "applied") return "Applied";
  return "Review";
}

function buildRecommendationSummary(status: string, matchedSkills: string[], missingSkills: string[], requiredCount: number) {
  const prefix =
    status === "Interviewed" ? "Interviewed;" :
    status === "Shortlisted" ? "Shortlisted;" :
    status === "Hired" ? "Hired;" :
    status === "Applied" ? "Applied;" :
    "Review;";

  if (requiredCount === 0) {
    return `${prefix} strong overall fit based on current pipeline data.`;
  }
  if (missingSkills.length === 0) {
    return `${prefix} matches all configured required skills.`;
  }
  if (matchedSkills.length > 0) {
    return `${prefix} matches ${matchedSkills.join(", ")} but is missing ${missingSkills.join(", ")}.`;
  }
  return `${prefix} does not yet show the configured required skills: ${missingSkills.join(", ")}.`;
}

export function EmployerJobReportPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();
  const [data, setData] = useState<EmployerJobReportPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [upsell, setUpsell] = useState<{ open: boolean; addonType: string | null; actionLabel: string }>({
    open: false,
    addonType: null,
    actionLabel: "generate this AI report",
  });

  async function loadPageData() {
    if (!jobId) return;
    setLoading(true);
    try {
      const nextData = await getEmployerJobReportPageData(jobId);
      setData(nextData);
    } catch (error) {
      console.error("Failed to load employer job report page", error);
      showFeedback("Report unavailable", "We couldn't load this AI report right now.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateReport() {
    if (!jobId) return;
    try {
      setGenerating(true);
      const result = await generateAiReport(jobId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              latestReport: (result?.report ?? null) as Record<string, unknown> | null,
              latestReportCreatedAt: new Date().toISOString(),
            }
          : prev,
      );
      await loadPageData();
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
        showFeedback("AI report failed", "We couldn't generate this AI report right now. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, [jobId]);

  const latestReport = (data?.latestReport ?? null) as Record<string, unknown> | null;
  const reportCandidatesRaw = Array.isArray(latestReport?.top_candidates)
    ? (latestReport?.top_candidates as Array<Record<string, unknown>>)
    : [];
  const applicants = data?.applicants ?? [];

  const topCandidates = useMemo<CandidateReportCard[]>(() => {
    const applicantMap = new Map<string, Record<string, unknown>>();
    const jobRequiredSkills = ((((data?.job as { job_skills?: Array<{ required?: boolean | null; skills?: { name?: string | null } | null }> } | null)?.job_skills) ?? [])
      .filter((skill) => skill.required)
      .map((skill) => String(skill.skills?.name ?? "").trim())
      .filter(Boolean));

    for (const applicant of applicants) {
      const candidate = (applicant.candidate as Record<string, unknown> | undefined) ?? {};
      const candidateName = String(candidate.full_name ?? "").trim();
      if (candidateName) applicantMap.set(candidateName.toLowerCase(), applicant);
    }

    if (reportCandidatesRaw.length > 0) {
      return reportCandidatesRaw.map((candidate) => {
        const name = String(candidate.name ?? "Candidate");
        const applicantRow = applicantMap.get(name.toLowerCase()) ?? {};
        const candidateRow = ((applicantRow as { candidate?: Record<string, unknown> }).candidate) ?? {};
        const liveSkills = Array.isArray((candidateRow as { candidate_skills?: unknown[] }).candidate_skills)
          ? (((candidateRow as { candidate_skills?: Array<{ skills?: { name?: string | null } | null }> }).candidate_skills) ?? [])
              .map((skill) => String(skill.skills?.name ?? "").trim())
              .filter(Boolean)
          : [];
        const liveSkillKeys = new Set(liveSkills.map((skill) => normalizeSkillKey(skill)));
        const matchedSkills = jobRequiredSkills.filter((skill) => liveSkillKeys.has(normalizeSkillKey(skill)));
        const missingSkills = jobRequiredSkills.filter((skill) => !liveSkillKeys.has(normalizeSkillKey(skill)));
        const status = formatCandidateStatus(String((applicantRow as { status?: string | null }).status ?? ""));
        const displayedSkills = [...matchedSkills, ...liveSkills].filter((skill, index, all) => all.indexOf(skill) === index).slice(0, 4);

        return {
          name,
          score: Number(candidate.hybrid_score ?? 0),
          location: String(candidateRow.location ?? "Unknown"),
          experience: `${Number(candidateRow.years_experience ?? 0) || 0} years`,
          status,
          recommendation: buildRecommendationSummary(status, matchedSkills, missingSkills, jobRequiredSkills.length),
          skills: displayedSkills.length > 0
            ? displayedSkills
            : normalizeArray(candidate.matched_required_skills).slice(0, 4),
        };
      });
    }

    return [...applicants]
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
      .slice(0, 5)
      .map((applicant) => {
        const candidate = (applicant.candidate as Record<string, unknown> | undefined) ?? {};
        const candidateSkills = Array.isArray((candidate as { candidate_skills?: unknown[] }).candidate_skills)
          ? (((candidate as { candidate_skills?: Array<{ skills?: { name?: string | null } | null }> }).candidate_skills) ?? [])
              .map((skill) => String(skill.skills?.name ?? "").trim())
              .filter(Boolean)
          : [];
        const score = Number(applicant.score ?? 0);

        return {
          name: String(candidate.full_name ?? "Candidate"),
          score,
          location: String(candidate.location ?? "Unknown"),
          experience: `${Number(candidate.years_experience ?? 0) || 0} years`,
          status: score >= 85 ? "Strong Match" : score >= 65 ? "Good Match" : "Review",
          recommendation: "Live ranking preview from current applicant scores",
          skills: candidateSkills.slice(0, 4),
        };
      });
  }, [applicants, data?.job, reportCandidatesRaw]);

  const usingLiveFallbackRanking = reportCandidatesRaw.length === 0 && topCandidates.length > 0;
  const strongMatches = topCandidates.filter((candidate) => candidate.score >= 80).length;
  const goodMatches = topCandidates.filter((candidate) => candidate.score >= 65 && candidate.score < 80).length;
  const potentialMatches = topCandidates.filter((candidate) => candidate.score >= 50 && candidate.score < 65).length;
  const primaryMatchMetric =
    strongMatches > 0
      ? {
          label: "Strong Matches",
          value: strongMatches,
          trend: `${goodMatches} good match${goodMatches === 1 ? "" : "es"} in pipeline`,
        }
      : goodMatches > 0
        ? {
            label: "Good Matches",
            value: goodMatches,
            trend: `${potentialMatches} potential match${potentialMatches === 1 ? "" : "es"} in pipeline`,
          }
        : potentialMatches > 0
          ? {
              label: "Potential Matches",
              value: potentialMatches,
              trend: `${topCandidates.length} ranked candidate${topCandidates.length === 1 ? "" : "s"} available`,
            }
          : {
              label: "Ranked Candidates",
              value: topCandidates.length,
              trend: usingLiveFallbackRanking
                ? `${topCandidates.length} ranked from live scores`
                : `${reportCandidatesRaw.length} ranked by AI`,
            };
  const shortlisted = applicants.filter((applicant) => String(applicant.status ?? "").toLowerCase() === "shortlisted").length;
  const averageMatchScore = topCandidates.length
    ? Math.round(topCandidates.reduce((sum, candidate) => sum + candidate.score, 0) / topCandidates.length)
    : 0;

  const overviewStats = [
    { label: "Total Applicants", value: String(applicants.length), icon: Users, trend: `${shortlisted} shortlisted`, trendUp: true },
    { label: primaryMatchMetric.label, value: String(primaryMatchMetric.value), icon: Target, trend: primaryMatchMetric.trend, trendUp: primaryMatchMetric.value > 0 },
    { label: "Shortlisted", value: String(shortlisted), icon: Award, trend: "Current shortlist", trendUp: true },
    { label: "Avg. Match Score", value: `${averageMatchScore}%`, icon: TrendingUp, trend: "Across ranked candidates", trendUp: averageMatchScore >= 70 },
  ];

  const requiredSkills = (((data?.job as { job_skills?: Array<{ required?: boolean | null; skills?: { name?: string | null } | null }> })?.job_skills) ?? [])
    .filter((skill) => skill.required)
    .map((skill) => String(skill.skills?.name ?? "").trim())
    .filter(Boolean);

  const fallbackSkills = Array.from(
    new Set(
      topCandidates
        .flatMap((candidate) => candidate.skills)
        .map((skill) => String(skill ?? "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 6);

  const comparisonSkills = requiredSkills.length > 0 ? requiredSkills : fallbackSkills;

  const skillsData = comparisonSkills.map((skill) => {
    const matchingCandidates = topCandidates.filter((candidate) =>
      candidate.skills.some((candidateSkill) => candidateSkill.toLowerCase() === skill.toLowerCase()),
    );
    const average = matchingCandidates.length
      ? Math.round(matchingCandidates.reduce((sum, candidate) => sum + candidate.score, 0) / matchingCandidates.length)
      : 0;
    const top = matchingCandidates.length ? Math.max(...matchingCandidates.map((candidate) => candidate.score)) : 0;
    return {
      skill,
      required: requiredSkills.length > 0 ? 100 : Math.max(60, average),
      average,
      top,
    };
  });

  const radarData = [
    { category: "Technical Fit", value: averageMatchScore || 0 },
    { category: "Experience Fit", value: Math.min(100, Math.round(((topCandidates.reduce((sum, candidate) => sum + Number(candidate.experience.split(" ")[0] ?? 0), 0) / Math.max(1, topCandidates.length)) / 10) * 100)) },
    { category: "Location Fit", value: applicants.length ? Math.min(100, Math.round((applicants.filter((applicant) => String((applicant.candidate as Record<string, unknown> | undefined)?.location ?? "").trim().length > 0).length / applicants.length) * 100)) : 0 },
    { category: "Shortlist Depth", value: applicants.length ? Math.min(100, Math.round((shortlisted / applicants.length) * 100)) : 0 },
    { category: "Skills Coverage", value: comparisonSkills.length ? Math.min(100, Math.round((skillsData.filter((skill) => skill.average > 0).length / comparisonSkills.length) * 100)) : 0 },
    { category: "AI Confidence", value: String(latestReport?.confidence ?? "").toLowerCase() === "high" ? 90 : String(latestReport?.confidence ?? "").toLowerCase() === "moderate" ? 72 : 50 },
  ];

  const experienceDistribution = [
    { name: "0-2 years", value: applicants.filter((applicant) => Number((applicant.candidate as Record<string, unknown> | undefined)?.years_experience ?? 0) <= 2).length, color: "#94a3b8" },
    { name: "3-5 years", value: applicants.filter((applicant) => {
      const years = Number((applicant.candidate as Record<string, unknown> | undefined)?.years_experience ?? 0);
      return years >= 3 && years <= 5;
    }).length, color: "#60a5fa" },
    { name: "6-8 years", value: applicants.filter((applicant) => {
      const years = Number((applicant.candidate as Record<string, unknown> | undefined)?.years_experience ?? 0);
      return years >= 6 && years <= 8;
    }).length, color: "#3b82f6" },
    { name: "9+ years", value: applicants.filter((applicant) => Number((applicant.candidate as Record<string, unknown> | undefined)?.years_experience ?? 0) >= 9).length, color: "#1e40af" },
  ].filter((item) => item.value > 0);

  const locationMap = new Map<string, number>();
  for (const applicant of applicants) {
    const location = String((applicant.candidate as Record<string, unknown> | undefined)?.location ?? "Unknown").trim() || "Unknown";
    locationMap.set(location, (locationMap.get(location) ?? 0) + 1);
  }
  const locationData = Array.from(locationMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const insightStrengths = normalizeArray(latestReport?.strengths);
  const insightRisks = normalizeArray(latestReport?.risks);
  const insightRecommendations = normalizeArray(latestReport?.recommendations);

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-8">
        <CircularLoader size="md" label="Loading AI report..." />
      </div>
    );
  }

  if (!data?.job) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Report unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">We couldn't find this job report.</p>
          <Button className="mt-4" onClick={() => navigate("/employer/jobs")}>
            Back to Jobs
          </Button>
        </Card>
      </div>
    );
  }

  const job = data.job as Record<string, unknown>;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Button variant="ghost" size="sm" className="mb-3 -ml-3" onClick={() => navigate("/employer/jobs")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Jobs
              </Button>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{String(job.title ?? "AI Hiring Report")}</h1>
                <Badge className="bg-green-100 text-green-700 border-green-200">{String(job.status ?? "Active")}</Badge>
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Report
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {String(job.department ?? "General")}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {String(job.location ?? "Location not specified")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Posted {formatDate(String(job.published_at ?? job.created_at ?? ""))}
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm text-gray-600">
                {latestReport
                  ? "You are viewing the latest saved AI Hiring Report for this role. Opening this page does not use a credit."
                  : "No saved AI Hiring Report exists yet for this role. Generate one when you are ready to spend a report credit."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button size="sm" onClick={() => void handleGenerateReport()} disabled={generating}>
                <Download className="mr-2 h-4 w-4" />
                {latestReport
                  ? generating
                    ? "Refreshing..."
                    : "Refresh Report (1 credit)"
                  : generating
                    ? "Generating..."
                    : "Generate Report (1 credit)"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <Card className="border-blue-200 bg-blue-50/70 p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">AI Hiring Report credits are generation-based</p>
              <p className="text-sm text-blue-800">
                Viewing a saved report is free. A credit is only used when you generate a new report or refresh this one.
              </p>
            </div>
            <Badge className="border-blue-200 bg-white text-blue-700">
              {latestReport ? "Saved report available" : "No saved report yet"}
            </Badge>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {overviewStats.map((stat) => (
            <Card key={stat.label} className="border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className={`mt-2 flex items-center gap-1 text-xs ${stat.trendUp ? "text-green-600" : "text-gray-500"}`}>
                    {stat.trendUp ? <TrendingUp className="h-3 w-3" /> : null}
                    {stat.trend}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3">
                  <stat.icon className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="candidates" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="candidates">Top Candidates</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="candidates" className="space-y-4">
            <Card className="border-gray-200 p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Recommended Candidates</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {usingLiveFallbackRanking
                      ? "Ranked from current application scores. Generate a fresh AI report for deeper role-fit analysis."
                      : "AI-ranked by current role fit and available pipeline data"}
                  </p>
                </div>
                <Badge className="border-gray-300 bg-gray-100 text-gray-800">{topCandidates.length} Ranked</Badge>
              </div>

              <div className="space-y-4">
                {topCandidates.length > 0 ? topCandidates.map((candidate, index) => (
                  <div
                    key={`${candidate.name}-${index}`}
                    className="rounded-lg border border-gray-300 bg-gradient-to-r from-gray-50 to-white p-5 shadow-sm transition-all hover:border-gray-400 hover:shadow-md"
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 bg-gray-900 text-lg font-bold text-white shadow-sm">
                          {candidate.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                            <Badge variant="outline" className={candidate.score >= 85 ? "border-gray-300 bg-gray-100 text-gray-900" : "border-gray-300 bg-white text-gray-700"}>
                              {candidate.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3.5 w-3.5" />
                              {candidate.experience}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {candidate.location}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="mb-1 flex items-center gap-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-2xl font-bold text-gray-900">{candidate.score}</span>
                          <span className="text-sm text-gray-500">/100</span>
                        </div>
                        <p className="text-xs text-gray-600">Match Score</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                        <span>Role Fit</span>
                        <span>{candidate.score}%</span>
                      </div>
                      <Progress value={candidate.score} className="h-2" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <p className="mb-1 text-xs text-gray-600">Recommendation</p>
                        <p className="text-sm font-medium text-gray-900">{candidate.recommendation}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-600">Location</p>
                        <p className="text-sm font-medium text-gray-900">{candidate.location}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-600">Top Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {candidate.skills.slice(0, 3).map((skill) => (
                            <Badge key={`${candidate.name}-${skill}`} variant="outline" className="px-1.5 py-0 text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">No ranked candidates yet. Generate a report to analyze this pipeline.</p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="border-gray-200 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Skills Comparison</h3>
                <p className="mb-6 text-sm text-gray-600">
                  {requiredSkills.length > 0
                    ? "How ranked candidates line up against required skills"
                    : "No required skills were configured for this job, so this view is inferred from the strongest candidate skills"}
                </p>
                {skillsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={skillsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="skill" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="required"
                        fill="#3b82f6"
                        name={requiredSkills.length > 0 ? "Required" : "Baseline"}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar dataKey="average" fill="#60a5fa" name="Avg Ranked Candidate" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="top" fill="#10b981" name="Top Candidate" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    No candidate skill data available yet.
                  </div>
                )}
              </Card>

              <Card className="border-gray-200 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Candidate Pool Quality</h3>
                <p className="mb-6 text-sm text-gray-600">Quality across the current fit dimensions in your pipeline</p>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="border-gray-200 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Experience Distribution</h3>
                <p className="mb-6 text-sm text-gray-600">Breakdown of applicants by years of experience</p>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={experienceDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {experienceDistribution.map((entry, index) => (
                        <Cell key={`experience-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="border-gray-200 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Geographic Distribution</h3>
                <p className="mb-6 text-sm text-gray-600">Where your current applicants are based</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={locationData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="location" type="category" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="border-gray-200 p-6 shadow-sm lg:col-span-2">
                <h3 className="mb-4 text-lg font-bold text-gray-900">AI-Generated Insights</h3>
                <div className="space-y-4">
                  {insightStrengths.map((item) => (
                    <div key={`strength-${item}`} className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <div className="flex gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                        <div>
                          <h4 className="mb-1 font-semibold text-green-900">Strength</h4>
                          <p className="text-sm text-green-800">{item}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {insightRisks.map((item) => (
                    <div key={`risk-${item}`} className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                      <div className="flex gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
                        <div>
                          <h4 className="mb-1 font-semibold text-yellow-900">Risk</h4>
                          <p className="text-sm text-yellow-800">{item}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!insightStrengths.length && !insightRisks.length ? (
                    <p className="text-sm text-gray-500">No AI insights yet. Generate the report to populate this section.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="border-gray-200 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Recommended Actions</h3>
                <div className="space-y-3">
                  {insightRecommendations.length > 0 ? insightRecommendations.map((item, index) => (
                    <div key={`recommendation-${item}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex items-start gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                          {index + 1}
                        </div>
                        <p className="flex-1 text-sm font-medium text-gray-900">{item}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500">No recommendations yet.</p>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-900">Report Generated</h4>
                  <p className="text-xs text-gray-600">{formatDate(data.latestReportCreatedAt)}</p>
                  <p className="text-xs text-gray-600">Based on {applicants.length} application{applicants.length === 1 ? "" : "s"}</p>
                  <p className="text-xs text-gray-600">{formatCompensation(job.salary_min, job.salary_max)}</p>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AddonUpsellModal
        open={upsell.open}
        onOpenChange={(open) => setUpsell((prev) => ({ ...prev, open }))}
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
