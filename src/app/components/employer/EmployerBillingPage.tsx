import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  cancelSubscription,
  confirmSubscriptionCheckout,
  getBillingInvoiceDownloadUrl,
  getBillingInvoices,
  getActivePlans,
  getEmployerUsageSnapshot,
  startSubscriptionCheckout,
  type BillingInvoice,
  type BillingPlan,
  type BillingPlanName,
  type EmployerUsageSnapshot,
} from "@/lib/employer";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import { 
  CreditCard,
  Crown,
  Zap,
  CheckCircle,
  AlertCircle,
  Calendar,
  Download,
  FileText,
  Building2,
  Users,
  Briefcase
} from "lucide-react";
import { Progress } from "@/app/components/ui/progress";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";

export function EmployerBillingPage() {
  const navigate = useNavigate();
  const { profile } = useEmployerProfile();
  const [loadingSource, setLoadingSource] = useState<
    "header" | "card" | "sidebar" | null
  >(null);
  const [verifyingCheckout, setVerifyingCheckout] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [usageSnapshot, setUsageSnapshot] = useState<EmployerUsageSnapshot | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  useEffect(() => {
    getActivePlans()
      .then(setPlans)
      .catch((error) => console.error("Failed to load plans", error));
  }, []);

  useEffect(() => {
    getEmployerUsageSnapshot()
      .then(setUsageSnapshot)
      .catch((error) => console.error("Failed to load usage snapshot", error));
  }, []);

  useEffect(() => {
    function handleCandidateViewConsumed(event: Event) {
      const custom = event as CustomEvent<{
        candidateViewsUsedThisMonth?: number;
        candidateViewLimit?: number | null;
      }>;
      const used = Number(custom.detail?.candidateViewsUsedThisMonth ?? NaN);
      const limit = custom.detail?.candidateViewLimit;

      if (Number.isFinite(used)) {
        setUsageSnapshot((prev) =>
          prev
            ? {
                ...prev,
                candidateViewsUsedThisMonth: used,
                candidateViewLimit:
                  limit === undefined ? prev.candidateViewLimit : limit,
              }
            : prev,
        );
      } else {
        getEmployerUsageSnapshot()
          .then(setUsageSnapshot)
          .catch((error) => console.error("Failed to refresh usage snapshot", error));
      }
    }

    window.addEventListener("candidate-view-consumed", handleCandidateViewConsumed);
    return () => {
      window.removeEventListener("candidate-view-consumed", handleCandidateViewConsumed);
    };
  }, []);

  useEffect(() => {
    async function loadInvoices() {
      try {
        setLoadingInvoices(true);
        const rows = await getBillingInvoices(20);
        setInvoices(rows);
      } catch (error) {
        console.error("Failed to load invoices", error);
      } finally {
        setLoadingInvoices(false);
      }
    }

    loadInvoices();
  }, []);

  useEffect(() => {
    async function confirmFromCallback() {
      const params = new URLSearchParams(window.location.search);
      const success = params.get("success");
      const reference = params.get("reference");

      if (!reference) return;

      if (success === "true") {
        try {
          setVerifyingCheckout(true);
          await confirmSubscriptionCheckout(reference);
          showFeedback("Plan upgraded", "Your subscription has been upgraded successfully.");
        } catch (error) {
          console.error("Failed to confirm subscription", error);
          showFeedback(
            "Payment received, update pending",
            "We received your payment, but the plan update is still pending. Please contact support.",
          );
        } finally {
          setVerifyingCheckout(false);
          window.history.replaceState({}, "", "/employer/billing");
        }
      }

    }

    confirmFromCallback();
  }, []);

  async function handleUpgrade(
    plan: BillingPlanName,
    planId: string | undefined,
    source: "header" | "card" | "sidebar",
  ) {
    try {
      setLoadingSource(source);
      await startSubscriptionCheckout(plan, planId);
    } catch (error) {
      console.error("Failed to start checkout", error);
      showFeedback(
        "Checkout unavailable",
        "We couldn't start checkout right now. Please try again.",
      );
      setLoadingSource(null);
    }
  }

  async function handleCancelSubscription() {
    try {
      setCancellingSubscription(true);
      await cancelSubscription();
      showFeedback(
        "Subscription cancelled",
        "Your subscription was cancelled and your account is now on the Free plan.",
      );
    } catch (error) {
      console.error("Failed to cancel subscription", error);
      showFeedback(
        "Cancellation failed",
        "We couldn't cancel your subscription right now. Please try again.",
      );
    } finally {
      setCancellingSubscription(false);
    }
  }

  const formatZarFromKobo = (amount: number) => `R ${Math.round(amount / 100).toLocaleString()}`;
  const formatInvoiceDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  async function handleDownloadInvoice(invoiceId: string) {
    try {
      setDownloadingInvoiceId(invoiceId);
      const url = await getBillingInvoiceDownloadUrl(invoiceId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't download this invoice right now.";
      showFeedback("Invoice download failed", message);
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  const currentPlanName = String(profile?.plan ?? "free").toLowerCase();
  const selectedPlanRaw = String((profile as { selected_plan?: string | null } | null)?.selected_plan ?? "").toLowerCase();
  const selectedPendingPlan: BillingPlanName | null =
    selectedPlanRaw === "starter" || selectedPlanRaw === "professional" || selectedPlanRaw === "enterprise"
      ? selectedPlanRaw
      : null;
  const isFreePlan = currentPlanName === "free";
  const currentPlanRow =
    plans.find((p) => p.name === currentPlanName) ??
    (isFreePlan ? null : plans.find((p) => p.name === "starter")) ??
    null;

  const normalizedSubscriptionStatus = String(
    profile?.subscription_status ?? (isFreePlan ? "free" : "inactive"),
  ).toLowerCase();
  const hasPendingPayment =
    normalizedSubscriptionStatus === "pending_payment" && selectedPendingPlan !== null;

  const nextUpgradePlan = useMemo((): BillingPlanName | null => {
    if (hasPendingPayment && selectedPendingPlan) return selectedPendingPlan;
    if (currentPlanName === "free") return "starter";
    if (currentPlanName === "starter") return "professional";
    if (currentPlanName === "professional") return "enterprise";
    return null;
  }, [currentPlanName, hasPendingPayment, selectedPendingPlan]);

  const nextUpgradeLabel = nextUpgradePlan
    ? `${nextUpgradePlan.charAt(0).toUpperCase()}${nextUpgradePlan.slice(1)}`
    : null;
  const nextUpgradePlanRow = nextUpgradePlan
    ? plans.find((p) => p.name === nextUpgradePlan)
    : null;
  const latestPaidInvoice = useMemo(
    () => invoices.find((invoice) => invoice.status === "paid") ?? null,
    [invoices],
  );
  const paymentCustomerCode = String((profile as { paystack_customer_code?: string | null } | null)?.paystack_customer_code ?? "").trim();

  const totalKobo = currentPlanRow?.priceMonthly ?? 0;
  const vatKobo = Math.round(totalKobo * 0.15);
  const subscriptionKobo = totalKobo - vatKobo;
  const formatLimit = (value: number | null) => (value === null ? "Unlimited" : String(value));
  const activeJobsUsed = Number(usageSnapshot?.activeJobs ?? 0);
  const jobLimit = usageSnapshot?.jobLimit ?? currentPlanRow?.jobLimit ?? (isFreePlan ? 1 : null);
  const teamMembersUsed = Number(usageSnapshot?.teamMembersUsed ?? 0);
  const teamMemberLimit = usageSnapshot?.teamMemberLimit ?? currentPlanRow?.userLimit ?? (isFreePlan ? 1 : null);
  const nextBillingDate = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "No active subscription";
  const subscriptionStatusLabel =
    normalizedSubscriptionStatus.charAt(0).toUpperCase() + normalizedSubscriptionStatus.slice(1);

  const currentPlan = isFreePlan
    ? {
        name: "Free",
        price: "R 0",
        period: "per month",
        icon: Zap,
        features: [
          `${formatLimit(jobLimit)} active job posting${jobLimit === 1 ? "" : "s"}`,
          `${usageSnapshot?.candidateViewLimit ?? 10} candidate views/month`,
          "Basic dashboard",
          "Community support",
          `${formatLimit(teamMemberLimit)} team member${teamMemberLimit === 1 ? "" : "s"}`,
        ],
        usage: {
          jobs: { used: activeJobsUsed, total: jobLimit },
          users: { used: teamMembersUsed, total: teamMemberLimit },
        },
        renewalDate: nextBillingDate,
        status: subscriptionStatusLabel,
      }
    : {
        name: currentPlanRow?.label ?? "Starter",
        price: currentPlanRow ? formatZarFromKobo(currentPlanRow.priceMonthly) : "R 999",
        period: "per month",
        icon: Zap,
        features: [
          `${formatLimit(jobLimit)} active job posting${jobLimit === 1 ? "" : "s"}`,
          `${usageSnapshot?.candidateViewLimit ?? currentPlanRow?.candidateViewLimit ?? 50} candidate views/month`,
          "Advanced analytics",
          "Priority support",
          `Team collaboration (${formatLimit(teamMemberLimit)} user${teamMemberLimit === 1 ? "" : "s"})`,
        ],
        usage: {
          jobs: { used: activeJobsUsed, total: jobLimit },
          users: { used: teamMembersUsed, total: teamMemberLimit },
        },
        renewalDate: nextBillingDate,
        status: subscriptionStatusLabel,
      };

  const finiteJobLimit = typeof currentPlan.usage.jobs.total === "number" ? currentPlan.usage.jobs.total : null;
  const finiteTeamLimit = typeof currentPlan.usage.users.total === "number" ? currentPlan.usage.users.total : null;
  const jobUsagePercent = finiteJobLimit && finiteJobLimit > 0
    ? Math.round((currentPlan.usage.jobs.used / finiteJobLimit) * 100)
    : 0;
  const isOverJobLimit = Boolean(
    finiteJobLimit !== null && currentPlan.usage.jobs.used > finiteJobLimit,
  );
  const jobsOverLimit = finiteJobLimit !== null
    ? Math.max(currentPlan.usage.jobs.used - finiteJobLimit, 0)
    : 0;
  const showUsageAlert = Boolean(finiteJobLimit && finiteJobLimit > 0 && jobUsagePercent >= 80);

  const availablePlans = [
    {
      name: "Starter",
      icon: Building2,
      price: formatZarFromKobo(plans.find((p) => p.name === "starter")?.priceMonthly ?? 99900),
      period: "per month",
      description: "Perfect for small businesses",
      features: [
        `${plans.find((p) => p.name === "starter")?.jobLimit ?? 2} active job postings`,
        `${plans.find((p) => p.name === "starter")?.candidateViewLimit ?? 50} candidate views/month`,
        "Basic analytics",
        "Email support",
        `${plans.find((p) => p.name === "starter")?.userLimit ?? 2} users`,
      ],
      color: "from-gray-500 to-gray-600"
    },
    {
      name: "Professional",
      icon: Zap,
      price: formatZarFromKobo(plans.find((p) => p.name === "professional")?.priceMonthly ?? 299900),
      period: "per month",
      description: "Most popular for growing teams",
      features: [
        `${plans.find((p) => p.name === "professional")?.jobLimit ?? 3} active job postings`,
        `${plans.find((p) => p.name === "professional")?.candidateViewLimit ?? 300} candidate views/month`,
        "Advanced analytics",
        "Priority support",
        `Team collaboration (${plans.find((p) => p.name === "professional")?.userLimit ?? 5} users)`,
      ],
      color: "from-blue-500 to-blue-600",
      current: true,
      popular: true
    },
    {
      name: "Enterprise",
      icon: Crown,
      price: formatZarFromKobo(plans.find((p) => p.name === "enterprise")?.priceMonthly ?? 999900),
      period: "per month",
      description: "For large organizations",
      features: [
        `${plans.find((p) => p.name === "enterprise")?.jobLimit ?? 4} active job postings`,
        `${plans.find((p) => p.name === "enterprise")?.candidateViewLimit ?? 9999} candidate views/month`,
        "Custom analytics & reporting",
        "Dedicated account manager",
        `${plans.find((p) => p.name === "enterprise")?.userLimit ?? 50} users`,
        "API access",
        "Custom integrations"
      ],
      color: "from-purple-500 to-purple-600"
    }
  ];

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-emerald-50/20 to-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Billing & Subscription</h1>
              <p className="text-sm text-gray-600">Manage your plan and billing</p>
            </div>
            <Button 
              onClick={() =>
                nextUpgradePlan &&
                handleUpgrade(nextUpgradePlan, nextUpgradePlanRow?.id, "header")
              }
              disabled={loadingSource !== null || verifyingCheckout || !nextUpgradePlan}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30"
            >
              <Crown className="w-4 h-4 mr-2" />
              {loadingSource === "header"
                ? "Redirecting..."
                : hasPendingPayment
                  ? (nextUpgradeLabel ? `Complete Payment for ${nextUpgradeLabel}` : "Complete Payment")
                  : (nextUpgradeLabel ? `Upgrade to ${nextUpgradeLabel}` : "Current Top Plan")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {hasPendingPayment && (
          <Card className="mb-6 border-amber-200 bg-amber-50 shadow-md">
            <div className="p-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-amber-900 mb-1">Payment required to activate your plan</h2>
                <p className="text-sm text-amber-800">
                  You selected the {nextUpgradeLabel ?? "paid"} plan. Complete checkout to unlock premium features.
                </p>
              </div>
              <Button
                onClick={() =>
                  nextUpgradePlan &&
                  handleUpgrade(nextUpgradePlan, nextUpgradePlanRow?.id, "header")
                }
                disabled={loadingSource !== null || verifyingCheckout || !nextUpgradePlan}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {loadingSource === "header" ? "Redirecting..." : "Complete Payment"}
              </Button>
            </div>
          </Card>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Current Plan */}
            <Card className="relative overflow-hidden border-0 shadow-xl shadow-blue-200/50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-[0.08]" />
              <div className="relative p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <currentPlan.icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-gray-900">{currentPlan.name} Plan</h2>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          {currentPlan.status}
                        </Badge>
                      </div>
                      <p className="text-gray-600">
                        <span className="text-2xl font-bold text-gray-900">{currentPlan.price}</span>
                        <span className="text-sm ml-2">{currentPlan.period}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Jobs Usage */}
                  <div className="p-4 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Job Postings</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {currentPlan.usage.jobs.used} / {formatLimit(currentPlan.usage.jobs.total)}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, jobUsagePercent)}
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {finiteJobLimit === null
                        ? "Unlimited slots"
                        : isOverJobLimit
                          ? `${jobsOverLimit} job posting${jobsOverLimit === 1 ? "" : "s"} above plan limit`
                          : `${Math.max(finiteJobLimit - currentPlan.usage.jobs.used, 0)} slots remaining`}
                    </p>
                  </div>

                  {/* Users Usage */}
                  <div className="p-4 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">Team Members</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {currentPlan.usage.users.used} / {formatLimit(currentPlan.usage.users.total)}
                      </span>
                    </div>
                    <Progress 
                      value={
                        finiteTeamLimit && finiteTeamLimit > 0
                          ? Math.min(100, Math.round((currentPlan.usage.users.used / finiteTeamLimit) * 100))
                          : 0
                      }
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {finiteTeamLimit === null
                        ? "Unlimited seats"
                        : `${Math.max(finiteTeamLimit - currentPlan.usage.users.used, 0)} seats available`}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Next billing date</p>
                      <p className="text-sm text-gray-600">{currentPlan.renewalDate}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">Plan includes:</p>
                  {currentPlan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() =>
                      nextUpgradePlan &&
                      handleUpgrade(nextUpgradePlan, nextUpgradePlanRow?.id, "card")
                    }
                    disabled={loadingSource !== null || verifyingCheckout || !nextUpgradePlan}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {loadingSource === "card"
                      ? "Redirecting..."
                      : hasPendingPayment
                        ? "Complete Payment"
                        : (nextUpgradeLabel ? `Upgrade to ${nextUpgradeLabel}` : "Current Top Plan")}
                  </Button>
                  <Button variant="outline" className="border-gray-300">
                    Change Plan
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={loadingSource !== null || verifyingCheckout || cancellingSubscription}
                  >
                    {cancellingSubscription ? "Cancelling..." : "Cancel Subscription"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Payment Source */}
            <Card className="p-6 border-gray-200 shadow-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Source</h3>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center shadow-md">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Provider: Paystack</p>
                  {paymentCustomerCode ? (
                    <p className="text-sm text-gray-600">
                      Customer ID: {paymentCustomerCode}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Customer ID will appear after first successful payment.
                    </p>
                  )}
                  {loadingInvoices ? (
                    <div className="mt-1">
                      <CircularLoader size="sm" label="Loading payment history..." />
                    </div>
                  ) : latestPaidInvoice ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Last successful charge: {formatZarFromKobo(latestPaidInvoice.totalKobo)} on{" "}
                      {formatInvoiceDate(latestPaidInvoice.paidAt ?? latestPaidInvoice.issuedAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      No successful payments recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-6 border-gray-200 shadow-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Invoices</h3>
              {loadingInvoices ? (
                <CircularLoader size="sm" label="Loading invoices..." />
              ) : invoices.length === 0 ? (
                <p className="text-sm text-gray-600">No invoices yet. Paid invoices will appear here.</p>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-gray-600">
                            {formatInvoiceDate(invoice.issuedAt)} • {invoice.kind}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{formatZarFromKobo(invoice.totalKobo)}</p>
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs border-emerald-200">
                            {invoice.status}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!invoice.hasDownload || downloadingInvoiceId === invoice.id}
                          onClick={() => handleDownloadInvoice(invoice.id)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Billing Summary */}
            <Card className="p-6 border-gray-200 shadow-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Billing Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Subscription</span>
                  <span className="text-sm font-bold text-gray-900">{formatZarFromKobo(subscriptionKobo)}</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Tax (VAT 15%)</span>
                  <span className="text-sm font-bold text-gray-900">{formatZarFromKobo(vatKobo)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">{formatZarFromKobo(totalKobo)}</span>
                </div>
              </div>
            </Card>
            {/* Usage Alert */}
            {showUsageAlert && (
              <Card className="p-5 bg-amber-50 border-amber-200 shadow-md">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-1">
                      {isOverJobLimit ? "Over Job Limit" : "Approaching Limit"}
                    </h4>
                    <p className="text-xs text-gray-700 mb-3">
                      {isOverJobLimit
                        ? `You are using ${jobUsagePercent}% of your job posting slots. Close at least ${jobsOverLimit} active job posting${jobsOverLimit === 1 ? "" : "s"} to stay on this plan, or upgrade.`
                        : `You are using ${jobUsagePercent}% of your job posting slots. Consider upgrading to avoid disruption.`}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("/employer/jobs")}
                        className="border-amber-300 bg-white hover:bg-amber-100"
                      >
                        Manage Jobs
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          nextUpgradePlan &&
                          handleUpgrade(nextUpgradePlan, nextUpgradePlanRow?.id, "sidebar")
                        }
                        disabled={loadingSource !== null || verifyingCheckout || !nextUpgradePlan}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                      >
                        {loadingSource === "sidebar"
                          ? "Redirecting..."
                          : hasPendingPayment
                            ? "Complete Payment"
                            : "Upgrade Now"}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Stats */}
            {/* <Card className="p-6 border-gray-200 shadow-md">
              <h3 className="text-sm font-bold text-gray-700 mb-4">This Month</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-600">Jobs Posted</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm text-gray-600">Candidates Viewed</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">342</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-600">Analytics Views</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">87</span>
                </div>
              </div>
            </Card> */}

            {/* Need Help */}
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 shadow-md">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-xs text-gray-600 mb-4">
                Have questions about your billing or need to discuss custom plans?
              </p>
              <Button 
                variant="outline" 
                className="w-full border-gray-300 bg-white hover:bg-gray-50"
              >
                Contact Support
              </Button>
            </Card>
          </div>
        </div>
      </div>
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your plan will be downgraded to Free. You can re-upgrade anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowCancelConfirm(false);
                await handleCancelSubscription();
              }}
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <FeedbackDialog
        open={feedback.open}
        title={feedback.title}
        description={feedback.description}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
}
