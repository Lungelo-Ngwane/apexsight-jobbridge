import { useEffect, useState } from "react";
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
  Crown
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
// import { PostJobModal } from "./components/PostJobModal";
import { useAuth } from "../context/AuthContext";
import {
  createJob,
  getEmployerCredits,
  getEmployerJobs,
  getJobApplicants,
  updateJobStatus,
  updateApplicationStatus,
  getEmployerAnalytics,
  type EmployerCreditBalance,
} from '@/lib/employer';
import { StatBox } from "./ui/statbox";
import { PostJobModal } from "./PostJobModal";
import { JobCandidatesModal } from "./JobCandidatesModal";
import { useEmployerProfile } from "../../hooks/useEmployerProfile";
import { UpgradeModal } from "./UpgradeModal";

// import { getEmployerOpenJobs } from "../../lib/employer";


interface EmployerDashboardProps {
  onPostJob: () => void;
  onViewCandidates: () => void;
}

export function EmployerDashboard({ onPostJob, onViewCandidates }: EmployerDashboardProps) {
  const { user, role, loading } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [showPostJob, setShowPostJob] = useState(false);
  const [totalOpenJobs, setTotalOpenJobs] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const JOBS_PER_PAGE = 3;
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE);
  const { profile } = useEmployerProfile();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [creditBalances, setCreditBalances] = useState<EmployerCreditBalance[]>([]);




  useEffect(() => {
    getEmployerAnalytics().then(setStats);
    getEmployerCredits()
      .then(setCreditBalances)
      .catch((error) => console.error("Failed to load employer credits", error));
  }, []);


  useEffect(() => {
    async function loadJobs() {
      try {
        const data = await getEmployerJobs();
        setJobs(data || []);
        setVisibleCount(JOBS_PER_PAGE);
      } catch (err) {
        console.error("Failed to load jobs", err);
      } finally {
        setJobsLoading(false);
      }
    }

    loadJobs();
  }, []);

  const openJobs = jobs.filter((job) => job.status === 'open');

  const plan = profile?.plan ?? "free";
  const hasAnalytics = plan !== "free";
  const hasPremium = plan !== "free";

  const analyticsStats = [
    {
      label: "Open Job Postings",
      value: stats?.activeJobs ?? "—",
      change: "+3 this month",
      icon: Briefcase,
      color: "bg-blue-500",
      premium: false
    },
    {
      label: "Total Applicants",
      value: stats?.totalApplicants,
      change: "+124 this week",
      icon: Users,
      color: "bg-emerald-500",
      premium: false
    },
    {
      label: "Avg. Time-to-Hire",
      value: `1 days`,
      change: "-7 days vs. avg",
      icon: Clock,
      color: "bg-purple-500",
      premium: true
    },
    {
      label: "Interview Ready",
      value: stats?.shortlisted,
      change: "Across all roles",
      icon: Star,
      color: "bg-amber-500",
      premium: true
    }
  ];



  if (loading) {
    return <div className="p-8">Loading...</div>;
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Employer Dashboard</h1>
            <p className="text-gray-600">
              {profile?.company_name ?? "Your Company"} - Talent Acquisition
            </p>
          </div>

          <Button
            onClick={() => setShowPostJob(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Post New Job
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {analyticsStats.map((stat, index) => {
            const isLocked = stat.premium && !hasPremium;

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
                    {stat.value}
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
            {creditBalances.map((credit) => (
              <div key={credit.creditType} className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">{credit.creditType}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{credit.remaining}</p>
              </div>
            ))}
          </div>
        </Card>



        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Job Postings */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Active Job Postings</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {jobsLoading && (
                <Card className="p-6 text-center text-gray-500">
                  Loading job postings...
                </Card>
              )}

              {!jobsLoading && openJobs.length === 0 && (
                <Card className="p-6 text-center text-gray-500">
                  No jobs posted yet
                </Card>
              )}

              {openJobs.slice(0, visibleCount).map((job) => (
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

                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
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
                      onClick={() => updateJobStatus(job.id, "closed")}
                    >
                      Close Job
                    </Button>
                  </div>
                </Card>
              ))}

            </div>

            {visibleCount < openJobs.length && (
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
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Post New Job
                </Button>

                {hasAnalytics ? (
                  <Button variant="outline" className="w-full justify-start">
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
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Message Candidates
                </Button>
                {hasAnalytics ? (
                  <Button variant="outline" className="w-full justify-start">
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
            <Card className="p-6 border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {[
                  {
                    action: "New applicant",
                    detail: "Sarah M. applied for Python Developer",
                    time: "2 hours ago",
                    score: 92
                  },
                  {
                    action: "Interview scheduled",
                    detail: "John K. - Senior Data Analyst",
                    time: "5 hours ago",
                    score: 88
                  },
                  {
                    action: "New applicant",
                    detail: "Thabo N. applied for Business Analyst",
                    time: "1 day ago",
                    score: 85
                  }
                ].map((activity, index) => (
                  <div key={index} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{activity.action}</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                        {activity.score}%
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{activity.detail}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Skill Insights */}
            {hasAnalytics && (
              <Card className="p-6 border-gray-200 bg-blue-50">
                <h3 className="font-semibold text-gray-900 mb-2">Talent Pool Insights</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Top skills available in your talent pool this week
                </p>
                <div className="space-y-2">
                  {[
                    { skill: "Python", count: 1240 },
                    { skill: "Data Analysis", count: 980 },
                    { skill: "SQL", count: 850 },
                    { skill: "Project Management", count: 720 }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.skill}</span>
                      <span className="font-medium text-gray-900">{item.count}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4">
                  View Full Report
                </Button>
              </Card>
            )}
            {!hasAnalytics && (
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
          onClose={() => setShowPostJob(false)}
          onSuccess={() => {
            // reload jobs
            getEmployerJobs().then(setJobs);
          }}
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
