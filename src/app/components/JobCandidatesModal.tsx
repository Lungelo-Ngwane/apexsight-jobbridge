import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { getJobApplicants, updateApplicationStatus } from "@/lib/employer";
import { CandidateProfileDrawer } from "./CandidateProfileDrawer";


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
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeStage, setActiveStage] = useState("applied");
    const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);



    useEffect(() => {
        getJobApplicants(jobId)
            .then(setCandidates)
            .finally(() => setLoading(false));
    }, [jobId]);

async function changeStatus(
    appId: string,
    status: "shortlisted" | "interview" | "rejected" | "hired",
) {
    await updateApplicationStatus(appId, status);

    console.log(`Updated application ${appId} to status ${status}`);

    setCandidates((prev) => {
        const updated = prev.map((c) =>
            c.id === appId ? { ...c, status } : c
        );
        console.log("Candidates after status change:", updated);
        return updated;
    });
}


    const filteredCandidates = candidates
        .filter((c) => c.status === activeStage)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));


    console.log("Rendering JobCandidatesModal with candidates:", candidates);

    function getMatchColor(score: number) {
        if (score >= 80) return "bg-green-100 text-green-700";
        if (score >= 60) return "bg-yellow-100 text-yellow-700";
        return "bg-red-100 text-red-700";
    }




    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl p-6">
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-semibold">Applicants</h2>
                        <Button variant="ghost" onClick={onClose}>✕</Button>
                    </div>

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
                    <p>Loading...</p>
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
                                    {typeof app.score === "number" && (
                                        <span
                                            className={`text-sm font-semibold px-2 py-1 rounded-full ${getMatchColor(
                                                app.score
                                            )}`}
                                        >
                                            {app.score}%
                                        </span>
                                    )}
                                </div>


                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setSelectedApplicationId(app.id)}
                                    >
                                        View Profile
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
        </div>
    );
}
