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
  MessageSquare,
  Filter,
  Search,
  MoreVertical
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
// import { PostJobModal } from "./components/PostJobModal";
import { useAuth } from "../context/AuthContext";
import {
  createJob,
  getEmployerJobs,
  getJobApplicants,
  updateJobStatus,
  updateApplicationStatus,
  getEmployerAnalytics
} from '@/lib/employer';
import { StatBox } from "./ui/statbox";
import { PostJobModal } from "./PostJobModal";
import { JobCandidatesModal } from "./JobCandidatesModal";

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


  useEffect(() => {
    getEmployerAnalytics().then(setStats);
  }, []);


  useEffect(() => {
    async function loadJobs() {
      try {
        const data = await getEmployerJobs();
        setJobs(data || []);
      } catch (err) {
        console.error("Failed to load jobs", err);
      } finally {
        setJobsLoading(false);
      }
    }

    loadJobs();
  }, []);

  const openJobs = jobs.filter((job) => job.status === 'open');

  console.log("Rendering EmployerDashboard with jobs:", selectedJobId);

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
  console.log(jobs);
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Employer Dashboard</h1>
            <p className="text-gray-600">{user.user_metadata.company_name} - Talent Acquisition</p>
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
          {[
            {
              label: "Open Job Postings",
              value: stats?.activeJobs ?? "—",
              change: "+3 this month",
              icon: Briefcase,
              color: "bg-blue-500"
            },
            {
              label: "Total Applicants",
              value: stats?.totalApplicants,
              change: "+124 this week",
              icon: Users,
              color: "bg-emerald-500"
            },
            {
              label: "Avg. Time-to-Hire",
              value: `1 days`,
              change: "-7 days vs. avg",
              icon: Clock,
              color: "bg-purple-500"
            },
            {
              label: "Interview Ready",
              value: stats?.shortlisted,
              change: "Across all roles",
              icon: Star,
              color: "bg-amber-500"
            }
          ].map((stat, index) => (
            <Card key={index} className="p-6 border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600 mb-2">{stat.label}</div>
              <div className="text-xs text-gray-500">{stat.change}</div>
            </Card>
          ))}
        </div>

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

              {!jobsLoading && jobs.length === 0 && (
                <Card className="p-6 text-center text-gray-500">
                  No jobs posted yet
                </Card>
              )}

              {jobs.map((job) => (
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
                      <div>
                        <p className="mt-2 text-sm text-gray-700">
                          {job.description}
                        </p>
                      </div>
                    </div>

                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <StatBox
                      icon={Users}
                      label="Applicants"
                      value={job.job_applications?.length ?? 0}
                    />
                    <StatBox
                      icon={Star}
                      label="Shortlisted"
                      value={
                        job.job_applications?.filter(
                          (a) => a.status === "shortlisted"
                        ).length ?? 0
                      }
                    />

                    <StatBox icon={Eye} label="Views" value={job.view_count ?? 0} />
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

            <Button variant="outline" className="w-full">
              View All Job Postings
            </Button>
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
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Browse Talent Pool
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Message Candidates
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
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

    </div>
  );
}
