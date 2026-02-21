import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { 
  CheckCircle2, 
  Target, 
  Trophy, 
  Briefcase,
  ArrowRight,
  Shield,
  Award,
  TrendingUp
} from "lucide-react";

interface SkillLinkLandingProps {
  onGetStarted: () => void;
}

export function SkillLinkLanding({ onGetStarted }: SkillLinkLandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Award className="w-4 h-4" />
            SkillLink™ Career Readiness Platform
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Turn Your Skills Into<br />
            <span className="text-blue-600">Verified Opportunities</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Complete skills assessments, earn certifications, and unlock job opportunities 
            with South Africa's trusted talent verification platform.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Button 
              onClick={onGetStarted}
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
            >
              Assess My Skills
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              onClick={onGetStarted}
              size="lg" 
              variant="outline"
              className="border-gray-300 text-gray-700 px-8 py-6 text-lg"
            >
              Learn More
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-gray-600">
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
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Your Path to Employment
          </h2>
          <p className="text-lg text-gray-600">
            Four simple steps to verified career readiness
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              icon: Target,
              title: "1. Assess Your Skills",
              description: "Complete comprehensive skills assessments tailored to South African industries"
            },
            {
              icon: Trophy,
              title: "2. Earn Certifications",
              description: "Receive verified badges and certificates recognized by employers nationwide"
            },
            {
              icon: TrendingUp,
              title: "3. Build Readiness",
              description: "Access micro-courses and practice tasks to improve your job readiness score"
            },
            {
              icon: Briefcase,
              title: "4. Get Hired",
              description: "Match with verified job opportunities on JobBridge™ based on your skills"
            }
          ].map((step, index) => (
            <Card key={index} className="p-6 bg-white border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <step.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 bg-gradient-to-b from-transparent to-blue-50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Built for South African Youth
            </h2>
            <div className="space-y-6">
              {[
                {
                  icon: Shield,
                  title: "Fair & Unbiased Assessment",
                  description: "Skills-based evaluation that focuses on what you can do, not where you studied"
                },
                {
                  icon: Award,
                  title: "Industry-Recognized Credentials",
                  description: "Certifications aligned with SETA frameworks and employer requirements"
                },
                {
                  icon: TrendingUp,
                  title: "Continuous Skill Development",
                  description: "Access free learning resources to upskill and increase your readiness score"
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
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">250,000+</div>
              <p className="text-gray-600">Skills verified across South Africa</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">15,000+</div>
                <p className="text-xs text-gray-600">Active job seekers</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">2,500+</div>
                <p className="text-xs text-gray-600">Employers hiring</p>
              </div>
            </div>
            <Button 
              onClick={onGetStarted}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              Start Your Assessment
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-12 border-0">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Prove Your Skills?
            </h2>
            <p className="text-lg text-blue-100 mb-8">
              Join thousands of South Africans building verified career profiles
            </p>
            <Button 
              onClick={onGetStarted}
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Get Started for Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
