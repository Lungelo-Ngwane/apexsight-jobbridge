import { useEffect, useState } from "react";
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
  const [addons, setAddons] = useState<EmployerAddon[]>([]);
  const [credits, setCredits] = useState<EmployerCreditBalance[]>([]);
  const [buyingAddonId, setBuyingAddonId] = useState<string | null>(null);
  const [verifyingCheckout, setVerifyingCheckout] = useState(false);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  const formatZarFromKobo = (amount: number) =>
    `R ${Math.round(amount / 100).toLocaleString()}`;

  const addonTypeToLabel = (type: string) => {
    const normalized = String(type ?? "").trim().toLowerCase();
    if (normalized === "ai_credit") return "AI Matching Credits";
    if (normalized === "ai_report") return "AI Hiring Report";
    if (normalized === "candidate_profile_view" || normalized === "candidate_unlock") {
      return "Candidate Unlock Credits";
    }
    if (normalized === "featured_job") return "Featured Job Credits";
    if (normalized === "job_slot") return "Extra Job Slot Credits";
    return String(type ?? "")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const getAddonDescription = (type: string) => {
    const normalized = String(type ?? "").trim().toLowerCase();

    if (normalized === "featured_job") {
      return "Boost a listing to the top of candidate feeds for stronger visibility and faster applications.";
    }
    if (normalized === "ai_report") {
      return "Generate one recruiter-ready hiring report with role-fit insights, candidate comparisons, and shortlist recommendations.";
    }
    if (normalized === "ai_credit") {
      return "Use AI matching credits to rank applicants, refresh AI match scores, and identify top-fit candidates for your roles.";
    }
    if (normalized === "candidate_profile_view") {
      return "Unlock extra full profile views after your monthly plan allocation is used.";
    }
    if (normalized === "candidate_unlock") {
      return "Unlock extra full profile views after your monthly plan allocation is used.";
    }
    if (normalized === "job_slot") {
      return "Add temporary extra active job slots without changing your subscription plan.";
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
          showFeedback(
            "Featured credits added",
            `${creditText} were added. Go to Jobs and click "Feature Job" on the job you want to promote.`,
          );
        } else if (creditType === "job_slot") {
          showFeedback(
            "Job slot credits added",
            `${creditText} were added. You can now publish more open jobs.`,
          );
        } else {
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
  }, []);

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
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Add-ons</h1>
          <p className="text-sm text-gray-600">
            Buy credits and unlock premium actions on demand
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="p-6 border-gray-200 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Store</h3>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                Pay as you go
              </Badge>
            </div>
            <div className="space-y-3">
              {addons.length === 0 && (
                <p className="text-sm text-gray-500">No add-ons available right now.</p>
              )}
              {addons.map((addon) => {
                const addonLabel = addonTypeToLabel(addon.type);
                const displayName =
                  String(addon.type ?? "").trim().toLowerCase() === "ai_credit"
                    ? `${addon.credits} ${addonLabel}`
                    : addon.name || addonLabel;
                return (
                  <div
                    key={addon.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {displayName}
                      </p>
                      <p className="text-xs text-gray-700 mt-1 max-w-xl">
                        {getAddonDescription(addon.type)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {addon.credits} credit{addon.credits === 1 ? "" : "s"} • {addonLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-900">
                        {formatZarFromKobo(addon.price)}
                      </span>
                      <Button
                        size="sm"
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
          <Card className="p-6 border-gray-200 shadow-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Credit Balances</h3>
            <div className="space-y-3">
              {credits.length === 0 && (
                <p className="text-sm text-gray-500">No credits purchased yet.</p>
              )}
              {credits.map((credit) => (
                <div key={credit.creditType} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{addonTypeToLabel(credit.creditType)}</span>
                  <span className="text-sm font-bold text-gray-900">{credit.remaining}</span>
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
