import { useEffect, useState } from "react";
import { getCandidateDashboardData } from "@/lib/candidate";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { Badge } from "@/app/components/ui/badge";
import {
  Award,
  CheckCircle2,
  Clock,
  TrendingUp,
  Target,
  BookOpen,
  ArrowRight,
  Star,
  Briefcase
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { applyForJob, uploadCandidateCV } from "../../lib/candidate";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import { AddSkillModal } from "./AddSkillModal";
import { EditProfileModal } from "./EditProfileModal";


interface CandidateDashboardProps {
  onViewJobs: () => void;
  onStartAssessment: () => void;
}

export function CandidateDashboard({ onViewJobs, onStartAssessment }: CandidateDashboardProps) {
  const { user, role, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [cvName, setCvName] = useState<string | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);


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
        const data = await getCandidateDashboardData();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load candidate dashboard", err);
      } finally {
        setLoadingData(false);
      }
    }

    loadDashboard();
  }, []);


  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user || role !== 'candidate') {
    return (
      <div className="p-8 text-center text-gray-600">
        Access denied
      </div>
    );
  }
  const skillsCount = profile?.candidate_skills?.length ?? 0;
  const certsCount = profile?.candidate_certifications?.length ?? 0;
  const readinessScore = Math.min(
    100,
    Math.round(skillsCount * 15 + certsCount * 10)
  );

  const completion = profile
    ? calculateProfileCompletion(profile)
    : 0;

  // const applicantCount = job.job_applications.length;
  // const shortlistedCount = job.job_applications.filter(
  //   a => a.status === "shortlisted"
  // ).length;

  if (loading || loadingData) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {profile?.full_name}
          </h1>

          <p className="text-gray-600">Your skills journey continues. Keep building your verified profile.</p>

        </div>

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
                  <span className="text-sm">+12% this month</span>
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
                Complete 2 more certifications to reach 90% and unlock premium opportunities
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-sm text-blue-100 mb-2">You are ready for</div>
                <div className="text-2xl font-bold mb-4">34 Job Roles</div>
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
              <h2 className="text-xl font-semibold text-gray-900">Your Skill Scorecards</h2>
              <Button variant="ghost" className="text-blue-600">View All</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile?.candidate_skills?.map((item) => (
                <Card key={item.skill} className="p-5 hover:shadow-md transition-shadow border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{item.skill}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {item.level}
                      </Badge>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />

                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Score</span>
                      <span className="font-semibold text-gray-900">{60}%</span>
                    </div>
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full bg-purple-500`}
                        style={{ width: `${60}%` }}
                      />
                    </div>
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

            {/* Assessment Progress */}
            {/* <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Assessment Progress</h2>
              <Card className="p-6 border-gray-200">
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
                <div className="space-y-4">
                  {[
                    {
                      name: "Digital Marketing Fundamentals",
                      progress: 100,
                      status: "Completed",
                      icon: CheckCircle2,
                      iconColor: "text-green-600"
                    },
                    {
                      name: "SQL Database Management",
                      progress: 65,
                      status: "In Progress",
                      icon: Clock,
                      iconColor: "text-blue-600"
                    },
                    {
                      name: "Business Analytics",
                      progress: 0,
                      status: "Not Started",
                      icon: Target,
                      iconColor: "text-gray-400"
                    }
                  ].map((assessment, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <assessment.icon className={`w-5 h-5 ${assessment.iconColor} flex-shrink-0`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{assessment.name}</span>
                          <span className="text-sm text-gray-600">{assessment.progress}%</span>
                        </div>
                        <Progress value={assessment.progress} className="h-1.5" />
                      </div>
                      {assessment.progress > 0 && assessment.progress < 100 && (
                        <Button size="sm" variant="ghost" className="text-blue-600">
                          Continue
                        </Button>
                      )}
                      {assessment.progress === 0 && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={onStartAssessment}
                        >
                          Start
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Certifications */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Certifications Earned</h2>
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

                {profile?.candidate_certifications.map((cert, index) => (
                  <div key={index}>
                    <h3 className="font-medium">{cert.name}</h3>
                    <p className="text-xs text-gray-600">
                      {cert.issuer} · {cert.issued_at}
                    </p>
                  </div>
                ))}

                <Button variant="ghost" className="w-full mt-4 text-blue-600">
                  View All Certificates
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
                <input
                  type="file"
                  accept=".pdf"
                  disabled={cvUploading}
                  onChange={async (e) => {
                    if (!e.target.files?.[0]) return;

                    try {
                      setCvUploading(true);
                      const path = await uploadCandidateCV(e.target.files[0]);
                      setCvName(path.split("/").pop() ?? null);
                      const data = await getCandidateDashboardData();
                      setProfile(data);
                    } catch (err) {
                      console.error("CV upload failed", err);
                    } finally {
                      setCvUploading(false);
                    }
                  }}
                />

                {cvUploading && (
                  <p className="text-xs text-blue-600">Uploading CV…</p>
                )}
              </Card>
            </div>

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

            {/* Quick Actions */}
            <Card className="bg-blue-50 border-blue-200 p-6">
              <div className="flex items-start gap-3 mb-4">
                <Star className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Boost Your Profile</h3>
                  <p className="text-sm text-gray-600">
                    Complete your profile to increase visibility to employers
                  </p>
                </div>
              </div>
              <Button
                disabled={completion === 100}
                className="w-full bg-blue-600"
              >
                {completion < 100
                  ? `Complete Profile (${completion}%)`
                  : "Profile Complete 🎉"}
              </Button>

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
      </div>
    </div>
  );
}
