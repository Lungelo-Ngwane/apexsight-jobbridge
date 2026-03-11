import { useEffect, useState } from "react";
import {
  getCandidateCV,
  getCandidateDeepView,
  getEmployerCredits,
  type EmployerCreditBalance,
} from "../../lib/employer";
import { Badge } from "./ui/badge";
import { Button } from "@/app/components/ui/button";
import { X } from "lucide-react";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import { AddonUpsellModal } from "./employer/AddonUpsellModal";
import { UpgradeModal } from "./UpgradeModal";
import { hasEmployerPaidAccess } from "@/lib/subscriptionAccess";

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
  const [cvDownloadUrl, setCvDownloadUrl] = useState<string | null>(null);
  const [cvLoading, setCvLoading] = useState(false);

  useEffect(() => {
    getCandidateDeepView(applicationId).then(setData);
  }, [applicationId]);

  useEffect(() => {
    getEmployerCredits()
      .then(setCredits)
      .catch((error) => console.error("Failed to load employer credits", error))
      .finally(() => setLoadingCredits(false));
  }, []);

  useEffect(() => {
    const cvPath = String(data?.candidate_profiles?.cv_url ?? "").trim();
    if (!cvPath) {
      setCvDownloadUrl(null);
      return;
    }

    let cancelled = false;
    setCvLoading(true);

    getCandidateCV(cvPath)
      .then((url) => {
        if (!cancelled) setCvDownloadUrl(url);
      })
      .catch((error) => {
        if (!cancelled) setCvDownloadUrl(null);
        console.error("Failed to prepare CV download URL", error);
      })
      .finally(() => {
        if (!cancelled) setCvLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data?.candidate_profiles?.cv_url]);


  if (!data) return null;
  const applicationScore = Number(data.score ?? 0);
  const aiSimilarity = data.ai_similarity === null || data.ai_similarity === undefined ? null : Number(data.ai_similarity);
  const hybridScore = data.hybrid_score === null || data.hybrid_score === undefined ? null : Number(data.hybrid_score);
  const finalMatchScore = data.final_match_score === null || data.final_match_score === undefined ? null : Number(data.final_match_score);
  const confidenceScore = data.confidence_score === null || data.confidence_score === undefined ? null : Number(data.confidence_score);
  const normalizedPlan = String(profile?.plan ?? "free").toLowerCase();
  const hasPaidAccess = hasEmployerPaidAccess(profile);
  const isEnterprise = normalizedPlan === "enterprise";
  const aiCreditRemaining =
    credits.find((credit) => String(credit.creditType).toLowerCase() === "ai_credit")?.remaining ?? 0;
  const hasAiMatchingCredits = !loadingCredits && aiCreditRemaining > 0;
  const canViewAdvancedMatching = hasPaidAccess || hasAiMatchingCredits;
  const showBreakdown = isEnterprise && Boolean(data.score_breakdown);
  const matchingConfig = data.matching_config ?? {};
  const requiredJobSkills = Number(matchingConfig.required_job_skills ?? 0);
  const optionalJobSkills = Number(matchingConfig.optional_job_skills ?? 0);
  const totalJobSkills = Number(matchingConfig.total_job_skills ?? 0);
  const hasStructuredJobSkills = totalJobSkills > 0;
  const hasRequiredJobSkills = requiredJobSkills > 0;
  const hasOptionalJobSkills = optionalJobSkills > 0;

  function renderBreakdownValue(value: unknown, max: number, configured: boolean) {
    if (!configured) return "Not configured";
    return `${Number(value ?? 0)} / ${max}`;
  }

  const displayedMatchScore = finalMatchScore ?? hybridScore ?? applicationScore;
  const displayedMatchLevel = String(data.displayed_match_level ?? "").trim() || (
    displayedMatchScore >= 90 ? "Elite" :
    displayedMatchScore >= 75 ? "Strong" :
    displayedMatchScore >= 60 ? "Good" :
    displayedMatchScore >= 40 ? "Potential" : "Weak"
  );
  const displayedRecommendation = String(data.displayed_recommendation ?? "").trim() || (
    displayedMatchScore >= 75 ? "Interview Recommended" :
    displayedMatchScore >= 50 ? "Consider" : "Not Recommended"
  );
  const aboutText =
    String(data.candidate_profiles.professional_bio_ai ?? "").trim() ||
    String(data.candidate_profiles.resume_summary ?? "").trim() ||
    String(data.candidate_profiles.bio ?? "").trim();
  const knockoutFilters = Array.isArray(data.knockout_filters) ? data.knockout_filters : [];
  const matchExplanations = Array.isArray(data.match_explanations) ? data.match_explanations : [];


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
          {!canViewAdvancedMatching ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">Advanced match insights locked</p>
              <p className="text-xs text-amber-800 mt-1">
                Buy AI Matching Credits or upgrade your plan to view scoring, match explanations, and recommendation details for candidates.
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
                Rule-Based Score:
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
                Final Match Score:
                <span className="ml-2 font-semibold text-violet-700">
                  {finalMatchScore === null ? "Not available" : `${finalMatchScore}%`}
                </span>
              </div>

              <div className="text-sm">
                Match Level:
                <span className="ml-2 font-semibold">
                  {displayedMatchLevel}
                </span>
              </div>

              <div className="text-sm">
                Recommendation:
                <span className="ml-2 font-semibold text-green-600">
                  {displayedRecommendation}
                </span>
              </div>

              <div className="text-sm">
                Rank:
                <span className="ml-2 font-semibold">
                  #{data.rank}
                </span>
              </div>

              <div className="text-sm">
                Confidence:
                <span className="ml-2 font-semibold">
                  {confidenceScore === null ? "Not available" : `${confidenceScore}%`}
                </span>
              </div>

            </div>
          )}

        </div>


        {/* Score Badge */}
        {canViewAdvancedMatching && (
          <Badge className="text-base px-3 py-1">
            {displayedMatchScore}%
          </Badge>
        )}

      </div>

      {canViewAdvancedMatching && showBreakdown && (
        <section className="mt-6">
          <h4 className="font-semibold mb-2">Match Breakdown</h4>

          {!hasStructuredJobSkills ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">Matching setup incomplete</p>
              <p className="mt-1 text-xs text-amber-800">
                This job has no structured skills configured, so required, optional, and proficiency scores are not reliable yet.
              </p>
            </div>
          ) : null}

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Required skills</span>
              <span>{renderBreakdownValue(data.score_breakdown.required, 50, hasRequiredJobSkills)}</span>
            </div>

            <div className="flex justify-between">
              <span>Optional skills</span>
              <span>{renderBreakdownValue(data.score_breakdown.optional, 20, hasOptionalJobSkills)}</span>
            </div>

            <div className="flex justify-between">
              <span>Experience level</span>
              <span>{data.score_breakdown.experience} / 15</span>
            </div>

            <div className="flex justify-between">
              <span>Skill proficiency</span>
              <span>{renderBreakdownValue(data.score_breakdown.skill_level, 15, hasStructuredJobSkills)}</span>
            </div>
          </div>
        </section>
      )}

      {canViewAdvancedMatching && knockoutFilters.length > 0 && (
        <section className="mt-6">
          <h4 className="font-semibold mb-2">Knockout Filters</h4>
          <div className="space-y-2">
            {knockoutFilters.map((item: any, index: number) => (
              <div key={`${item.label}-${index}`} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900">{item.label}</span>
                  <Badge variant={item.status === "fail" ? "destructive" : item.status === "warning" ? "secondary" : "default"}>
                    {item.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-gray-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {canViewAdvancedMatching && matchExplanations.length > 0 && (
        <section className="mt-6">
          <h4 className="font-semibold mb-2">Why This Match</h4>
          <div className="space-y-2 text-sm text-gray-700">
            {matchExplanations.map((item: string, index: number) => (
              <p key={`${item}-${index}`}>• {item}</p>
            ))}
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
        <p className="text-sm text-gray-700">{aboutText || "No profile summary available."}</p>
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
            href={cvDownloadUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 text-sm underline"
            onClick={(event) => {
              if (!cvDownloadUrl) {
                event.preventDefault();
              }
            }}
          >
            {cvLoading ? "Preparing CV..." : "Download CV"}
          </a>
        ) : (
          <p className="text-sm text-gray-500">No CV uploaded</p>
        )}
      </section>


      {/* Actions */}
      <div className="mt-8 space-y-2">
        <Button className="w-full">Shortlist</Button>
        {!hasPaidAccess ? (
          <Button variant="outline" className="w-full" onClick={() => setShowUpgradeModal(true)}>
            Upgrade to Message Candidate
          </Button>
        ) : (
          <Button variant="outline" className="w-full">
            Message Candidate
          </Button>
        )}
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
