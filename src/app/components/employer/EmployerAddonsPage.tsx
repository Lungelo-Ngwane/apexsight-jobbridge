import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import {
  confirmAddonCheckout,
  getAddons,
  getEmployerCredits,
  startAddonCheckout,
  type EmployerAddon,
  type EmployerCreditBalance,
} from "@/lib/employer";

export function EmployerAddonsPage() {
  const navigate = useNavigate();
  const [addons, setAddons] = useState<EmployerAddon[]>([]);
  const [credits, setCredits] = useState<EmployerCreditBalance[]>([]);
  const [buyingAddonId, setBuyingAddonId] = useState<string | null>(null);
  const [verifyingCheckout, setVerifyingCheckout] = useState(false);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  const formatZarFromKobo = (amount: number) =>
    `R ${Math.round(amount / 100).toLocaleString()}`;

  const addonTypeToLabel = (type: string) => {
    const normalized = String(type ?? "").trim().toLowerCase();
    if (normalized === "ai_credit") return "Candidate Matching Credits";
    if (normalized === "ai_report") return "AI Hiring Report";
    if (normalized === "candidate_profile_view" || normalized === "candidate_unlock") {
      return "Unlock Candidate Profile";
    }
    if (normalized === "featured_job") return "Featured Job";
    if (normalized === "job_slot") return "Extra Job Slot";
    if (normalized === "auto_shortlist") return "Auto Shortlisting";
    return String(type ?? "")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const getAddonDescription = (type: string) => {
    const normalized = String(type ?? "").trim().toLowerCase();

    if (normalized === "featured_job") {
      return "Make your job stand out by placing it at the top of candidate feeds. Featured jobs get more visibility and can attract more applications faster.";
    }
    if (normalized === "ai_report") {
      return "Generate a report that highlights the best candidates for your job. It compares applicants, shows how well they match the role, and suggests a shortlist. Once created, you can view the report anytime without using another credit.";
    }
    if (normalized === "ai_credit") {
      return "Quickly identify the best applicants for your job. Use these credits to rank candidates based on how well they match your job requirements and easily spot the top candidates.";
    }
    if (normalized === "candidate_profile_view") {
      return "View the full profile of a candidate after you've used all the profile views included in your monthly plan.";
    }
    if (normalized === "candidate_unlock") {
      return "View the full profile of a candidate after you've used all the profile views included in your monthly plan.";
    }
    if (normalized === "job_slot") {
      return "Post an additional job without upgrading your subscription plan. This credit gives you one extra active job listing.";
    }
    if (normalized === "auto_shortlist") {
      return "Run a one-click shortlist pass on a job. Every applied candidate with a 70% or higher final match score is moved to Shortlisted automatically.";
    }

    return "Top up premium hiring actions on demand when your plan limits are reached.";
  };

  async function loadData() {
    const [addonData, creditData] = await Promise.all([
      getAddons(),
      getEmployerCredits(),
    ]);
    setAddons(addonData);
    setCredits(creditData);
  }

  useEffect(() => {
    loadData().catch((error) => console.error("Failed to load add-on data", error));
  }, []);

  useEffect(() => {
    async function confirmFromCallback() {
      const params = new URLSearchParams(window.location.search);
      const addonSuccess = params.get("addon_success");
      const reference = params.get("reference");
      const returnTo = params.get("return_to");

      if (addonSuccess !== "true" || !reference) return;

      try {
        setVerifyingCheckout(true);
        const result = await confirmAddonCheckout(reference);
        await loadData();
        const creditType = String(result?.creditType ?? "").trim().toLowerCase();
        const creditsAdded = Number(result?.creditsAdded ?? 0);
        const creditText =
          creditsAdded > 0
            ? `${creditsAdded} credit${creditsAdded === 1 ? "" : "s"}`
            : "Credits";

        if (creditType === "featured_job") {
          if (returnTo && returnTo !== "/employer/addons") {
            navigate(returnTo, { replace: true });
            return;
          }
          showFeedback(
            "Featured credits added",
            `${creditText} were added. Go to Jobs and click "Feature Job" on the job you want to promote.`,
          );
        } else if (creditType === "job_slot") {
          if (returnTo && returnTo !== "/employer/addons") {
            navigate(returnTo, { replace: true });
            return;
          }
          showFeedback(
            "Job slot credits added",
            `${creditText} were added. You can now publish more open jobs.`,
          );
        } else if (creditType === "auto_shortlist") {
          if (returnTo && returnTo !== "/employer/addons") {
            navigate(returnTo, { replace: true });
            return;
          }
          showFeedback(
            "Auto-shortlist credits added",
            `${creditText} were added. Go to Jobs and click "Auto Shortlist" on the role you want to process.`,
          );
        } else {
          if (returnTo && returnTo !== "/employer/addons") {
            navigate(returnTo, { replace: true });
            return;
          }
          showFeedback(
            "Purchase successful",
            `${creditText} were added to your account.`,
          );
        }
      } catch (error) {
        console.error("Failed to confirm add-on checkout", error);
        showFeedback(
          "Payment received, credit update pending",
          "We received your payment but couldn't update credits yet. Please contact support.",
        );
      } finally {
        setVerifyingCheckout(false);
        window.history.replaceState({}, "", "/employer/addons");
      }
    }

    confirmFromCallback();
  }, [navigate, showFeedback]);

  async function handleBuyAddon(addonId: string) {
    try {
      setBuyingAddonId(addonId);
      await startAddonCheckout(addonId);
    } catch (error) {
      console.error("Failed to start add-on checkout", error);
      showFeedback(
        "Checkout unavailable",
        "We couldn't start add-on checkout right now. Please try again.",
      );
      setBuyingAddonId(null);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-950/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">Add-ons</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Purchase credits to access additional features and boost your hiring tools whenever you need them.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border-gray-200 p-6 shadow-md dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Store</h3>
              <Badge className="border-blue-200 bg-blue-100 text-blue-700 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-200">
                Pay as you go
              </Badge>
            </div>
            <div className="space-y-3">
              {addons.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No add-ons available right now.</p>
              )}
              {addons.map((addon) => {
                const addonLabel = addonTypeToLabel(addon.type);
                const isAiCredit = String(addon.type ?? "").trim().toLowerCase() === "ai_credit";
                const isRecommendedAiPack = isAiCredit && Number(addon.credits ?? 0) === 250;
                const displayName =
                  isAiCredit
                    ? `${addon.credits} ${addonLabel}`
                    : addon.name || addonLabel;
                return (
                  <div
                    key={addon.id}
                    className={`flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
                      isRecommendedAiPack
                        ? "border-blue-300 bg-blue-50 shadow-sm dark:border-white/15 dark:bg-neutral-900"
                        : "border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-neutral-900"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {displayName}
                        </p>
                        {isRecommendedAiPack ? (
                          <Badge className="border-blue-200 bg-white text-blue-700 dark:border-white/10 dark:bg-neutral-950 dark:text-gray-200">
                            Best Value
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-xl text-xs text-gray-700 dark:text-gray-300">
                        {getAddonDescription(addon.type)}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {addon.credits} credit{addon.credits === 1 ? "" : "s"} • {addonLabel}
                      </p>
                    </div>
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:min-w-[148px] sm:justify-end">
                      <span className="whitespace-nowrap text-right text-lg font-bold leading-none text-gray-900 dark:text-white">
                        {formatZarFromKobo(addon.price)}
                      </span>
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={Boolean(buyingAddonId) || verifyingCheckout}
                        onClick={() => handleBuyAddon(addon.id)}
                      >
                        {buyingAddonId === addon.id ? "Redirecting..." : "Buy"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div>
          <Card className="border-gray-200 p-6 shadow-md dark:border-white/10 dark:bg-neutral-950">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Credit Balances</h3>
            <div className="space-y-3">
              {credits.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No credits purchased yet.</p>
              )}
              {credits.map((credit) => (
                <div key={credit.creditType} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-neutral-900">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{addonTypeToLabel(credit.creditType)}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{credit.remaining}</span>
                </div>
              ))}
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
