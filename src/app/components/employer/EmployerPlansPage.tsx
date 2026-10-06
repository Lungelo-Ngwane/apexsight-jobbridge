import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { FeedbackDialog,useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import {
getActivePlans,
getEmployerUsageSnapshot,
startSubscriptionCheckout,
type BillingPlan,
type BillingPlanName,
type EmployerUsageSnapshot,
} from "@/lib/employer";
import { hasEmployerPaidAccess } from "@/lib/subscriptionAccess";
import {
ArrowRight,
Briefcase,
Building2,
CheckCircle2,
Crown,
ShieldCheck,
Sparkles,
Star,
Users,
Zap,
} from "lucide-react";
import { useEffect,useMemo,useState } from "react";

type PlanCardConfig = {
  name: "free" | BillingPlanName;
  label: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  icon: typeof Briefcase;
  accent: string;
  popular?: boolean;
};

export function EmployerPlansPage() {
  const { profile } = useEmployerProfile();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [usageSnapshot, setUsageSnapshot] = useState<EmployerUsageSnapshot | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<BillingPlanName | null>(null);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  useEffect(() => {
    getActivePlans()
      .then(setPlans)
      .catch((error) => console.error("Failed to load plans", error));

    getEmployerUsageSnapshot()
      .then(setUsageSnapshot)
      .catch((error) => console.error("Failed to load usage snapshot", error));
  }, []);

  const currentPlanName = String(profile?.plan ?? "free").toLowerCase();
  const hasPaidPlan = hasEmployerPaidAccess(profile);

  const planRows = useMemo(() => {
    const starter = plans.find((plan) => plan.name === "starter");
    const professional = plans.find((plan) => plan.name === "professional");
    const enterprise = plans.find((plan) => plan.name === "enterprise");

    const formatZar = (amount: number) => `R${Math.round(amount / 100).toLocaleString()}`;

    const rows: PlanCardConfig[] = [
      {
        name: "free",
        label: "Free",
        price: "R0",
        period: "forever",
        description: "For employers getting started with structured hiring.",
        features: [
          "1 active job posting",
          "Up to 10 applicants per job",
          "Basic candidate filtering",
          "AI-ready structured job setup",
          "Automatic job embeddings",
          "Email support",
        ],
        icon: Briefcase,
        accent: "from-slate-100 to-white",
      },
      {
        name: "starter",
        label: "Starter",
        price: formatZar(starter?.priceMonthly ?? 99900),
        period: "per month",
        description: "For small teams hiring consistently with better visibility and structure.",
        features: [
          `${starter?.jobLimit ?? 2} active job postings`,
          `${starter?.candidateViewLimit ?? 50} candidate views per month`,
          "Automatic job embeddings",
          "AI-assisted job skill extraction",
          "Basic analytics",
          "Email support",
          `${starter?.userLimit ?? 2} team users`,
        ],
        icon: Zap,
        accent: "from-blue-50 to-white",
      },
      {
        name: "professional",
        label: "Professional",
        price: formatZar(professional?.priceMonthly ?? 299900),
        period: "per month",
        description: "Best for growing hiring teams that need AI-assisted workflows and more capacity.",
        features: [
          `${professional?.jobLimit ?? 3} active job postings`,
          `${professional?.candidateViewLimit ?? 300} candidate views per month`,
          "AI candidate scoring and match explanations",
          "AI hiring reports",
          "Advanced skill matching",
          "Priority support",
          `${professional?.userLimit ?? 5} team users`,
        ],
        icon: Sparkles,
        accent: "from-blue-600/10 to-cyan-500/10",
        popular: true,
      },
      {
        name: "enterprise",
        label: "Enterprise",
        price: formatZar(enterprise?.priceMonthly ?? 999900),
        period: "per month",
        description: "For larger organizations that need scale, control, and dedicated support.",
        features: [
          `${enterprise?.jobLimit ?? 4} active job postings`,
          `${enterprise?.candidateViewLimit ?? 9999} candidate views per month`,
          "AI candidate scoring and match explanations",
          "AI hiring reports",
          "Enterprise AI workflows and auto-shortlisting",
          `${enterprise?.userLimit ?? 50} team users`,
          "Dedicated account manager",
          "White-label options",
          "SLA guarantee",
        ],
        icon: Crown,
        accent: "from-violet-50 to-white",
      },
    ];

    return rows;
  }, [plans]);

  const currentPlanCard = planRows.find((plan) => plan.name === currentPlanName) ?? planRows[0];

  const activeJobs = Number(usageSnapshot?.activeJobs ?? 0);
  const jobLimit = usageSnapshot?.jobLimit;
  const candidateViewsUsed = Number(usageSnapshot?.candidateViewsUsedThisMonth ?? 0);
  const candidateViewLimit = usageSnapshot?.candidateViewLimit;

  async function handleUpgrade(planName: BillingPlanName) {
      try {
        setLoadingPlan(planName);
        const planId = plans.find((plan) => plan.name === planName)?.id;
        await startSubscriptionCheckout(planName, planId);
    } catch (error) {
      console.error("Failed to start plan checkout", error);
      showFeedback(
        "Checkout unavailable",
        "We couldn't start the plan upgrade right now. Please try again.",
      );
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-950/90">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plans</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Compare subscriptions, understand your limits, and upgrade when you need more hiring capacity.
              </p>
            </div>
            <Badge className="w-fit border-blue-200 bg-blue-100 text-blue-700 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-200">
              Current plan: {currentPlanCard.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 xl:grid-cols-[minmax(0,1.45fr)_320px]">
        <div className="space-y-8">
          <Card className="overflow-hidden border-gray-200 shadow-md dark:border-white/10 dark:bg-neutral-950">
            <div className="border-b border-gray-200 bg-slate-950 px-6 py-5 text-white dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Subscription guide</p>
              <h2 className="mt-2 text-2xl font-semibold">Choose the hiring plan that matches your team</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Free gets you started. Paid plans unlock more job capacity, candidate visibility, team access, and stronger recruiting workflows. Add-ons extend capacity further when you need extra power without switching plans immediately.
              </p>
            </div>
            <div className="grid gap-5 p-6 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              {planRows.map((plan) => {
                const isCurrent = currentPlanName === plan.name;
                return (
                  <div
                    key={plan.name}
                    className={`relative flex min-h-[520px] flex-col rounded-3xl border p-5 shadow-sm ${
                      isCurrent
                        ? "border-blue-300 bg-blue-50 dark:border-white/15 dark:bg-neutral-900"
                        : "border-gray-200 bg-white dark:border-white/10 dark:bg-neutral-950"
                    }`}
                  >
                    {plan.popular ? (
                      <Badge className="absolute right-4 top-4 border-blue-200 bg-white text-blue-700 dark:border-white/15 dark:bg-neutral-900 dark:text-gray-200">
                        Most Popular
                      </Badge>
                    ) : null}
                    {isCurrent ? (
                      <Badge className="mb-4 border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Current Plan
                      </Badge>
                    ) : (
                      <div className="mb-10" />
                    )}
                    <div className={`inline-flex rounded-2xl bg-gradient-to-br ${plan.accent} p-3 dark:bg-neutral-800 dark:bg-none`}>
                      <plan.icon className="h-6 w-6 text-slate-900 dark:text-white" />
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">{plan.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{plan.description}</p>
                    <div className="mt-5 flex items-end gap-2">
                      <span className="text-4xl font-bold tracking-[-0.04em] text-gray-900 dark:text-white">{plan.price}</span>
                      <span className="pb-1 text-sm text-gray-500 dark:text-gray-400">/ {plan.period}</span>
                    </div>
                    <div className="mt-5 space-y-3">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                          <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{feature}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto pt-6">
                      {isCurrent ? (
                        <Button variant="outline" className="w-full border-gray-300 dark:border-white/15 dark:bg-neutral-900 dark:text-gray-200" disabled>
                          Current Plan
                        </Button>
                      ) : plan.name === "free" ? (
                        <Button variant="outline" className="w-full border-gray-300 dark:border-white/15 dark:bg-neutral-900 dark:text-gray-200" disabled={hasPaidPlan}>
                          Free baseline
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-slate-950 text-white hover:bg-slate-800"
                          disabled={loadingPlan !== null && loadingPlan !== plan.name}
                          onClick={() => {
                            if (plan.name === "free") return;
                            void handleUpgrade(plan.name);
                          }}
                        >
                          {loadingPlan === plan.name ? "Redirecting..." : `Upgrade to ${plan.label}`}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="border-gray-200 p-6 shadow-md dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-700 dark:bg-neutral-900 dark:text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upgrade options explained</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Subscription plans set your baseline capacity. Add-ons extend that capacity when you need more flexibility.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-neutral-900">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">Subscriptions</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Best for predictable monthly hiring. Plans control active job slots, candidate views, support level, and team scale.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-neutral-900">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">Add-ons</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Use add-ons when you need extra AI matching credits, AI hiring reports, featured listings, or extra job slots without changing your core plan.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-neutral-900">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">Best path</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Upgrade your subscription when growth is ongoing. Buy add-ons when the spike is temporary or feature-specific.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-gray-200 p-6 shadow-md dark:border-white/10 dark:bg-neutral-950">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your current plan</h2>
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-white/10 dark:bg-neutral-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-gray-300">Active subscription</p>
                  <h3 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{currentPlanCard.label}</h3>
                </div>
                <Star className="h-6 w-6 text-blue-700 dark:text-gray-300" />
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                {currentPlanName === "free"
                  ? "You are on the Free plan. Upgrade when you need more active jobs, candidate views, or team capacity."
                  : "Your current subscription is active. Upgrade when your hiring volume or team complexity grows."}
              </p>
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-blue-600 dark:text-gray-300" />
                  <span className="text-gray-600 dark:text-gray-300">Active jobs</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {activeJobs} / {jobLimit === null ? "Unlimited" : jobLimit}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-violet-600 dark:text-gray-300" />
                  <span className="text-gray-600 dark:text-gray-300">Candidate views this month</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {candidateViewsUsed} / {candidateViewLimit === null ? "Unlimited" : candidateViewLimit}
                </span>
              </div>
            </div>
          </Card>

          <Card className="border-gray-200 p-6 shadow-md dark:border-white/10 dark:bg-neutral-950">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Need more flexibility?</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
              If you are not ready for a full plan change, you can still expand your hiring workflow with add-ons for AI credits, AI reports, featured jobs, and extra job slots.
            </p>
            <Button
              variant="outline"
              className="mt-5 w-full border-gray-300 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
              onClick={() => (window.location.href = "/employer/addons")}
            >
              View Add-ons
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Card>

          <Card className="border-gray-200 bg-slate-950 p-6 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Plan guidance</h2>
                <p className="text-sm text-slate-300">How to think about upgrading</p>
              </div>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-200">
              <p>
                <span className="font-semibold text-white">Starter</span> is the right move when Free starts blocking job volume or candidate review.
              </p>
              <p>
                <span className="font-semibold text-white">Professional</span> is best once AI-assisted recruiting and team collaboration become part of your normal workflow.
              </p>
              <p>
                <span className="font-semibold text-white">Enterprise</span> is for high-volume hiring teams that need custom support, scale, and integration flexibility.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <FeedbackDialog
        open={feedback.open}
        title={feedback.title}
        description={feedback.description}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
}
