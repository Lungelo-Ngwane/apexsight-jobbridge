import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
    consumeCandidateViewAccess,
    getJobSkillSummary,
    getEmployerUsageSnapshot,
    getJobApplicants,
    runAutoMatch,
    updateApplicationStatus,
} from "@/lib/employer";
import { CandidateProfileDrawer } from "./CandidateProfileDrawer";
import { AddonUpsellModal } from "./employer/AddonUpsellModal";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { CircularLoader } from "@/app/components/ui/circular-loader";


interface Props {
    jobId: string;
    onClose: () => void;
}

const PIPELINE_STAGES = [
    { key: "applied", label: "Applied" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "interview", label: "Interview" },
    { key: "rejected", label: "Rejected" },
    { key: "hired", label: "Hired" },
];


export function JobCandidatesModal({ jobId, onClose }: Props) {
    const { profile } = useEmployerProfile();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeStage, setActiveStage] = useState("applied");
    const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
    const [unlockingProfileId, setUnlockingProfileId] = useState<string | null>(null);
    const [refreshingMatchId, setRefreshingMatchId] = useState<string | null>(null);
    const [unlockedApplicationIds, setUnlockedApplicationIds] = useState<string[]>([]);
    const [showUpsellModal, setShowUpsellModal] = useState(false);
    const [jobSkillSummary, setJobSkillSummary] = useState<{ totalCount: number; requiredCount: number; optionalCount: number } | null>(null);
    const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();



    useEffect(() => {
        getJobApplicants(jobId)
            .then(setCandidates)
            .finally(() => setLoading(false));
    }, [jobId]);

    useEffect(() => {
        getJobSkillSummary(jobId)
            .then(setJobSkillSummary)
            .catch((error) => console.error("Failed to load job skill summary", error));
    }, [jobId]);

async function changeStatus(
    appId: string,
    status: "shortlisted" | "interview" | "rejected" | "hired",
) {
    await updateApplicationStatus(appId, status);

    setCandidates((prev) => {
        const updated = prev.map((c) =>
            c.id === appId ? { ...c, status } : c
        );
        return updated;
    });
}

async function handleViewProfile(appId: string) {
    try {
        setRefreshingMatchId(appId);
        try {
            await runAutoMatch(jobId);
            const refreshedApplicants = await getJobApplicants(jobId);
            setCandidates(refreshedApplicants ?? []);
        } catch (matchError) {
            console.warn("Auto-match refresh failed before opening profile", matchError);
        } finally {
            setRefreshingMatchId(null);
        }

        if (unlockedApplicationIds.includes(appId)) {
            setSelectedApplicationId(appId);
            return;
        }

        setUnlockingProfileId(appId);
        await consumeCandidateViewAccess(appId);
        const usage = await getEmployerUsageSnapshot();
        window.dispatchEvent(
            new CustomEvent("candidate-view-consumed", {
                detail: usage,
            }),
        );
        setUnlockedApplicationIds((prev) => [...new Set([...prev, appId])]);
        setSelectedApplicationId(appId);
    } catch (error: any) {
        const message = String(error?.message ?? "").toLowerCase();
        if (message.includes("insufficient") || message.includes("no credits")) {
            setShowUpsellModal(true);
            return;
        }
        console.error("Failed to unlock candidate profile", error);
        showFeedback(
            "Unable to open profile",
            "We couldn't unlock this candidate profile right now. Please try again.",
        );
    } finally {
        setUnlockingProfileId(null);
    }
}


    const filteredCandidates = candidates
        .filter((c) => c.status === activeStage)
        .sort((a, b) => (Number(b.hybrid_score ?? b.score ?? 0)) - (Number(a.hybrid_score ?? a.score ?? 0)));
    const normalizedPlan = String(profile?.plan ?? "free").toLowerCase();
    const canShowScores = normalizedPlan === "professional" || normalizedPlan === "enterprise";
    function getMatchColor(score: number) {
        if (score >= 80) return "bg-green-100 text-green-700";
        if (score >= 60) return "bg-yellow-100 text-yellow-700";
        return "bg-red-100 text-red-700";
    }

    console.log("Candidates for job", jobId, candidates);




    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl p-6">
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-semibold">Applicants</h2>
                        <Button variant="ghost" onClick={onClose}>✕</Button>
                    </div>

                    {jobSkillSummary && jobSkillSummary.totalCount === 0 ? (
                        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm font-semibold text-amber-900">Job matching is only partially configured</p>
                            <p className="mt-1 text-xs text-amber-800">
                                This job has no structured skills yet. Scores will rely mostly on experience and AI similarity until job skills are added.
                            </p>
                        </div>
                    ) : null}

                    <div className="flex gap-2">
                        {PIPELINE_STAGES.map((stage) => (
                            <button
                                key={stage.key}
                                onClick={() => setActiveStage(stage.key)}
                                className={`px-3 py-1 rounded-full text-sm font-medium
                                    ${activeStage === stage.key
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                            >
                                {stage.label} (
                                {candidates.filter(c => c.status === stage.key).length}
                                )
                            </button>
                        ))}
                    </div>
                </div>


                {loading ? (
                    <div className="py-3">
                        <CircularLoader size="sm" label="Loading..." />
                    </div>
                ) : filteredCandidates.length === 0 ? (
                    <p className="text-gray-500">No applicants yet</p>
                ) : (
                    <div className="space-y-4">
                        {filteredCandidates.map((app) => (
                            <div
                                key={app.id}
                                className={`border rounded-lg p-4 flex justify-between items-center ${app.status === "rejected" || app.status === "hired"
                                    ? "opacity-60"
                                    : ""
                                    }`}
                            >

                                <div>
                                    <p className="font-medium">
                                        {app.candidate.full_name}
                                    </p>

                                    <Badge className="mt-1">{app.status}</Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                    {canShowScores && typeof (app.hybrid_score ?? app.score) === "number" && (
                                        <span
                                            className={`text-sm font-semibold px-2 py-1 rounded-full ${getMatchColor(
                                                Number(app.hybrid_score ?? app.score ?? 0)
                                            )}`}
                                        >
                                            {Number(app.hybrid_score ?? app.score)}%
                                        </span>
                                    )}
                                </div>


                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleViewProfile(app.id)}
                                        disabled={unlockingProfileId === app.id || refreshingMatchId === app.id}
                                    >
                                        {refreshingMatchId === app.id
                                            ? "Refreshing Match..."
                                            : unlockingProfileId === app.id
                                                ? "Unlocking..."
                                                : "View Profile"}
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={app.status === "shortlisted"}
                                        onClick={() => changeStatus(app.id, "shortlisted")}
                                    >
                                        Shortlist
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={app.status === "interview"}
                                        onClick={() => changeStatus(app.id, "interview")}
                                    >
                                        Interview
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={app.status === "rejected"}
                                        onClick={() => changeStatus(app.id, "rejected")}
                                    >
                                        Reject
                                    </Button>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </Card>
            {selectedApplicationId && (
                <CandidateProfileDrawer
                    applicationId={selectedApplicationId}
                    onClose={() => setSelectedApplicationId(null)}
                />
            )}
            <AddonUpsellModal
                open={showUpsellModal}
                onOpenChange={setShowUpsellModal}
                addonType="candidate_unlock"
                actionLabel="unlock this candidate profile"
            />
            <FeedbackDialog
                open={feedback.open}
                title={feedback.title}
                description={feedback.description}
                onOpenChange={setFeedbackOpen}
            />
        </div>
    );
}
