import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { 
  CheckCircle2, 
  Target, 
  Shield, 
  Users,
  ArrowRight,
  Award,
  TrendingUp,
  Clock,
  Building2
} from "lucide-react";

interface JobBridgeLandingProps {
  onGetStarted: () => void;
}

export function JobBridgeLanding({ onGetStarted }: JobBridgeLandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Building2 className="w-4 h-4" />
            JobBridge™ Recruitment Marketplace
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Hire Based on Skills,<br />
            <span className="text-blue-600">Not CVs</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Access South Africa's largest pool of skill-verified talent. 
            Hire faster, more fairly, and with complete confidence.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Button 
              onClick={onGetStarted}
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
            >
              Post a Job
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-gray-300 text-gray-700 px-8 py-6 text-lg"
            >
              Schedule Demo
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              15,000+ Verified Candidates
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              2,500+ Active Employers
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              60% Faster Hiring
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              value: "60%",
              label: "Faster time-to-hire",
              icon: Clock
            },
            {
              value: "95%",
              label: "Candidate quality rate",
              icon: Target
            },
            {
              value: "40%",
              label: "Reduction in hiring costs",
              icon: TrendingUp
            },
            {
              value: "100%",
              label: "Skills verified",
              icon: Shield
            }
          ].map((stat, index) => (
            <Card key={index} className="p-6 text-center bg-white border-gray-200">
              <stat.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Simplified Hiring Process
          </h2>
          <p className="text-lg text-gray-600">
            From job posting to offer in four streamlined steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: "1",
              title: "Define Skills Required",
              description: "Create skill-based job requirements instead of traditional job descriptions"
            },
            {
              step: "2",
              title: "Review Verified Candidates",
              description: "Access only candidates who have proven their skills through assessments"
            },
            {
              step: "3",
              title: "Interview & Shortlist",
              description: "Focus on cultural fit with confidence in technical abilities"
            },
            {
              step: "4",
              title: "Hire & Onboard",
              description: "Make offers and onboard quality talent faster than ever"
            }
          ].map((step, index) => (
            <div key={index} className="relative">
              <Card className="p-6 bg-white border-gray-200 hover:shadow-lg transition-shadow h-full">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-lg flex items-center justify-center mb-4 text-xl font-bold">
                  {step.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </Card>
              {index < 3 && (
                <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                  <ArrowRight className="w-6 h-6 text-gray-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20 bg-gradient-to-b from-transparent to-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Why Leading Employers Choose JobBridge™
            </h2>
            <div className="space-y-6">
              {[
                {
                  icon: Shield,
                  title: "100% Skills Verification",
                  description: "Every candidate has completed verified assessments. No resume guesswork."
                },
                {
                  icon: Users,
                  title: "Bias-Free Hiring",
                  description: "Focus on proven abilities, not institutional backgrounds or connections"
                },
                {
                  icon: Award,
                  title: "SETA-Aligned Standards",
                  description: "All assessments aligned with national skills frameworks and industry standards"
                },
                {
                  icon: TrendingUp,
                  title: "Data-Driven Matching",
                  description: "AI-powered candidate matching based on verified skills and job requirements"
                }
              ].map((feature, index) => (
                <div key={index} className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Trusted by Leading Organizations</h3>
            
            <div className="space-y-6 mb-8">
              {[
                {
                  company: "Standard Bank",
                  type: "Financial Services",
                  hires: "120+ hires"
                },
                {
                  company: "Discovery Health",
                  type: "Healthcare & Insurance",
                  hires: "85+ hires"
                },
                {
                  company: "Department of Health",
                  type: "Government",
                  hires: "200+ hires"
                },
                {
                  company: "Capitec Bank",
                  type: "Financial Services",
                  hires: "95+ hires"
                }
              ].map((client, index) => (
                <div key={index} className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{client.company}</h4>
                    <p className="text-xs text-gray-600">{client.type}</p>
                  </div>
                  <div className="text-sm font-medium text-blue-600">{client.hires}</div>
                </div>
              ))}
            </div>

            <Button 
              onClick={onGetStarted}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              Start Hiring Today
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-12 border-0">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Transform Your Hiring?
            </h2>
            <p className="text-lg text-blue-100 mb-8">
              Join South Africa's premier skill-verified recruitment marketplace
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button 
                onClick={onGetStarted}
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                Post Your First Job
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
