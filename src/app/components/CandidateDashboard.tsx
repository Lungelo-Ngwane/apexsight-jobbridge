import { useEffect, useState } from "react";
import { getCandidateDashboardData, getOpenJobs, removeCandidateCertification, removeCandidateSkill } from "@/lib/candidate";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { Badge } from "@/app/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Award,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  Target,
  BookOpen,
  ArrowRight,
  CalendarDays,
  Star,
  Briefcase,
  Circle,
  FileText,
  Plus,
  Trash2,
  UserCircle2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { applyForJob, uploadCandidateCV } from "../../lib/candidate";
import { calculateProfileCompletion, isCandidateProfileReadyForApplication } from "@/lib/profileCompletion";
import { AddSkillModal } from "./AddSkillModal";
import { AddCertificationModal } from "./AddCertificationModal";
import { EditProfileModal } from "./EditProfileModal";
import { useNavigate } from "react-router-dom";
import { CircularLoader } from "@/app/components/ui/circular-loader";


interface CandidateDashboardProps {
  onViewJobs: () => void;
  onStartAssessment?: () => void;
}

export function CandidateDashboard({ onViewJobs, onStartAssessment }: CandidateDashboardProps) {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [cvName, setCvName] = useState<string | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCvUploadSuccess, setShowCvUploadSuccess] = useState(false);
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);
  const [showAddCertification, setShowAddCertification] = useState(false);
  const [deletingCertificationId, setDeletingCertificationId] = useState<string | null>(null);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [openJobsCount, setOpenJobsCount] = useState(0);


  useEffect(() => {
    if (profile?.cv_url) {
      setCvName(profile.cv_url.split("/").pop() ?? null);
    } else {
      setCvName(null);
    }
  }, [profile?.cv_url]);





  useEffect(() => {
    async function loadDashboard() {
      try {
        const [data, openJobs] = await Promise.all([
          getCandidateDashboardData(),
          getOpenJobs(),
        ]);
        setProfile(data);
        setOpenJobsCount(Array.isArray(openJobs) ? openJobs.length : 0);
      } catch (err) {
        console.error("Failed to load candidate dashboard", err);
      } finally {
        setLoadingData(false);
      }
    }

    loadDashboard();
  }, []);

  useEffect(() => {
    if (!user || role !== "candidate") return;
    window.localStorage.setItem(`candidate_seen_dashboard_${user.id}`, "1");
  }, [role, user]);


  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <CircularLoader size="md" label="Loading..." />
      </div>
    );
  }

  if (!user || role !== 'candidate') {
    return (
      <div className="p-8 text-center text-gray-600">
        Access denied
      </div>
    );
  }
  const skillsCount = profile?.candidate_skills?.length ?? 0;
  const allSkills = Array.isArray(profile?.candidate_skills) ? profile.candidate_skills : [];
  const featuredSkills = showAllSkills ? allSkills : allSkills.slice(0, 6);
  const overflowSkills = showAllSkills ? [] : allSkills.slice(6);
  const certsCount = profile?.candidate_certifications?.length ?? 0;
  const skillCategories = Array.from(
    new Set(
      allSkills
        .map((item: any) => String(item?.skills?.category ?? "").trim())
        .filter((category: string) => category.length > 0),
    ),
  );
  const topSkillCategories = skillCategories.slice(0, 3);
  const readinessScore = Math.min(
    100,
    Math.round(skillsCount * 15 + certsCount * 10)
  );
  const remainingToNextMilestone = Math.max(0, 90 - readinessScore);
  const assessmentRows = Array.isArray(profile?.candidate_assessments)
    ? profile.candidate_assessments
    : [];
  const resumeAnalysis = profile?.resume_analysis ?? null;
  const cvSkillsAdded = Number(resumeAnalysis?.skills_added ?? 0);
  const cvWasAnalyzed = Boolean(profile?.resume_last_analyzed_at);

  const scoreFromLevel = (level?: string | null) => {
    const normalized = String(level ?? "").toLowerCase();
    if (normalized === "advanced") return 85;
    if (normalized === "intermediate") return 65;
    if (normalized === "beginner") return 40;
    return 50;
  };

  const completion = profile
    ? calculateProfileCompletion(profile)
    : 0;
  const profileReady = isCandidateProfileReadyForApplication(profile);
  const candidateDisplayName = [profile?.full_name, profile?.surname]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const onboardingChecks = [
    {
      label: "Add your basic details",
      done: Boolean(
        String(profile?.full_name ?? "").trim() &&
        String(profile?.headline ?? "").trim() &&
        String(profile?.location ?? "").trim(),
      ),
      icon: UserCircle2,
    },
    {
      label: "Add at least one skill",
      done: Array.isArray(profile?.candidate_skills) && profile.candidate_skills.length > 0,
      icon: Star,
    },
    {
      label: "Upload your CV",
      done: Boolean(String(profile?.cv_url ?? "").trim()),
      icon: FileText,
    },
    {
      label: "Add experience information",
      done: Boolean(
        String(profile?.experience_level ?? "").trim() ||
        profile?.years_experience !== null && profile?.years_experience !== undefined,
      ),
      icon: Briefcase,
    },
  ];
  const completedChecks = onboardingChecks.filter((item) => item.done).length;

  // const applicantCount = job.job_applications.length;
  // const shortlistedCount = job.job_applications.filter(
  //   a => a.status === "shortlisted"
  // ).length;

  if (loading || loadingData) {
    return (
      <div className="p-8 flex items-center justify-center">
        <CircularLoader size="md" label="Loading..." />
      </div>
    );
  }

  async function handleDeleteSkill(candidateSkillId: string) {
    try {
      setDeletingSkillId(candidateSkillId);
      await removeCandidateSkill(candidateSkillId);
      const data = await getCandidateDashboardData();
      setProfile(data);
    } catch (err) {
      console.error("Failed to delete candidate skill", err);
    } finally {
      setDeletingSkillId(null);
    }
  }

  async function handleDeleteCertification(certificationId: string) {
    try {
      setDeletingCertificationId(certificationId);
      await removeCandidateCertification(certificationId);
      const data = await getCandidateDashboardData();
      setProfile(data);
    } catch (err) {
      console.error("Failed to delete candidate certification", err);
    } finally {
      setDeletingCertificationId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {candidateDisplayName || profile?.full_name}
          </h1>

          <p className="text-gray-600">Your skills journey continues. Keep building your verified profile.</p>

        </div>

        {!profileReady && (
          <Card className="mb-8 overflow-hidden border-0 shadow-xl shadow-blue-200/40">
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 p-6 text-white">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                    Candidate Setup
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">Complete Your Profile</h2>
                  <p className="mt-2 text-sm text-blue-100">
                    Finish your profile to unlock stronger job matches, improve your visibility to employers,
                    and make your application-ready score count.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                    <span className="rounded-full bg-white/15 px-3 py-1 font-medium">
                      {completion}% complete
                    </span>
                    <span className="rounded-full bg-white/15 px-3 py-1 font-medium">
                      {completedChecks} of {onboardingChecks.length} setup steps done
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:min-w-[220px]">
                  <Button
                    className="bg-white text-blue-700 hover:bg-blue-50"
                    onClick={() => navigate("/candidate/profile")}
                  >
                    Complete Profile
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                  <p className="text-xs text-blue-100">
                    Add your details, skills, and CV before focusing on messages.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 bg-white p-6 md:grid-cols-2">
              {onboardingChecks.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 rounded-xl border p-4 ${
                    item.done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      item.done ? "bg-emerald-600 text-white" : "bg-white text-gray-500"
                    }`}
                  >
                    {item.done ? <CheckCircle2 className="w-5 h-5" /> : <item.icon className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${item.done ? "text-emerald-900" : "text-gray-900"}`}>
                      {item.label}
                    </p>
                    <p className={`text-xs ${item.done ? "text-emerald-700" : "text-gray-500"}`}>
                      {item.done ? "Completed" : "Still needed"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Readiness Score Card */}
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-8 mb-8 border-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5" />
                <span className="text-sm font-medium text-blue-100">Overall Readiness Score</span>
              </div>
              <div className="flex items-end gap-4 mb-6">
                <div className="text-6xl font-bold">{readinessScore}%</div>
                <div className="mb-3 flex items-center gap-1 text-blue-100">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Based on your verified profile data</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-blue-100">
                  <span>Career Ready</span>
                  <span>{readinessScore}% Complete</span>
                </div>
                <Progress value={readinessScore} className="h-2 bg-blue-500" />
              </div>
              <p className="text-sm text-blue-100 mt-4">
                {remainingToNextMilestone > 0
                  ? `${remainingToNextMilestone}% more to reach the 90% profile readiness milestone.`
                  : "Great job. Your profile is at or above the 90% readiness milestone."}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 flex flex-col justify-between gap-6">
              <div>
                <div className="text-sm text-blue-100 mb-2">You are ready to apply for</div>
                <div className="text-2xl font-bold mb-2">{openJobsCount} Open Jobs</div>
                <div className="text-sm text-blue-100">
                  Explore currently open roles and see which ones align best with your profile.
                </div>
              </div>
              <Button
                onClick={onViewJobs}
                className="w-full bg-white text-blue-600 hover:bg-blue-50"
              >
                View Matching Jobs
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Skill Scorecards */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Your Skill Scorecards</h2>
                <p className="text-sm text-gray-500">
                  {skillsCount} skills on your profile
                </p>
              </div>
              {skillsCount > 6 ? (
                <Button
                  variant="ghost"
                  className="text-blue-600"
                  onClick={() => setShowAllSkills((prev) => !prev)}
                >
                  {showAllSkills ? "Show Less" : `Show All ${skillsCount}`}
                  {showAllSkills ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredSkills.map((item: any) => (
                <Card key={item.id ?? item.skill} className="p-5 hover:shadow-md transition-shadow border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{item.skill}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {item.level}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <button
                        type="button"
                        className="rounded-md p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleDeleteSkill(String(item.id))}
                        disabled={!item.id || deletingSkillId === item.id}
                        aria-label={`Delete ${item.skill}`}
                        title={`Delete ${item.skill}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const skillScore = scoreFromLevel(item?.level);
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Score</span>
                            <span className="font-semibold text-gray-900">{skillScore}%</span>
                          </div>
                          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-purple-500"
                              style={{ width: `${skillScore}%` }}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </Card>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddSkill(true)}
              >
                + Add Skill
              </Button>
            </div>

            {overflowSkills.length > 0 ? (
              <Card className="border-gray-200 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">More skills</h3>
                    <p className="text-xs text-gray-500">
                      {overflowSkills.length} additional skills are hidden to keep this page easy to scan.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowAllSkills(true)}>
                    View remaining {overflowSkills.length}
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {overflowSkills.slice(0, 12).map((item: any) => (
                    <Badge key={`overflow-${item.id ?? item.skill}`} variant="secondary" className="px-3 py-1">
                      {item.skill}
                    </Badge>
                  ))}
                  {overflowSkills.length > 12 ? (
                    <Badge variant="outline">+{overflowSkills.length - 12} more</Badge>
                  ) : null}
                </div>
              </Card>
            ) : null}

            {/* Assessment Progress */}
            {/* <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Assessment Progress</h2>
              <Card className="p-6 border-gray-200">
                <div className="mb-4 rounded-2xl bg-gradient-to-r from-amber-50 via-white to-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Add certifications from any source</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Include certificates earned through ApexSight assessments or external providers.
                      </p>
                    </div>
                  </div>
                </div>
                {profile?.candidate_assessments.map((assessment, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <span className="font-medium">{assessment.name}</span>
                    <Progress value={assessment.progress} />
                    <span>{assessment.status}</span>
                  </div>
                ))}

              </Card>
            </div> */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Assessment Progress</h2>
              <Card className="p-6 border-gray-200">
                {assessmentRows.length === 0 ? (
                  <div className="text-sm text-gray-600">
                    No assessments available yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assessmentRows.map((assessment: any, index: number) => {
                      const progress = Number(assessment?.progress ?? 0);
                      const done = progress >= 100 || String(assessment?.status ?? "").toLowerCase() === "completed";
                      const inProgress = progress > 0 && progress < 100;
                      const iconClass = done ? "text-green-600" : inProgress ? "text-blue-600" : "text-gray-400";
                      return (
                        <div key={`${assessment?.name ?? "assessment"}-${index}`} className="flex items-center gap-4">
                          {done ? (
                            <CheckCircle2 className={`w-5 h-5 ${iconClass} flex-shrink-0`} />
                          ) : inProgress ? (
                            <Clock className={`w-5 h-5 ${iconClass} flex-shrink-0`} />
                          ) : (
                            <Target className={`w-5 h-5 ${iconClass} flex-shrink-0`} />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">{assessment?.name ?? "Assessment"}</span>
                              <span className="text-sm text-gray-600">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                          </div>
                          {inProgress && (
                            <Button size="sm" variant="ghost" className="text-blue-600">
                              Continue
                            </Button>
                          )}
                          {!done && progress === 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onStartAssessment?.()}
                              disabled={!onStartAssessment}
                            >
                              Start
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Certifications */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Certifications</h2>
              </div>
              <Card className="p-6 border-gray-200">
                {/* <div className="space-y-4">
                  {[
                    {
                      name: "Data Analysis Professional",
                      issuer: "ApexSight",
                      date: "Dec 2025"
                    },
                    {
                      name: "Python Fundamentals",
                      issuer: "ApexSight",
                      date: "Nov 2025"
                    },
                    {
                      name: "Workplace Communication",
                      issuer: "ApexSight",
                      date: "Oct 2025"
                    }
                  ].map((cert, index) => (
                    <div key={index} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Award className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm">{cert.name}</h3>
                        <p className="text-xs text-gray-600">{cert.issuer} · {cert.date}</p>
                      </div>
                    </div>
                  ))}
                </div> */}
                {profile?.candidate_assessments?.length === 0 && (
                  <p className="text-sm text-gray-500">No assessments started yet</p>
                )}

                {profile?.candidate_certifications.map((cert: any, index: number) => (
                  <div key={cert.id ?? index} className="rounded-xl border border-gray-200 bg-white p-3">
                      <h3 className="font-medium">{cert.name}</h3>
                      {cert.issuer ? (
                        <p className="text-xs text-gray-600">{cert.issuer}</p>
                      ) : null}
                      <p className="hidden text-xs text-gray-600">
                      {cert.issuer} · {cert.issued_at}
                    </p>
                  </div>
                ))}

                <Button
                  variant="ghost"
                  className="w-full mt-4 text-blue-600"
                  onClick={() => setShowAddCertification(true)}
                >
                  Add Certificate
                </Button>
              </Card>
            </div>

            {/* Documents */}

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Documents</h2>

              <Card className="p-6 border-gray-200 space-y-3">

                {/* CV status */}
                {cvName ? (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="truncate">{cvName}</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No CV uploaded yet
                  </p>
                )}

                {/* Upload */}
                <label className="block cursor-pointer" htmlFor="candidate-cv-upload">
                  <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-4 text-center transition hover:bg-blue-100">
                    <p className="text-sm font-medium text-blue-700">
                      {cvUploading ? "Uploading CV..." : "Upload CV"}
                    </p>
                    <p className="mt-1 text-xs text-blue-600">
                      Select a file or click here to upload your CV
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Accepted: PDF, DOC, DOCX, TXT
                    </p>
                  </div>
                </label>
                <input
                  id="candidate-cv-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  disabled={cvUploading}
                  className="sr-only"
                  onChange={async (e) => {
                    if (!e.target.files?.[0]) return;

                    try {
                      setCvUploading(true);
                      const path = await uploadCandidateCV(e.target.files[0]);
                      setCvName(path.split("/").pop() ?? null);
                      const data = await getCandidateDashboardData();
                      setProfile(data);
                      setShowCvUploadSuccess(true);
                    } catch (err) {
                      console.error("CV upload failed", err);
                    } finally {
                      setCvUploading(false);
                      e.currentTarget.value = "";
                    }
                  }}
                />

                {cvUploading && (
                  <p className="text-xs text-blue-600">Uploading CV…</p>
                )}
              </Card>
            </div>

            {false && (
            <>
            {/* Recommended Learning */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recommended for You</h2>
              <Card className="p-6 border-gray-200">
                <div className="space-y-4">
                  {[
                    {
                      title: "Advanced Excel Skills",
                      type: "Micro-course",
                      duration: "2 hours"
                    },
                    {
                      title: "Leadership Essentials",
                      type: "Practice Task",
                      duration: "45 min"
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm">{item.title}</h3>
                        <p className="text-xs text-gray-600">{item.type} · {item.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4">
                  Browse Learning
                </Button>
              </Card>
            </div>
            </>
            )}

            {/* Quick Actions */}
            <Card className={`${profileReady ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"} p-6`}>
              <div className="flex items-start gap-3 mb-4">
                {profileReady ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {profileReady ? "Your Profile Is Ready" : "Profile Progress"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {profileReady
                      ? "Your profile is application-ready. You can keep improving it while you apply for jobs."
                      : `Complete your profile to increase visibility to employers. You're currently ${completion}% done.`}
                  </p>
                </div>
              </div>
              <Button
                className={`w-full ${profileReady ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"} text-white`}
                onClick={() => navigate("/candidate/profile")}
              >
                {profileReady ? "Improve Profile" : `Complete Profile (${completion}%)`}
              </Button>
              {profileReady && (
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={() => navigate("/candidate/messages")}
                >
                  Open Messages
                </Button>
              )}
            </Card>
          </div>
        </div>
        {showAddSkill && (
          <AddSkillModal
            onClose={() => setShowAddSkill(false)}
            onSuccess={async () => {
              const data = await getCandidateDashboardData();
              setProfile(data);
            }}
          />
        )}
        {showAddCertification && (
          <AddCertificationModal
            onClose={() => setShowAddCertification(false)}
            onSuccess={async () => {
              const data = await getCandidateDashboardData();
              setProfile(data);
            }}
          />
        )}
        {showEditProfile && (
          <EditProfileModal
            profile={profile}
            onClose={() => setShowEditProfile(false)}
            onSuccess={async () => {
              const data = await getCandidateDashboardData();
              setProfile(data);
            }}
          />
        )}
        <Dialog open={showCvUploadSuccess} onOpenChange={setShowCvUploadSuccess}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                CV uploaded successfully
              </DialogTitle>
              <DialogDescription>
                Your CV has been uploaded and your profile was refreshed for matching.
                If scores do not change immediately, they will update after the next matching cycle.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setShowCvUploadSuccess(false)}>Okay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

