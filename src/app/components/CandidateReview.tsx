import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { 
  Award,
  CheckCircle2,
  MapPin,
  Star,
  TrendingUp,
  Target,
  MessageSquare,
  Calendar,
  X,
  ArrowLeft,
  Download
} from "lucide-react";

interface CandidateReviewProps {
  onBack: () => void;
  onShortlist: () => void;
}

export function CandidateReview({ onBack, onShortlist }: CandidateReviewProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Candidates
            </Button>
            
            <div className="flex items-center gap-2">
              <Button variant="outline">
                <MessageSquare className="w-4 h-4 mr-2" />
                Message
              </Button>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Interview
              </Button>
              <Button 
                onClick={onShortlist}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Star className="w-4 h-4 mr-2" />
                Add to Shortlist
              </Button>
              <Button variant="outline" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Candidate Header */}
            <Card className="p-6 border-gray-200">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
                  TN
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 mb-1">
                        Thabo Nkosi
                      </h1>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Johannesburg, Gauteng
                        </div>
                        <span>•</span>
                        <span>3 years experience</span>
                      </div>
                    </div>
                    
                    <Badge className="bg-green-100 text-green-700 text-lg px-4 py-2">
                      95% Match
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Skills Verified
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      5 Certifications
                    </Badge>
                    <Badge variant="secondary">
                      Top 15% Nationally
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Job Readiness Score */}
            <Card className="p-6 border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Overall Readiness Score
                </h2>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">85%</div>
                  <div className="text-sm text-gray-600">Overall Score</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">Advanced</div>
                  <div className="text-sm text-gray-600">Skill Level</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">Top 15%</div>
                  <div className="text-sm text-gray-600">National Rank</div>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="skills" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="skills">Verified Skills</TabsTrigger>
                <TabsTrigger value="certifications">Certifications</TabsTrigger>
                <TabsTrigger value="assessments">Assessment History</TabsTrigger>
              </TabsList>

              <TabsContent value="skills">
                <Card className="p-6 border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Skill Breakdown</h3>
                  
                  <div className="space-y-6">
                    {[
                      { 
                        skill: "Data Analysis Fundamentals", 
                        score: 92, 
                        level: "Advanced",
                        color: "bg-emerald-500",
                        verified: true,
                        assessmentDate: "Dec 2025"
                      },
                      { 
                        skill: "SQL & Database Management", 
                        score: 85, 
                        level: "Advanced",
                        color: "bg-blue-500",
                        verified: true,
                        assessmentDate: "Nov 2025"
                      },
                      { 
                        skill: "Python Programming", 
                        score: 88, 
                        level: "Advanced",
                        color: "bg-purple-500",
                        verified: true,
                        assessmentDate: "Nov 2025"
                      },
                      { 
                        skill: "Data Visualization", 
                        score: 82, 
                        level: "Intermediate",
                        color: "bg-yellow-500",
                        verified: true,
                        assessmentDate: "Oct 2025"
                      },
                      { 
                        skill: "Statistical Methods", 
                        score: 78, 
                        level: "Intermediate",
                        color: "bg-pink-500",
                        verified: true,
                        assessmentDate: "Oct 2025"
                      }
                    ].map((item, index) => (
                      <div key={index} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">{item.skill}</h4>
                              {item.verified && (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <Badge variant="secondary" className="text-xs">
                                {item.level}
                              </Badge>
                              <span>Assessed {item.assessmentDate}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">{item.score}%</div>
                          </div>
                        </div>
                        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`absolute left-0 top-0 h-full ${item.color} transition-all`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="certifications">
                <Card className="p-6 border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Earned Certifications</h3>
                  
                  <div className="space-y-4">
                    {[
                      {
                        name: "Data Analysis Professional Certificate",
                        issuer: "ApexSight",
                        date: "December 2025",
                        id: "APS-DA-2025-XY7K9"
                      },
                      {
                        name: "Python Programming Fundamentals",
                        issuer: "ApexSight",
                        date: "November 2025",
                        id: "APS-PY-2025-WM4L2"
                      },
                      {
                        name: "SQL Database Management",
                        issuer: "ApexSight",
                        date: "November 2025",
                        id: "APS-SQL-2025-KN8P5"
                      },
                      {
                        name: "Data Visualization Specialist",
                        issuer: "ApexSight",
                        date: "October 2025",
                        id: "APS-DV-2025-RT3Q1"
                      },
                      {
                        name: "Professional Communication",
                        issuer: "ApexSight",
                        date: "October 2025",
                        id: "APS-PC-2025-HG6F9"
                      }
                    ].map((cert, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Award className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-1">{cert.name}</h4>
                          <p className="text-sm text-gray-600 mb-1">
                            {cert.issuer} · {cert.date}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">ID: {cert.id}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="assessments">
                <Card className="p-6 border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Assessment History</h3>
                  
                  <div className="space-y-4">
                    {[
                      {
                        name: "Data Analysis Comprehensive Assessment",
                        date: "December 15, 2025",
                        score: 92,
                        duration: "45 minutes",
                        questions: 40
                      },
                      {
                        name: "Python Programming Assessment",
                        date: "November 28, 2025",
                        score: 88,
                        duration: "60 minutes",
                        questions: 50
                      },
                      {
                        name: "SQL Database Management Assessment",
                        date: "November 22, 2025",
                        score: 85,
                        duration: "40 minutes",
                        questions: 35
                      }
                    ].map((assessment, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {assessment.name}
                            </h4>
                            <p className="text-sm text-gray-600">{assessment.date}</p>
                          </div>
                          <Badge className="bg-green-100 text-green-700">
                            {assessment.score}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{assessment.questions} questions</span>
                          <span>•</span>
                          <span>{assessment.duration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="p-6 border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  onClick={onShortlist}
                  className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Star className="w-4 h-4 mr-2" />
                  Add to Shortlist
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Interview
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Download Profile
                </Button>
              </div>
            </Card>

            {/* Match Breakdown */}
            <Card className="p-6 border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Match Breakdown</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Required Skills</span>
                    <span className="text-sm font-semibold text-gray-900">100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">All 3 skills verified</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Experience Level</span>
                    <span className="text-sm font-semibold text-gray-900">95%</span>
                  </div>
                  <Progress value={95} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">Exceeds requirements</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Location</span>
                    <span className="text-sm font-semibold text-gray-900">100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">Perfect match</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Availability</span>
                    <span className="text-sm font-semibold text-gray-900">85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">Available in 2 weeks</p>
                </div>
              </div>
            </Card>

            {/* Candidate Stats */}
            <Card className="p-6 border-gray-200 bg-blue-50">
              <h3 className="font-semibold text-gray-900 mb-4">Candidate Insights</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Profile Views</span>
                  <span className="font-semibold text-gray-900">127</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Applications Sent</span>
                  <span className="font-semibold text-gray-900">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Response Rate</span>
                  <span className="font-semibold text-gray-900">100%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last Active</span>
                  <span className="font-semibold text-gray-900">2 hours ago</span>
                </div>
              </div>
            </Card>

            {/* No CV Bias Badge */}
            <Card className="p-6 border-gray-200 bg-gradient-to-br from-emerald-50 to-green-50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Bias-Free Hiring</h3>
                  <p className="text-sm text-gray-600">
                    This profile focuses on verified skills, not traditional CVs. 
                    Hire based on proven abilities.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
