import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { 
  Plus,
  Users,
  Eye,
  Star,
  MoreVertical,
  Search,
  Filter,
  Briefcase,
  MapPin,
  Clock,
  TrendingUp,
  CheckCircle,
  Calendar,
  DollarSign
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";

export function EmployerJobsPage() {
  const [activeTab, setActiveTab] = useState("active");

  const jobs = {
    active: [
      {
        id: 1,
        title: "Senior Data Analyst",
        department: "Analytics",
        location: "Johannesburg",
        type: "Full-time",
        salary: "R850K - R950K",
        posted: "5 days ago",
        applicants: 127,
        shortlisted: 12,
        interviewed: 5,
        views: 1240,
        status: "Active"
      },
      {
        id: 2,
        title: "Python Developer",
        department: "Engineering",
        location: "Remote",
        type: "Full-time",
        salary: "R750K - R900K",
        posted: "12 days ago",
        applicants: 203,
        shortlisted: 18,
        interviewed: 8,
        views: 2150,
        status: "Active"
      },
      {
        id: 3,
        title: "Business Analyst",
        department: "Operations",
        location: "Cape Town",
        type: "Contract",
        salary: "R650K - R750K",
        posted: "8 days ago",
        applicants: 156,
        shortlisted: 9,
        interviewed: 3,
        views: 980,
        status: "Active"
      },
      {
        id: 4,
        title: "UX Designer",
        department: "Design",
        location: "Johannesburg",
        type: "Full-time",
        salary: "R550K - R700K",
        posted: "15 days ago",
        applicants: 89,
        shortlisted: 7,
        interviewed: 4,
        views: 756,
        status: "Active"
      }
    ],
    draft: [
      {
        id: 5,
        title: "DevOps Engineer",
        department: "Engineering",
        location: "Remote",
        type: "Full-time",
        salary: "R900K - R1.1M",
        posted: "Draft",
        applicants: 0,
        shortlisted: 0,
        interviewed: 0,
        views: 0,
        status: "Draft"
      }
    ],
    closed: [
      {
        id: 6,
        title: "Marketing Manager",
        department: "Marketing",
        location: "Durban",
        type: "Full-time",
        salary: "R700K - R850K",
        posted: "Closed 3 days ago",
        applicants: 234,
        shortlisted: 15,
        interviewed: 6,
        views: 1850,
        status: "Closed"
      }
    ]
  };

  const stats = [
    {
      label: "Total Active Jobs",
      value: jobs.active.length,
      change: "+2 this month",
      icon: Briefcase,
      color: "from-blue-500 to-blue-600"
    },
    {
      label: "Total Applicants",
      value: jobs.active.reduce((sum, job) => sum + job.applicants, 0),
      change: "+124 this week",
      icon: Users,
      color: "from-emerald-500 to-emerald-600"
    },
    {
      label: "Shortlisted",
      value: jobs.active.reduce((sum, job) => sum + job.shortlisted, 0),
      change: "Across all jobs",
      icon: Star,
      color: "from-amber-500 to-amber-600"
    },
    {
      label: "Total Views",
      value: jobs.active.reduce((sum, job) => sum + job.views, 0).toLocaleString(),
      change: "+18% vs last month",
      icon: Eye,
      color: "from-purple-500 to-purple-600"
    }
  ];

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Job Management</h1>
              <p className="text-sm text-gray-600">Manage all your job postings and track applications</p>
            </div>
            <Button 
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
        {/* Stats Overview */}
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
                <div className="text-sm font-medium text-gray-600 mb-2">{stat.label}</div>
                <div className="text-xs text-gray-500">{stat.change}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Search and Filter Bar */}
        <Card className="p-4 mb-6 border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search jobs by title, department, or location..." 
                className="pl-10 border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" className="gap-2 border-gray-300">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </Card>

        {/* Tabs and Job Listings */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-gray-100/80 backdrop-blur p-1">
            <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Active Jobs ({jobs.active.length})
            </TabsTrigger>
            <TabsTrigger value="draft" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Drafts ({jobs.draft.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Closed ({jobs.closed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {jobs.active.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </TabsContent>

          <TabsContent value="draft" className="space-y-4">
            {jobs.draft.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </TabsContent>

          <TabsContent value="closed" className="space-y-4">
            {jobs.closed.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "Draft":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "Closed":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <Card className="p-6 border-gray-200 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group">
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
              <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                <span className="font-medium">{job.department}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {job.location}
                </span>
                <span>•</span>
                <span>{job.type}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`border ${getStatusColor(job.status)}`}>
            {job.status}
          </Badge>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">{job.salary}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">{job.posted}</span>
        </div>
      </div>

      {job.status !== "Draft" && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium">Applicants</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{job.applicants}</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Star className="w-4 h-4" />
                <span className="text-xs font-medium">Shortlisted</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{job.shortlisted}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Interviewed</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{job.interviewed}</div>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-xs font-medium">Views</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{job.views}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            >
              View Candidates
            </Button>
            <Button variant="outline" className="flex-1 border-gray-300">
              Edit Job
            </Button>
            <Button variant="outline" className="border-gray-300">
              <TrendingUp className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}

      {job.status === "Draft" && (
        <div className="flex items-center gap-3">
          <Button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
            Continue Editing
          </Button>
          <Button variant="outline" className="flex-1 border-gray-300">
            Preview
          </Button>
        </div>
      )}
    </Card>
  );
}
