"use client";

import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
// import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { refreshCandidateMatchingProfile } from "@/lib/candidate";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { CircularLoader } from "@/app/components/ui/circular-loader";

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

    const [skills, setSkills] = useState<{ id?: string; skill_id?: string; skill: string; level?: string }[]>([]);
    const [allSkills, setAllSkills] = useState<{ id: string; name: string }[]>([]);
    const [candidateProfileId, setCandidateProfileId] = useState<string | null>(null);
    const [newSkill, setNewSkill] = useState("");
    const [loading, setLoading] = useState(true);
    const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

    const resolveCandidateProfileId = useCallback(async () => {
        if (!user) return null;
        if (candidateProfileId) return candidateProfileId;

        const { data: candidateProfile } = await supabase
            .from("candidate_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        const id = candidateProfile?.id ? String(candidateProfile.id) : null;
        if (id) setCandidateProfileId(id);
        return id;
    }, [candidateProfileId, user]);

    // Fetch profile and skills
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            const [{ data: candidateProfile }, { data: skillsData }] = await Promise.all([
                supabase
                    .from("candidate_profiles")
                    .select("*")
                    .eq("user_id", user.id)
                    .single(),
                supabase.from("skills").select("id, name"),
            ]);

            if (candidateProfile) {
                setCandidateProfileId(String(candidateProfile.id));
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
                    .select("id, skill, skill_id, level")
                    .eq("candidate_profile_id", candidateProfile.id);

                setSkills(candidateSkills || []);
            }

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
            showFeedback(
                "Skill not found",
                "That skill isn't currently in our system. Try selecting a different skill name.",
            );
            return;
        }

        // Check if already added
        if (skills.some((s) => s.skill_id === skill.id)) return;

        // Get candidate_profile_id
        const profileId = await resolveCandidateProfileId();
        if (!profileId) {
            showFeedback(
                "Profile not found",
                "We couldn't find your candidate profile. Refresh the page and try again.",
            );
            return;
        }

        // Insert into candidate_skills
        const { error } = await supabase.from("candidate_skills").insert({
            candidate_profile_id: profileId,
            skill: skill.name,
            skill_id: skill.id,
        });

        if (!error) {
            setSkills([...skills, { skill_id: skill.id, skill: skill.name }]);
            setNewSkill("");
            await refreshCandidateMatchingProfile(profileId).catch((syncError) =>
                console.error("Failed to refresh matching profile after adding skill", syncError),
            );
        }
    };

    const handleRemoveSkill = async (skillRow: { id?: string; skill_id?: string; skill: string }) => {
        if (!user) return;

        const profileId = await resolveCandidateProfileId();
        if (!profileId) return;

        let deleteQuery = supabase
            .from("candidate_skills")
            .delete()
            .eq("candidate_profile_id", profileId);

        if (skillRow.id) {
            deleteQuery = deleteQuery.eq("id", skillRow.id);
        } else if (skillRow.skill_id) {
            deleteQuery = deleteQuery.eq("skill_id", skillRow.skill_id);
        } else {
            deleteQuery = deleteQuery.eq("skill", skillRow.skill);
        }

        const { error } = await deleteQuery;
        if (error) {
            showFeedback(
                "Could not remove skill",
                "We couldn't remove this skill right now. Please try again.",
            );
            return;
        }

        setSkills((prev) =>
            prev.filter((s) => {
                if (skillRow.id && s.id) return s.id !== skillRow.id;
                if (skillRow.skill_id && s.skill_id) return s.skill_id !== skillRow.skill_id;
                return s.skill !== skillRow.skill;
            }),
        );

        await refreshCandidateMatchingProfile(profileId).catch((syncError) =>
            console.error("Failed to refresh matching profile after removing skill", syncError),
        );
    };

    const handleSaveProfile = async () => {
        if (!user) return;

        const updateData = { ...profile, updated_at: new Date().toISOString() };
        const profileId = await resolveCandidateProfileId();
        let finalProfileId = profileId;

        if (profileId) {
            await supabase.from("candidate_profiles").update(updateData).eq("id", profileId);
        } else {
            const { data: createdProfile } = await supabase
                .from("candidate_profiles")
                .insert({ ...updateData, user_id: user.id })
                .select("id")
                .single();
            finalProfileId = createdProfile?.id ? String(createdProfile.id) : null;
            if (finalProfileId) setCandidateProfileId(finalProfileId);
        }

        if (finalProfileId) {
            await refreshCandidateMatchingProfile(finalProfileId).catch((syncError) =>
                console.error("Failed to refresh matching profile after saving profile", syncError),
            );
        }

        showFeedback(
            "Profile saved",
            "Your profile updates were saved successfully.",
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <Card className="w-full max-w-sm p-8 border-gray-200">
                    <CircularLoader size="lg" label="Loading your profile..." />
                </Card>
            </div>
        );
    }

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
                        {skills.map((s, index) => (
                            <div
                                key={`${s.id ?? s.skill_id ?? s.skill}-${index}`}
                                className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded"
                            >
                                <span>{s.skill}</span>

                                {/* Skill Level Dropdown */}
                                <select
                                    value={s.level || "beginner"}
                                    className="border rounded px-1 text-sm"
                                    onChange={async (e) => {
                                        if (!user) return;
                                        const newLevel = e.target.value;
                                        setSkills((prev) =>
                                            prev.map((skill) =>
                                                (s.id && skill.id === s.id) || (!s.id && s.skill_id && skill.skill_id === s.skill_id)
                                                    ? { ...skill, level: newLevel }
                                                    : skill,
                                            ),
                                        );

                                        const profileId = await resolveCandidateProfileId();
                                        if (profileId) {
                                            let updateQuery = supabase
                                                .from("candidate_skills")
                                                .update({ level: newLevel })
                                                .eq("candidate_profile_id", profileId);

                                            if (s.id) {
                                                updateQuery = updateQuery.eq("id", s.id);
                                            } else if (s.skill_id) {
                                                updateQuery = updateQuery.eq("skill_id", s.skill_id);
                                            } else {
                                                updateQuery = updateQuery.eq("skill", s.skill);
                                            }

                                            await updateQuery;
                                            await refreshCandidateMatchingProfile(profileId).catch((syncError) =>
                                                console.error("Failed to refresh matching profile after updating skill level", syncError),
                                            );
                                        }
                                    }}
                                >
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                    <option value="expert">Expert</option>
                                </select>

                                <button type="button" onClick={() => handleRemoveSkill(s)}>
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
            <FeedbackDialog
                open={feedback.open}
                title={feedback.title}
                description={feedback.description}
                onOpenChange={setFeedbackOpen}
            />
        </div>
    );
}
