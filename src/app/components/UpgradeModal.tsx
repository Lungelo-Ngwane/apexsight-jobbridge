import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { getActivePlans, startSubscriptionCheckout, type BillingPlan, type BillingPlanName } from "@/lib/employer";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import {
    X,
    Crown,
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
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <Card
                    className="bg-white rounded-xl max-w-lg w-full max-h-[92dvh] shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-5 text-white shrink-0">
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="pr-8">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-3">
                                <Crown className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold leading-tight">
                                Upgrade Your Plan
                            </h2>
                            <p className="text-blue-100 text-sm mt-1.5">
                                Move from <span className="font-semibold text-white capitalize">{plan}</span> to{" "}
                                <span className="font-semibold text-white capitalize">
                                    {(targetPlanDetails?.label ?? targetPlan).toString()}
                                </span>{" "}
                                for more hiring capacity.
                            </p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-5 overflow-y-auto">
                        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 mb-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                Included in your upgrade
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {[
                                    { icon: Zap, title: "More job postings" },
                                    { icon: Users, title: "More applicant access" },
                                    { icon: BarChart3, title: "Advanced analytics" },
                                    { icon: TrendingUp, title: "Priority support" },
                                ].map((feature, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2.5 rounded-md border border-blue-100 bg-white px-2.5 py-2"
                                    >
                                        <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-purple-600 rounded-md flex items-center justify-center shrink-0">
                                            <feature.icon className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <p className="text-xs font-medium text-gray-800">{feature.title}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-lg p-4 mb-4 text-white">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-300">
                                        {(targetPlanDetails?.label ?? targetPlan).toString()} Plan
                                    </p>
                                    <div className="flex items-end gap-1.5 mt-1">
                                        <span className="text-3xl font-bold leading-none">
                                            R{((targetPlanDetails?.priceMonthly ?? 0) / 100).toLocaleString()}
                                        </span>
                                        <span className="text-xs text-gray-300 mb-0.5">/ month</span>
                                    </div>
                                </div>
                                <div className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                                    <TrendingUp className="w-3 h-3" />
                                    Recommended
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5 sticky bottom-0 bg-white pt-2">
                            <Button
                                onClick={handleUpgrade}
                                disabled={loading}
                                className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                            >
                                <Crown className="w-4 h-4 mr-2" />
                                {loading ? "Redirecting..." : "Upgrade Now"}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="h-11 border-gray-300 font-medium"
                            >
                                Maybe Later
                            </Button>
                        </div>

                        <p className="text-center text-xs text-gray-500 mt-3">
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
