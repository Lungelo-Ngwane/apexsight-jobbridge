import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";
import { createJob } from "@/lib/employer";
import { supabase } from "../../lib/supabase";
// import { supabase } from "@/lib/supabaseClient"; // adjust path

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
    const [loading, setLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Skill[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [experienceLevel, setExperienceLevel] = useState("");

    // Search skills dynamically
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
        if (!selectedSkills.find(s => s.skill_id === skill.id)) {
            setSelectedSkills(prev => [...prev, { skill_id: skill.id, name: skill.name, is_required: true }]);
        }
        setSearchTerm(""); // clear input
        setSearchResults([]);
    }

    function handleRemoveSkill(skillId: string) {
        setSelectedSkills(prev => prev.filter(s => s.skill_id !== skillId));
    }

async function handleSubmit() {
    if (!title || !description || !experienceLevel) {
        alert("Please fill all required fields, including experience level.");
        return;
    }

    try {
        setLoading(true);

        await createJob({
            title,
            location,
            description,
            status,
            employment_type: employmentType,
            experience_level: experienceLevel,
            skills: selectedSkills.map(s => ({ skill_id: s.skill_id, is_required: s.is_required })),
        });

        onSuccess();
        onClose();
    } catch (err) {
        console.error("Failed to create job", err);
        alert(err);
    } finally {
        setLoading(false);
    }
}


    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Post New Job</h2>

                <div className="space-y-3">
                    <Input
                        placeholder="Job Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <Input
                        placeholder="Location (Remote / City)"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />

                    <Input
                        placeholder="Employment Type"
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value)}
                    />

                    {/* Skills selector with autocomplete */}
                    <div>
                        <label className="font-medium mb-1 block">Skills</label>

                        {/* Selected skills as chips */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            {selectedSkills.map(skill => (
                                <div
                                    key={skill.skill_id}
                                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500 text-white text-sm"
                                >
                                    {skill.name}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSkill(skill.skill_id)}
                                        className="ml-1 text-white font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Search input */}
                        <Input
                            placeholder="Search and add skills"
                            value={searchTerm}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchTerm(val);
                                searchSkills(val);
                            }}
                        />

                        {/* Search results dropdown */}
                        {searchTerm && searchResults.length > 0 && (
                            <div className="border mt-1 rounded-md max-h-40 overflow-y-auto bg-white z-10 relative shadow-md">
                                {searchResults.map(skill => (
                                    <button
                                        key={skill.id}
                                        type="button"
                                        onClick={() => handleAddSkill(skill)}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                    >
                                        {skill.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {searchLoading && <p className="text-sm text-gray-500 mt-1">Searching...</p>}
                    </div>

                    <Input
                        placeholder="Job Status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as Status)}
                    />

                    {/* 2️⃣ Experience field in the UI */}
                    <div>
                        <label className="font-medium mb-1 block">Experience Level</label>
                        <select
                            className="w-full border rounded-md p-2 text-sm"
                            value={experienceLevel}
                            onChange={(e) => setExperienceLevel(e.target.value)}
                        >
                            <option value="">Select experience</option>
                            {/* <option value="Intern">Intern</option> */}
                            <option value="junior">junior</option>
                            <option value="mid">mid</option>
                            <option value="senior">senior</option>
                            {/* <option value="Lead">Lead</option> */}
                        </select>
                    </div>

                    <textarea
                        className="w-full border rounded-md p-2 text-sm"
                        rows={5}
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
    );
}
