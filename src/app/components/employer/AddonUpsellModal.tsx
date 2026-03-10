import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { getAddons, startAddonCheckout, type EmployerAddon } from "@/lib/employer";

interface AddonUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addonType: string | null;
  actionLabel: string;
}

function getAddonTypeAliases(type: string | null): string[] {
  const normalized = String(type ?? "").trim().toLowerCase();
  if (!normalized) return [];
  if (normalized === "candidate_unlock") return ["candidate_unlock", "candidate_profile_view"];
  if (normalized === "candidate_profile_view") return ["candidate_profile_view", "candidate_unlock"];
  return [normalized];
}

function prettifyAddonType(type: string) {
  const normalized = String(type ?? "").trim().toLowerCase();
  if (normalized === "ai_credit") return "AI Matching Credits";
  if (normalized === "ai_report") return "AI Hiring Report";
  if (normalized === "candidate_profile_view" || normalized === "candidate_unlock") {
    return "Candidate Unlock Credits";
  }
  if (normalized === "featured_job") return "Featured Job Credits";
  if (normalized === "job_slot") return "Extra Job Slot Credits";
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function addonDescription(type: string) {
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
}

export function AddonUpsellModal({
  open,
  onOpenChange,
  addonType,
  actionLabel,
}: AddonUpsellModalProps) {
  const [addons, setAddons] = useState<EmployerAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    getAddons()
      .then(setAddons)
      .catch((error) => console.error("Failed to load add-ons", error))
      .finally(() => setLoading(false));
  }, [open]);

  const addon = useMemo(() => {
    if (!addonType) return null;
    const aliases = getAddonTypeAliases(addonType);
    return (
      addons.find((item) => aliases.includes(String(item.type ?? "").trim().toLowerCase())) ??
      null
    );
  }, [addonType, addons]);

  const formatZarFromKobo = (amount: number) => `R ${Math.round(amount / 100).toLocaleString()}`;

  async function handleBuy() {
    if (!addon) return;
    try {
      setBuying(true);
      await startAddonCheckout(addon.id);
    } catch (error) {
      console.error("Failed to start add-on checkout", error);
      setBuying(false);
      showFeedback(
        "Checkout unavailable",
        "We couldn't start add-on checkout right now. Please try again.",
      );
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add-on Required</DialogTitle>
            <DialogDescription>
              To {actionLabel}, you need{" "}
              <strong>{addonType ? prettifyAddonType(addonType) : "an add-on"}</strong> credits.
            </DialogDescription>
          </DialogHeader>

          {loading && <CircularLoader size="sm" label="Loading add-on details..." />}

          {!loading && addon && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">{addon.name}</p>
              <p className="text-xs text-gray-600 mt-1">
                {addon.credits} credit{addon.credits === 1 ? "" : "s"} • {prettifyAddonType(addon.type)}
              </p>
              <p className="text-xs text-gray-700 mt-2">{addonDescription(addon.type)}</p>
              <p className="text-sm font-bold text-gray-900 mt-2">{formatZarFromKobo(addon.price)}</p>
            </div>
          )}

          {!loading && !addon && (
            <p className="text-sm text-red-600">
              No matching add-on is configured for this action yet.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Maybe later
            </Button>
            <Button onClick={handleBuy} disabled={!addon || buying}>
              {buying ? "Redirecting..." : "Buy Add-on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FeedbackDialog
        open={feedback.open}
        title={feedback.title}
        description={feedback.description}
        onOpenChange={setFeedbackOpen}
      />
    </>
  );
}
