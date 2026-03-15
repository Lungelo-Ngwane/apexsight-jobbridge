import { useCallback, useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
    consumeCandidateViewAccess,
    getCandidateDeepView,
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
import { ScheduleInterviewModal } from "./ScheduleInterviewModal";


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
    const [interviewModalState, setInterviewModalState] = useState<{ open: boolean; applicationId: string | null; candidateName: string }>({
        open: false,
        applicationId: null,
        candidateName: "",
    });
    const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

    function getDisplayedMatchScore(application: any) {
        const finalScore = Number(application?.final_match_score);
        if (Number.isFinite(finalScore)) return finalScore;

        const hybridScore = Number(application?.hybrid_score);
        if (Number.isFinite(hybridScore)) return hybridScore;

        const ruleScore = Number(application?.score);
        if (Number.isFinite(ruleScore)) return ruleScore;

        return null;
    }

    function mergeApplicantWithDeepView(application: any, deepView: any) {
        return {
            ...application,
            ai_similarity: deepView?.ai_similarity ?? application.ai_similarity,
            hybrid_score: deepView?.hybrid_score ?? application.hybrid_score,
            final_match_score: deepView?.final_match_score ?? application.final_match_score,
            confidence_score: deepView?.confidence_score ?? application.confidence_score,
        };
    }

    async function syncCandidateMatchSnapshot(applicationId: string) {
        const deepView = await getCandidateDeepView(applicationId);
        setCandidates((prev) =>
            prev.map((candidate) =>
                candidate.id === applicationId
                    ? mergeApplicantWithDeepView(candidate, deepView)
                    : candidate,
            ),
        );
    }

    const hydrateApplicantScores = useCallback(async (applications: any[]) => {
        const hydrated = await Promise.all(
            applications.map(async (application) => {
                try {
                    const deepView = await getCandidateDeepView(String(application.id));
                    return mergeApplicantWithDeepView(application, deepView);
                } catch (error) {
                    console.warn("Failed to hydrate applicant score", application.id, error);
                    return application;
                }
            }),
        );

        setCandidates(hydrated);
    }, []);

    const loadApplicants = useCallback(async () => {
        setLoading(true);
        try {
            const applicants = await getJobApplicants(jobId);
            setCandidates(applicants ?? []);
            void hydrateApplicantScores(applicants ?? []);
        } finally {
            setLoading(false);
        }
    }, [hydrateApplicantScores, jobId]);



    useEffect(() => {
        void loadApplicants();
    }, [loadApplicants]);

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

async function handleInterviewScheduled() {
    try {
        const refreshedApplicants = await getJobApplicants(jobId);
        setCandidates(refreshedApplicants ?? []);
        showFeedback("Interview scheduled", "The interview has been added to the system and the candidate was moved to the interview stage.");
    } catch (error) {
        console.error("Failed to refresh applicants after interview scheduling", error);
        showFeedback("Interview scheduled", "The interview was saved, but we could not refresh the applicant list immediately.");
    }
}

    async function handleViewProfile(appId: string) {
    try {
        setRefreshingMatchId(appId);
        try {
            await runAutoMatch(jobId);
            await syncCandidateMatchSnapshot(appId);
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
        .sort((a, b) => (Number(getDisplayedMatchScore(b) ?? 0)) - (Number(getDisplayedMatchScore(a) ?? 0)));
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
                                    {canShowScores && getDisplayedMatchScore(app) !== null && (
                                        <span
                                            className={`text-sm font-semibold px-2 py-1 rounded-full ${getMatchColor(
                                                Number(getDisplayedMatchScore(app) ?? 0)
                                            )}`}
                                        >
                                            {Number(getDisplayedMatchScore(app))}%
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
                                        onClick={() =>
                                            setInterviewModalState({
                                                open: true,
                                                applicationId: app.id,
                                                candidateName: String(app.candidate?.full_name ?? "Candidate"),
                                            })
                                        }
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
            <ScheduleInterviewModal
                open={interviewModalState.open}
                applicationId={interviewModalState.applicationId}
                candidateName={interviewModalState.candidateName}
                onOpenChange={(open) =>
                    setInterviewModalState((prev) => ({
                        ...prev,
                        open,
                        applicationId: open ? prev.applicationId : null,
                        candidateName: open ? prev.candidateName : "",
                    }))
                }
                onScheduled={handleInterviewScheduled}
            />
        </div>
    );
}
