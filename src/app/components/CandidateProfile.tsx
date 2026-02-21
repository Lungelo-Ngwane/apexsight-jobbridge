"use client";

import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { useState, useEffect } from "react";
// import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

interface CandidateProfileProps { }

export function CandidateProfile({ }: CandidateProfileProps) {
    const { user, role } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState({
        full_name: "",
        headline: "",
        bio: "",
        location: "",
        experience_level: "",
        availability: "",
        preferred_job_type: "",
        work_mode: "",
    });

    const [skills, setSkills] = useState<{ skill_id: string; skill: string; level?: string }[]>([]);
    const [allSkills, setAllSkills] = useState<{ id: string; name: string }[]>([]);
    const [newSkill, setNewSkill] = useState("");
    const [loading, setLoading] = useState(true);

    // Fetch profile and skills
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            // Candidate profile
            const { data: candidateProfile } = await supabase
                .from("candidate_profiles")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (candidateProfile) {
                setProfile({
                    full_name: candidateProfile.full_name || "",
                    headline: candidateProfile.headline || "",
                    bio: candidateProfile.bio || "",
                    location: candidateProfile.location || "",
                    experience_level: candidateProfile.experience_level || "",
                    availability: candidateProfile.availability || "",
                    preferred_job_type: candidateProfile.preferred_job_type || "",
                    work_mode: candidateProfile.work_mode || "",
                });

                // Fetch candidate skills
                const { data: candidateSkills } = await supabase
                    .from("candidate_skills")
                    .select("skill, skill_id, level")
                    .eq("candidate_profile_id", candidateProfile.id);

                setSkills(candidateSkills || []);
            }

            // Fetch all skills for dropdown/search
            const { data: skillsData } = await supabase.from("skills").select("id, name");
            setAllSkills(skillsData || []);

            setLoading(false);
        };

        fetchData();
    }, [user]);

    const handleBack = () => {
        if (role === "candidate") navigate("/candidate/dashboard");
        else if (role === "employer") navigate("/employer/dashboard");
        else navigate("/");
    };

    const handleAddSkill = async () => {
        if (!newSkill.trim() || !user) return;

        const skill = allSkills.find((s) => s.name.toLowerCase() === newSkill.toLowerCase());
        if (!skill) {
            alert("Skill not found in system");
            return;
        }

        // Check if already added
        if (skills.some((s) => s.skill_id === skill.id)) return;

        // Get candidate_profile_id
        const { data: candidateProfile } = await supabase
            .from("candidate_profiles")
            .select("id")
            .eq("user_id", user.id)
            .single();

        if (!candidateProfile) {
            alert("Candidate profile not found!");
            return;
        }

        // Insert into candidate_skills
        const { error } = await supabase.from("candidate_skills").insert({
            candidate_profile_id: candidateProfile.id,
            skill: skill.name,
            skill_id: skill.id,
        });

        if (!error) {
            setSkills([...skills, { skill_id: skill.id, skill: skill.name }]);
            setNewSkill("");
        }
    };

    const handleRemoveSkill = async (skill_id: string) => {
        const { data: candidateProfile } = await supabase
            .from("candidate_profiles")
            .select("id")
            .eq("user_id", user.id)
            .single();

        if (!candidateProfile) return;

        await supabase
            .from("candidate_skills")
            .delete()
            .eq("candidate_profile_id", candidateProfile.id)
            .eq("skill_id", skill_id);

        setSkills(skills.filter((s) => s.skill_id !== skill_id));
    };

    const handleSaveProfile = async () => {
        if (!user) return;

        const { data: existingProfile } = await supabase
            .from("candidate_profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

        const updateData = { ...profile, updated_at: new Date().toISOString() };

        if (existingProfile) {
            await supabase.from("candidate_profiles").update(updateData).eq("user_id", user.id);
        } else {
            await supabase.from("candidate_profiles").insert({ ...updateData, user_id: user.id });
        }

        alert("Profile saved!");
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <Button variant="ghost" onClick={handleBack} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Button>

                {/* Profile Info */}
                <Card className="p-6 border-gray-200">
                    <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <Label>Full Name</Label>
                            <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                        </div>

                        <div className="md:col-span-2">
                            <Label>Professional Headline</Label>
                            <Input value={profile.headline} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} />
                        </div>

                        <div className="md:col-span-2">
                            <Label>About Me</Label>
                            <Textarea rows={5} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
                        </div>

                        <div>
                            <Label>Location</Label>
                            <Input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
                        </div>

                        <div>
                            <Label>Experience Level</Label>
                            <Input value={profile.experience_level} onChange={(e) => setProfile({ ...profile, experience_level: e.target.value })} />
                        </div>

                        <div>
                            <Label>Availability</Label>
                            <Input value={profile.availability} onChange={(e) => setProfile({ ...profile, availability: e.target.value })} />
                        </div>

                        <div>
                            <Label>Preferred Job Type</Label>
                            <Input value={profile.preferred_job_type} onChange={(e) => setProfile({ ...profile, preferred_job_type: e.target.value })} />
                        </div>

                        <div>
                            <Label>Work Mode</Label>
                            <Input value={profile.work_mode} onChange={(e) => setProfile({ ...profile, work_mode: e.target.value })} />
                        </div>
                    </div>
                </Card>

                {/* Skills */}
                {/* Skills */}
                <Card className="p-6 border-gray-200 mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Skills</h2>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Search skill..."
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                            />
                            <Button size="sm" onClick={handleAddSkill}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {skills.map((s) => (
                            <div
                                key={s.skill_id}
                                className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded"
                            >
                                <span>{s.skill}</span>

                                {/* Skill Level Dropdown */}
                                <select
                                    value={s.level || "beginner"}
                                    className="border rounded px-1 text-sm"
                                    onChange={async (e) => {
                                        const newLevel = e.target.value;
                                        setSkills(skills.map(skill => skill.skill_id === s.skill_id ? { ...skill, level: newLevel } : skill));

                                        // Update in DB
                                        const { data: candidateProfile } = await supabase
                                            .from("candidate_profiles")
                                            .select("id")
                                            .eq("user_id", user!.id)
                                            .single();

                                        if (candidateProfile) {
                                            await supabase
                                                .from("candidate_skills")
                                                .update({ level: newLevel })
                                                .eq("candidate_profile_id", candidateProfile.id)
                                                .eq("skill_id", s.skill_id);
                                        }
                                    }}
                                >
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                    <option value="expert">Expert</option>
                                </select>

                                <button onClick={() => handleRemoveSkill(s.skill_id)}>
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={handleBack}>Cancel</Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveProfile}>
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}
