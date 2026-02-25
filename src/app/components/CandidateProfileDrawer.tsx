import { useEffect, useState } from "react";
import { getCandidateDeepView, getEmployerCredits, type EmployerCreditBalance } from "../../lib/employer";
import { Badge } from "./ui/badge";
import { Button } from "@/app/components/ui/button";
import { X } from "lucide-react";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import { AddonUpsellModal } from "./employer/AddonUpsellModal";
import { UpgradeModal } from "./UpgradeModal";

export function CandidateProfileDrawer({
  applicationId,
  onClose
}: {
  applicationId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const { profile } = useEmployerProfile();
  const [credits, setCredits] = useState<EmployerCreditBalance[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [showAiCreditUpsell, setShowAiCreditUpsell] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    getCandidateDeepView(applicationId).then(setData);
  }, [applicationId]);

  useEffect(() => {
    getEmployerCredits()
      .then(setCredits)
      .catch((error) => console.error("Failed to load employer credits", error))
      .finally(() => setLoadingCredits(false));
  }, []);

  console.log("Candidate Data:", data);

  if (!data) return null;
  const applicationScore = Number(data.score ?? 0);
  const aiSimilarity = data.ai_similarity === null || data.ai_similarity === undefined ? null : Number(data.ai_similarity);
  const hybridScore = data.hybrid_score === null || data.hybrid_score === undefined ? null : Number(data.hybrid_score);
  const normalizedPlan = String(profile?.plan ?? "free").toLowerCase();
  const isStarter = normalizedPlan === "starter";
  const isProfessional = normalizedPlan === "professional";
  const isEnterprise = normalizedPlan === "enterprise";
  const aiCreditRemaining =
    credits.find((credit) => String(credit.creditType).toLowerCase() === "ai_credit")?.remaining ?? 0;
  const hideScoresForStarterNoCredits = isStarter && !loadingCredits && aiCreditRemaining <= 0;
  const showBreakdown = isEnterprise && Boolean(data.score_breakdown);

  console.log("Rendering Candidate Profile Drawer with data:", data);

  return (
    <aside className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-xl p-6 overflow-y-auto">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3"
        onClick={onClose}
        aria-label="Close candidate drawer"
      >
        <X className="w-4 h-4" />
      </Button>
      {/* Header */}
      {/* Header */}
      <div className="flex justify-between items-start">

        <div>

          <h2 className="text-xl font-bold">
            {data.candidate_profiles.full_name}
          </h2>

          <p className="text-sm text-gray-600">
            {data.candidate_profiles.location}
          </p>


          {/* Score Visibility */}
          {hideScoresForStarterNoCredits ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">AI score preview locked</p>
              <p className="text-xs text-amber-800 mt-1">
                Starter plan with no AI credits. Buy AI add-on credits or upgrade to Professional.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setShowAiCreditUpsell(true)}>
                  Buy Add-on
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowUpgradeModal(true)}>
                  Upgrade
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              <div className="text-sm font-medium">
                Application Score:
                <span className="ml-2 font-bold text-blue-600">
                  {applicationScore}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${applicationScore}%` }}
                ></div>
              </div>

              <div className="text-sm">
                AI Similarity:
                <span className="ml-2 font-semibold">
                  {aiSimilarity === null ? "Not available" : `${aiSimilarity}%`}
                </span>
              </div>

              <div className="text-sm">
                Hybrid Score:
                <span className="ml-2 font-semibold text-indigo-600">
                  {hybridScore === null ? "Not available" : `${hybridScore}%`}
                </span>
              </div>

              <div className="text-sm">
                Match Level:
                <span className="ml-2 font-semibold">
                  {data.match_label}
                </span>
              </div>

              <div className="text-sm">
                Recommendation:
                <span className="ml-2 font-semibold text-green-600">
                  {data.hiring_recommendation}
                </span>
              </div>

              <div className="text-sm">
                Rank:
                <span className="ml-2 font-semibold">
                  #{data.rank}
                </span>
              </div>
            </div>
          )}

        </div>


        {/* Score Badge */}
        {!hideScoresForStarterNoCredits && (
          <Badge className="text-base px-3 py-1">
            {hybridScore ?? applicationScore}%
          </Badge>
        )}

      </div>

      {showBreakdown && (
        <section className="mt-6">
          <h4 className="font-semibold mb-2">Match Breakdown</h4>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Required skills</span>
              <span>{data.score_breakdown.required} / 50</span>
            </div>

            <div className="flex justify-between">
              <span>Optional skills</span>
              <span>{data.score_breakdown.optional} / 20</span>
            </div>

            <div className="flex justify-between">
              <span>Experience level</span>
              <span>{data.score_breakdown.experience} / 15</span>
            </div>

            <div className="flex justify-between">
              <span>Skill proficiency</span>
              <span>{data.score_breakdown.skill_level} / 15</span>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6">
        <h2 className="font-semibold mb-2">Headline</h2>
        <p className="text-sm text-gray-600">{data.candidate_profiles.headline || "Location"}</p>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold mb-2">Experience</h2>
        <p className="text-sm text-gray-600">{data.candidate_profiles.years_experience || "Location"} Years</p>
      </div>

      {/* About */}
      <section className="mt-6">
        <h4 className="font-semibold mb-2">About</h4>
        <p className="text-sm text-gray-700">{data.candidate_profiles.bio}</p>
      </section>

      {/* Skills */}
      <section className="mt-6">
        <h4 className="font-semibold mb-2">Skills</h4>
        <div className="flex flex-wrap gap-2">
          {data.candidate_profiles.candidate_skills.map((s: any) => (
            <Badge key={s.skill} variant={s.matched ? "success" : "secondary"}>
              {s.skill} {s.matched ? `(${s.score}%)` : ""}
            </Badge>
          ))}

        </div>
      </section>

      {/* CV */}
      <section className="mt-6">
        <h4 className="font-semibold mb-2">CV</h4>

        {data.candidate_profiles.cv_url ? (
          <a
            href={data.candidate_profiles.cv_url}
            target="_blank"
            className="text-blue-600 text-sm underline"
          >
            Download CV
          </a>
        ) : (
          <p className="text-sm text-gray-500">No CV uploaded</p>
        )}
      </section>


      {/* Actions */}
      <div className="mt-8 space-y-2">
        <Button className="w-full">Shortlist</Button>
        <Button variant="outline" className="w-full">
          Message Candidate
        </Button>
      </div>
      <AddonUpsellModal
        open={showAiCreditUpsell}
        onOpenChange={setShowAiCreditUpsell}
        addonType="ai_credit"
        actionLabel="unlock AI candidate scoring"
      />
      {showUpgradeModal && (
        <UpgradeModal
          plan={normalizedPlan}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </aside>
  );
}
