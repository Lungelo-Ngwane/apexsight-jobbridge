import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { 
  CheckCircle2,
  Award,
  Briefcase,
  TrendingUp,
  Download,
  Share2,
  ArrowRight,
  Star,
  MapPin
} from "lucide-react";

interface JobReadinessSummaryProps {
  onViewJobs: () => void;
}

export function JobReadinessSummary({ onViewJobs }: JobReadinessSummaryProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Success Banner */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-8 mb-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Congratulations, Thabo!</h1>
              <p className="text-green-100">You've completed your skills assessment</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold mb-1">85%</div>
              <div className="text-sm text-green-100">Overall Score</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold mb-1">Advanced</div>
              <div className="text-sm text-green-100">Skill Level</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold mb-1">Top 15%</div>
              <div className="text-sm text-green-100">National Ranking</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Skill Breakdown */}
            <Card className="p-6 border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Skill Breakdown</h2>
              
              <div className="space-y-4">
                {[
                  { skill: "Data Analysis Fundamentals", score: 92, color: "bg-emerald-500" },
                  { skill: "SQL & Database Management", score: 85, color: "bg-blue-500" },
                  { skill: "Data Visualization", score: 88, color: "bg-purple-500" },
                  { skill: "Statistical Methods", score: 78, color: "bg-yellow-500" },
                  { skill: "Problem Solving", score: 90, color: "bg-pink-500" }
                ].map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{item.skill}</span>
                      <span className="font-semibold text-gray-900">{item.score}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.color} transition-all duration-500`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Matching Jobs */}
            <Card className="p-6 border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">You Are Ready for These Roles</h2>
                <Badge className="bg-blue-100 text-blue-700">34 Matches</Badge>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: "Junior Data Analyst",
                    company: "Nedbank",
                    location: "Johannesburg, Gauteng",
                    match: 95,
                    salary: "R25,000 - R35,000"
                  },
                  {
                    title: "Business Intelligence Analyst",
                    company: "Discovery Health",
                    location: "Sandton, Gauteng",
                    match: 92,
                    salary: "R30,000 - R40,000"
                  },
                  {
                    title: "Data Analytics Specialist",
                    company: "Standard Bank",
                    location: "Cape Town, Western Cape",
                    match: 88,
                    salary: "R28,000 - R38,000"
                  }
                ].map((job, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-5 h-5 text-gray-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{job.title}</h3>
                          <p className="text-sm text-gray-600">{job.company}</p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 flex-shrink-0">
                          {job.match}% Match
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location}
                        </div>
                        <div className="font-medium text-gray-900">{job.salary}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                onClick={onViewJobs}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                View All Matching Jobs on JobBridge™
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Certification Card */}
            <Card className="p-6 border-gray-200 bg-gradient-to-br from-yellow-50 to-amber-50">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="w-10 h-10 text-yellow-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Certificate Earned!</h3>
                <p className="text-sm text-gray-600">
                  Data Analysis Professional Certificate
                </p>
              </div>

              <div className="space-y-2 mb-4">
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download Certificate
                </Button>
                <Button variant="outline" className="w-full">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share on LinkedIn
                </Button>
              </div>

              <div className="text-xs text-center text-gray-500">
                Certificate ID: APS-DA-2025-{Math.random().toString(36).substr(2, 9).toUpperCase()}
              </div>
            </Card>

            {/* Next Steps */}
            <Card className="p-6 border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Recommended Next Steps</h3>
              
              <div className="space-y-3">
                {[
                  {
                    icon: Star,
                    title: "Complete Your Profile",
                    description: "Add work experience and education"
                  },
                  {
                    icon: TrendingUp,
                    title: "Take Advanced Assessments",
                    description: "Unlock more opportunities"
                  },
                  {
                    icon: Briefcase,
                    title: "Apply to Jobs",
                    description: "Start your job search on JobBridge™"
                  }
                ].map((step, index) => (
                  <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-gray-900">{step.title}</h4>
                      <p className="text-xs text-gray-600">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Stats Card */}
            <Card className="p-6 border-gray-200 bg-blue-50">
              <h3 className="font-semibold text-gray-900 mb-4">Your Impact</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Skills Verified</span>
                  <span className="font-semibold text-gray-900">5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Certificates Earned</span>
                  <span className="font-semibold text-gray-900">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Job Matches</span>
                  <span className="font-semibold text-gray-900">34</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Profile Views</span>
                  <span className="font-semibold text-gray-900">127</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
