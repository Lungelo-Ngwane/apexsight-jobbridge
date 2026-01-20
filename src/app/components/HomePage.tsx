import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { 
  CheckCircle2, 
  Target, 
  Shield, 
  Award,
  ArrowRight,
  Users,
  Briefcase,
  TrendingUp,
  Building2,
  GraduationCap,
  BarChart3
} from "lucide-react";

interface HomePageProps {
  onSelectSkillLink: () => void;
  onSelectJobBridge: () => void;
}

export function HomePage({ onSelectSkillLink, onSelectJobBridge }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-blue-50">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20">
        <div className="text-center max-w-4xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            National Skills-Verified Hiring Platform
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            South Africa's Skill-Verified<br />
            <span className="text-blue-600">Talent Infrastructure</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Connecting skills, certifications, and jobs into one trusted hiring system
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button 
              onClick={onSelectSkillLink}
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-7 text-lg w-full sm:w-auto"
            >
              For Job Seekers → SkillLink™
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              onClick={onSelectJobBridge}
              size="lg" 
              variant="outline"
              className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-10 py-7 text-lg w-full sm:w-auto"
            >
              For Employers → JobBridge™
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Government-Aligned
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              SETA-Recognized
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Enterprise-Trusted
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {[
            { value: "250,000+", label: "Skills Verified" },
            { value: "15,000+", label: "Active Job Seekers" },
            { value: "2,500+", label: "Hiring Employers" },
            { value: "100%", label: "Skills-Based Matching" }
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-lg p-5 text-center shadow-sm border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Choose Your Path Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Path
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            ApexSight serves two connected communities. Select your journey below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* SkillLink Card */}
          <Card 
            className="p-8 border-2 border-gray-200 hover:border-blue-600 hover:shadow-2xl transition-all cursor-pointer group bg-gradient-to-br from-white to-blue-50"
            onClick={onSelectSkillLink}
          >
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-3">
                For Job Seekers
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-3">
                SkillLink™
              </h3>
              <p className="text-gray-600 text-lg mb-6">
                Turn your skills into verified opportunities. Complete assessments, 
                earn certifications, and unlock jobs based on what you can do.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {[
                { icon: Target, text: "Complete skills assessments" },
                { icon: Award, text: "Earn verified certifications" },
                { icon: TrendingUp, text: "Build your readiness score" },
                { icon: Briefcase, text: "Access skill-matched jobs" }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-gray-700">{item.text}</span>
                </div>
              ))}
            </div>

            <Button 
              onClick={onSelectSkillLink}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg group-hover:shadow-lg"
              size="lg"
            >
              Start SkillLink
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Card>

          {/* JobBridge Card */}
          <Card 
            className="p-8 border-2 border-gray-200 hover:border-blue-600 hover:shadow-2xl transition-all cursor-pointer group bg-gradient-to-br from-white to-purple-50"
            onClick={onSelectJobBridge}
          >
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium mb-3">
                For Employers
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-3">
                JobBridge™
              </h3>
              <p className="text-gray-600 text-lg mb-6">
                Hire based on skills, not CVs. Access South Africa's largest pool 
                of skill-verified talent with complete confidence.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {[
                { icon: Shield, text: "100% skills-verified candidates" },
                { icon: Users, text: "Bias-free, fair hiring" },
                { icon: TrendingUp, text: "60% faster time-to-hire" },
                { icon: BarChart3, text: "Data-driven matching" }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-gray-700">{item.text}</span>
                </div>
              ))}
            </div>

            <Button 
              onClick={onSelectJobBridge}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 text-lg group-hover:shadow-lg"
              size="lg"
            >
              Go to JobBridge
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-6 py-20 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How ApexSight Works
          </h2>
          <p className="text-lg text-gray-600">
            A complete ecosystem connecting skills verification to employment
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Skills Are Verified",
              description: "Job seekers complete comprehensive, SETA-aligned assessments and earn verified certifications",
              icon: Target,
              color: "bg-blue-600"
            },
            {
              step: "2",
              title: "Jobs Are Posted",
              description: "Employers define skill-based requirements and access only verified, qualified candidates",
              icon: Briefcase,
              color: "bg-purple-600"
            },
            {
              step: "3",
              title: "Matches Happen",
              description: "AI-powered matching connects verified skills to job requirements with zero bias",
              icon: Shield,
              color: "bg-green-600"
            }
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className={`w-16 h-16 ${item.color} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                <item.icon className="w-8 h-8 text-white" />
              </div>
              <div className="text-sm font-bold text-gray-500 mb-2">STEP {item.step}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
              <p className="text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trusted By */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Trusted by Leading Organizations
          </h2>
          <p className="text-lg text-gray-600">
            Government departments, SETAs, and enterprises nationwide
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            "Standard Bank",
            "Department of Health",
            "Discovery Health",
            "Capitec Bank",
            "Nedbank",
            "Services SETA",
            "City of Johannesburg",
            "Shoprite Group"
          ].map((org, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-center">
              <div className="text-center">
                <Building2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <div className="font-medium text-gray-700 text-sm">{org}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <Card className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 text-white p-12 border-0">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-blue-100 mb-8">
              Join South Africa's trusted skill-verified talent infrastructure
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                onClick={onSelectSkillLink}
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg w-full sm:w-auto"
              >
                I'm a Job Seeker
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                onClick={onSelectJobBridge}
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg w-full sm:w-auto"
              >
                I'm an Employer
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
