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

interface EmployerDashboardProps {
  onPostJob: () => void;
  onViewCandidates: () => void;
}

export function EmployerDashboard({ onPostJob, onViewCandidates }: EmployerDashboardProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Employer Dashboard</h1>
            <p className="text-gray-600">Nedbank - Talent Acquisition</p>
          </div>
          
          <Button 
            onClick={onPostJob}
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
              label: "Active Job Postings",
              value: "12",
              change: "+3 this month",
              icon: Briefcase,
              color: "bg-blue-500"
            },
            {
              label: "Total Applicants",
              value: "847",
              change: "+124 this week",
              icon: Users,
              color: "bg-emerald-500"
            },
            {
              label: "Avg. Time-to-Hire",
              value: "18 days",
              change: "-7 days vs. avg",
              icon: Clock,
              color: "bg-purple-500"
            },
            {
              label: "Interview Ready",
              value: "34",
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
              {[
                {
                  title: "Senior Data Analyst",
                  department: "Analytics",
                  location: "Johannesburg",
                  posted: "5 days ago",
                  applicants: 127,
                  shortlisted: 12,
                  status: "Active",
                  views: 1240
                },
                {
                  title: "Python Developer",
                  department: "Engineering",
                  location: "Remote",
                  posted: "12 days ago",
                  applicants: 203,
                  shortlisted: 18,
                  status: "Active",
                  views: 2150
                },
                {
                  title: "Business Analyst",
                  department: "Operations",
                  location: "Cape Town",
                  posted: "8 days ago",
                  applicants: 156,
                  shortlisted: 9,
                  status: "Active",
                  views: 980
                }
              ].map((job, index) => (
                <Card key={index} className="p-6 border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                        <Badge className="bg-green-100 text-green-700">{job.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{job.department}</span>
                        <span>•</span>
                        <span>{job.location}</span>
                        <span>•</span>
                        <span>{job.posted}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-medium">Applicants</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">{job.applicants}</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <Star className="w-4 h-4" />
                        <span className="text-xs font-medium">Shortlisted</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">{job.shortlisted}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-purple-600 mb-1">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs font-medium">Views</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">{job.views}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={onViewCandidates}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      View Candidates
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Edit Posting
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
                  onClick={onPostJob}
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
    </div>
  );
}
