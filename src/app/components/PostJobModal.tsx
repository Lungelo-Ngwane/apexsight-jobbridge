import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";
import { createJob } from "@/lib/employer";
import { supabase } from "@/lib/supabase";
import { UpgradeModal } from "./UpgradeModal";
import { useEmployerProfile } from "../../hooks/useEmployerProfile";

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

type SelectedSkill = {
    skill_id: string;
    name: string;
    is_required: boolean;
};

type Status = "open" | "closed" | "archived";

type Skill = {
    id: string;
    name: string;
};

export function PostJobModal({ onClose, onSuccess }: Props) {
    const [title, setTitle] = useState("");
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");
    const [employmentType, setEmploymentType] = useState("");
    const [status, setStatus] = useState<Status>("open");
    const [experienceLevel, setExperienceLevel] = useState("");
    const [loading, setLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Skill[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const { profile } = useEmployerProfile();

    // 🔍 Skill search
    async function searchSkills(query: string) {
        if (!query) {
            setSearchResults([]);
            return;
        }

        setSearchLoading(true);
        try {
            const { data, error } = await supabase
                .from("skills")
                .select("id, name")
                .ilike("name", `%${query}%`)
                .limit(10);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error("Failed to search skills", err);
        } finally {
            setSearchLoading(false);
        }
    }

    function handleAddSkill(skill: Skill) {
        if (!selectedSkills.find((s) => s.skill_id === skill.id)) {
            setSelectedSkills((prev) => [
                ...prev,
                { skill_id: skill.id, name: skill.name, is_required: true },
            ]);
        }
        setSearchTerm("");
        setSearchResults([]);
    }

    function handleRemoveSkill(skillId: string) {
        setSelectedSkills((prev) => prev.filter((s) => s.skill_id !== skillId));
    }

    async function handleSubmit() {
        if (!title || !description || !experienceLevel) {
            alert("Please fill all required fields.");
            return;
        }

        setLoading(true);

        try {
            await createJob({
                title,
                description,
                location,
                employment_type: employmentType,
                status,
                experience_level: experienceLevel,
                skills: selectedSkills.map((s) => ({
                    skill_id: s.skill_id,
                    is_required: s.is_required,
                })),
            });

            onSuccess();
            onClose();
        } catch (e: any) {
            if (e.message === "PLAN_LIMIT_REACHED") {
                setShowUpgradeModal(true);
            } else {
                console.error(e);
                alert("Failed to post job. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <Card className="w-full max-w-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Post New Job</h2>

                    <div className="space-y-3">
                        <Input placeholder="Job Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                        <Input placeholder="Location (Remote / City)" value={location} onChange={(e) => setLocation(e.target.value)} />
                        <Input placeholder="Employment Type" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} />

                        {/* Skills */}
                        <div>
                            <label className="font-medium block mb-1">Skills</label>

                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedSkills.map((skill) => (
                                    <span
                                        key={skill.skill_id}
                                        className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1"
                                    >
                                        {skill.name}
                                        <button onClick={() => handleRemoveSkill(skill.skill_id)}>×</button>
                                    </span>
                                ))}
                            </div>

                            <Input
                                placeholder="Search skills"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    searchSkills(e.target.value);
                                }}
                            />

                            {searchResults.length > 0 && (
                                <div className="border rounded-md mt-1 bg-white max-h-40 overflow-y-auto">
                                    {searchResults.map((skill) => (
                                        <button
                                            key={skill.id}
                                            className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                            onClick={() => handleAddSkill(skill)}
                                        >
                                            {skill.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {searchLoading && <p className="text-xs text-gray-500">Searching...</p>}
                        </div>

                        {/* Experience */}
                        <div>
                            <label className="font-medium block mb-1">Experience Level</label>
                            <select
                                className="w-full border rounded-md p-2"
                                value={experienceLevel}
                                onChange={(e) => setExperienceLevel(e.target.value)}
                            >
                                <option value="">Select experience</option>
                                <option value="junior">Junior</option>
                                <option value="mid">Mid</option>
                                <option value="senior">Senior</option>
                            </select>
                        </div>

                        <textarea
                            className="w-full border rounded-md p-2 text-sm"
                            rows={4}
                            placeholder="Job Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? "Posting..." : "Post Job"}
                        </Button>
                    </div>
                </Card>
            </div>

            {showUpgradeModal && (
                <UpgradeModal plan={profile?.plan ?? "free"} onClose={() => setShowUpgradeModal(false)} />
            )}
        </>
    );
}
