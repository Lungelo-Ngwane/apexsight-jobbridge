import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { getActivePlans, startSubscriptionCheckout, type BillingPlan, type BillingPlanName } from "@/lib/employer";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import {
    X,
    Crown,
    CheckCircle2,
    TrendingUp,
    Zap,
    BarChart3,
    Users,
    Sparkles
} from "lucide-react";

interface UpgradeModalProps {
    plan: string;
    onClose: () => void;
}

export function UpgradeModal({ plan, onClose }: UpgradeModalProps) {
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState<BillingPlan[]>([]);
    const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

    const targetPlan = useMemo((): BillingPlanName => {
        const normalizedPlan = plan.toLowerCase();
        if (normalizedPlan === "free") return "starter";
        if (normalizedPlan === "starter") return "professional";
        return "enterprise";
    }, [plan]);

    const targetPlanDetails = useMemo(
        () => plans.find((p) => p.name === targetPlan),
        [plans, targetPlan],
    );

    useEffect(() => {
        getActivePlans()
            .then(setPlans)
            .catch((error) => console.error("Failed to load plans", error));
    }, []);

    async function handleUpgrade() {
        try {
            setLoading(true);
            await startSubscriptionCheckout(targetPlan, targetPlanDetails?.id);
        } catch (error) {
            console.error("Failed to start checkout", error);
            showFeedback(
                "Checkout unavailable",
                "We couldn't start checkout right now. Please try again in a moment.",
            );
            setLoading(false);
        }
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60  backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <Card
                    className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border-0 overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                {/* Header with gradient */}
                <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 p-8 text-white overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="relative">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
                            <Crown className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">
                            Unlock More Potential
                        </h2>
                        <p className="text-blue-100 text-lg">
                            Your <span className="font-semibold text-white capitalize">{plan}</span> plan has limits. Upgrade to access more features and grow your hiring.
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                            What you'll get with an upgrade:
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                {
                                    icon: Zap,
                                    title: "Unlimited Job Postings",
                                    description: "Post as many jobs as you need"
                                },
                                {
                                    icon: Users,
                                    title: "Unlimited Applicants",
                                    description: "No cap on candidate applications"
                                },
                                {
                                    icon: BarChart3,
                                    title: "Advanced Analytics",
                                    description: "Track hiring metrics & insights"
                                },
                                {
                                    icon: TrendingUp,
                                    title: "Priority Support",
                                    description: "Get help when you need it"
                                }
                            ].map((feature, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-3 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100"
                                >
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <feature.icon className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 text-sm mb-1">
                                            {feature.title}
                                        </h4>
                                        <p className="text-xs text-gray-600">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pricing highlight */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 mb-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium text-blue-100 mb-1">
                                    {(targetPlanDetails?.label ?? targetPlan).toString()} Plan
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold">
                                        R{((targetPlanDetails?.priceMonthly ?? 0) / 100).toLocaleString()}
                                    </span>
                                    <span className="text-blue-100">/ month</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-semibold">
                                    <TrendingUp className="w-4 h-4" />
                                    Most Popular
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            onClick={handleUpgrade}
                            disabled={loading}
                            className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                        >
                            <Crown className="w-5 h-5 mr-2" />
                            {loading ? "Redirecting..." : "Upgrade Now"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="h-12 border-2 border-gray-300 hover:bg-gray-50 font-semibold"
                        >
                            Maybe Later
                        </Button>
                    </div>

                    <p className="text-center text-sm text-gray-500 mt-4">
                        Cancel anytime. No hidden fees.
                    </p>
                </div>
                </Card>
            </div>
            <FeedbackDialog
                open={feedback.open}
                title={feedback.title}
                description={feedback.description}
                onOpenChange={setFeedbackOpen}
            />
        </>
    );
}
