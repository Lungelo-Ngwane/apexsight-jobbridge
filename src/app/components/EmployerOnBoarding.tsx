import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
    Building2,
    Briefcase,
    CheckCircle2,
    Sparkles,
    ArrowRight,
    Crown,
    Zap
} from "lucide-react";
import logo from "../assets/apexsight_logo_transparent.png";
import { updateEmployerProfile } from "../../lib/employer";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import { isActiveEmployerTrial } from "@/lib/subscriptionAccess";

export function EmployerOnboarding({
    initialStep
}: {
    initialStep: number;
}) {
    const { profile } = useEmployerProfile();
    const [step, setStep] = useState(initialStep);
    const [companyName, setCompanyName] = useState("");
    const [industry, setIndustry] = useState("");
    const [companySize, setCompanySize] = useState("");
    const [selectedPlanIntent, setSelectedPlanIntent] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const pendingPlan =
        selectedPlanIntent ??
        (String(profile?.selected_plan ?? "").toLowerCase() || null);
    const trialActive = isActiveEmployerTrial(profile);
    const trialEndsLabel = profile?.trial_ends_at
        ? new Date(profile.trial_ends_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        : null;

    async function completeProfile() {
        setSaving(true);

        await updateEmployerProfile({
            company_name: companyName,
            industry,
            onboarding_step: 1,
        });

        setStep(1);
        setSaving(false);
    }

    async function selectPlan(plan: string) {
        setSelectedPlanIntent(plan);
        if (trialActive) {
            await updateEmployerProfile({
                onboarding_step: 2,
            });
        } else if (plan === "free") {
            await updateEmployerProfile({
                plan: "free",
                selected_plan: null,
                subscription_status: "inactive",
                onboarding_step: 2,
            });
        } else {
            await updateEmployerProfile({
                plan: "free",
                selected_plan: plan,
                subscription_status: "pending_payment",
                onboarding_step: 2,
            });
        }

        setStep(2);
    }

    async function continueWithTrial() {
        setSelectedPlanIntent(null);
        await updateEmployerProfile({
            onboarding_step: 2,
        });
        setStep(2);
    }

    async function finishOnboarding() {
        await updateEmployerProfile({
            onboarding_step: 3,
        });

        window.location.href = "/employer/dashboard";
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
            </div>

            <div className="w-full max-w-7xl relative">
                {/* Logo */}
                <div className="text-center mb-4">
                    {/* <img
                        src={logo}
                        alt="ApexSight"
                        className="h-12 w-auto mx-auto mb-4"
                    /> */}
                    <div className="flex items-center justify-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">ApexSight</h2>
                        <span className="text-gray-400">•</span>
                        <span className="text-blue-600 font-semibold">JobBridge™</span>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="mb-4">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        {[0, 1, 2].map((s) => (
                            <div
                                key={s}
                                className={`h-2 rounded-full transition-all ${s <= step
                                        ? "bg-gradient-to-r from-blue-600 to-purple-600 w-20"
                                        : "bg-gray-200 w-12"
                                    }`}
                            />
                        ))}
                    </div>
                    <p className="text-center text-sm text-gray-600">
                        Step {step + 1} of 3
                    </p>
                </div>

                {/* Main Content Card */}
                <Card className="w-full mx-auto p-8 md:p-10 xl:p-12 shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
                    {step === 0 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Building2 className="w-8 h-8 text-white" />
                                </div>
                                <h1 className="text-xl font-bold text-gray-900 mb-3">
                                    Welcome to JobBridge™
                                </h1>
                                <p className="text-lg text-gray-600">
                                    Let's set up your employer profile to start hiring skill-verified talent
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="companyName" className="text-gray-700 font-medium mb-2 block">
                                        Company Name
                                    </Label>
                                    <Input
                                        id="companyName"
                                        placeholder="e.g., Acme Corporation"
                                        className="h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="industry" className="text-gray-700 font-medium mb-2 block">
                                        Industry
                                    </Label>
                                    <Input
                                        id="industry"
                                        placeholder="e.g., Financial Services, Technology"
                                        className="h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                                        value={industry}
                                        onChange={(e) => setIndustry(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={completeProfile}
                                disabled={saving || !companyName || !industry}
                                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                            >
                                {saving ? (
                                    "Setting up your profile..."
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRight className="ml-2 w-5 h-5" />
                                    </>
                                )}
                            </Button>

                            <p className="text-center text-sm text-gray-500">
                                By continuing, you agree to our Terms of Service
                            </p>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Crown className="w-8 h-8 text-white" />
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                                    {trialActive ? "You Have a Free Trial" : "Choose Your Plan"}
                                </h1>
                                <p className="text-lg text-gray-600">
                                    {trialActive
                                        ? `You have full premium access during your 15-day trial${trialEndsLabel ? ` until ${trialEndsLabel}` : ""}. No payment is needed now.`
                                        : "Start free, upgrade anytime. No credit card required."}
                                </p>
                            </div>

                            {trialActive ? (
                                <Card className="border-emerald-200 bg-emerald-50 p-6">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                                            <Sparkles className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-emerald-900">Trial benefits unlocked</h3>
                                            <p className="text-sm text-emerald-800 mt-1">
                                                Post jobs, browse candidates, message applicants, and use premium analytics.
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={continueWithTrial}
                                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        Continue with Free Trial
                                    </Button>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4 2xl:gap-8">
                                    <PlanCard
                                        title="Free"
                                        price="R0"
                                        period="forever"
                                        description="Perfect to get started"
                                        features={[
                                            "1 active job posting",
                                            "Up to 10 applicants per job",
                                            "Basic candidate filtering",
                                            "Email support"
                                        ]}
                                        icon={Briefcase}
                                        onSelect={() => selectPlan("free")}
                                    />

                                    <PlanCard
                                        title="Starter"
                                        price="R999"
                                        period="per month"
                                        description="For small teams getting started"
                                        features={[
                                            "2 active job postings",
                                            "50 candidate views per month",
                                            "Basic analytics",
                                            "Email support",
                                            "2 team users"
                                        ]}
                                        icon={Zap}
                                        onSelect={() => selectPlan("starter")}
                                    />

                                    <PlanCard
                                        title="Professional"
                                        price="R2,999"
                                        period="per month"
                                        description="Best for growing hiring teams"
                                        features={[
                                            "3 active job postings",
                                            "300 candidate views per month",
                                            "Advanced skill matching",
                                            "Priority support",
                                            "5 team users"
                                        ]}
                                        icon={Sparkles}
                                        highlight
                                        badge="Most Popular"
                                        onSelect={() => selectPlan("professional")}
                                    />

                                    <PlanCard
                                        title="Enterprise"
                                        price="R9,999"
                                        period="per month"
                                        description="For large organizations"
                                        features={[
                                            "4 active job postings",
                                            "Dedicated account manager",
                                            "White-label options",
                                            "White-label options",
                                            "SLA guarantee"
                                        ]}
                                        icon={Crown}
                                        onSelect={() => selectPlan("enterprise")}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 text-center">
                            <div className="py-8">
                                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                    <CheckCircle2 className="w-10 h-10 text-white" />
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                                    You're All Set! 🚀
                                </h1>
                                <p className="text-lg text-gray-600 mb-8">
                                    {pendingPlan && pendingPlan !== "free" && !isActiveEmployerTrial(profile)
                                        ? `Your account is ready. Complete payment for the ${pendingPlan} plan from your dashboard to unlock premium features.`
                                        : "Your JobBridge™ account is ready. Start posting jobs and discover South Africa's best skill-verified talent."}
                                </p>

                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                                    <h3 className="font-semibold text-gray-900 mb-4">What's Next?</h3>
                                    <div className="space-y-3 text-left">
                                        {[
                                            "Post your first job in minutes",
                                            "Access thousands of verified candidates",
                                            "Review skill-matched applications",
                                            "Start building your dream team"
                                        ].map((item, index) => (
                                            <div key={index} className="flex items-center gap-3">
                                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-gray-700">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                                    onClick={finishOnboarding}
                                >
                                    Go to Dashboard
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Footer */}
                <p className="text-center text-sm text-gray-500 mt-6">
                    Need help? <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">Contact Support</a>
                </p>
            </div>
        </div>
    );
}

interface PlanCardProps {
    title: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    icon: any;
    onSelect: () => void;
    highlight?: boolean;
    badge?: string;
}

function PlanCard({
    title,
    price,
    period,
    description,
    features,
    icon: Icon,
    onSelect,
    highlight,
    badge
}: PlanCardProps) {
    return (
        <button
            onClick={onSelect}
            className={`w-full p-6 rounded-xl text-left transition-all hover:scale-[1.02] relative ${highlight
                    ? "border-2 border-blue-600 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg"
                    : "border-2 border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                }`}
        >
            {badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                        {badge}
                    </span>
                </div>
            )}

            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${highlight ? "bg-gradient-to-br from-blue-600 to-purple-600" : "bg-gray-100"
                            }`}>
                            <Icon className={`w-5 h-5 ${highlight ? "text-white" : "text-gray-600"}`} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{description}</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{price}</span>
                        <span className="text-sm text-gray-600">/ {period}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-2.5 mb-4">
                {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                        <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${highlight ? "text-blue-600" : "text-green-600"
                            }`} />
                        <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                ))}
            </div>

            <div className={`text-sm font-semibold text-center py-2 rounded-lg ${highlight
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}>
                Select {title}
            </div>
        </button>
    );
}
