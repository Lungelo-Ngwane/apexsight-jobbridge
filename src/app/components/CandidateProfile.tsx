"use client";

import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { ArrowLeft, Building2, CalendarDays, ChevronDown, ChevronUp, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
// import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { addCandidateCertification, addCandidateSkillByName, removeCandidateCertification, refreshCandidateEmbedding, uploadCandidateCV } from "@/lib/candidate";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { CircularLoader } from "@/app/components/ui/circular-loader";

interface CandidateProfileProps { }

export function CandidateProfile({ }: CandidateProfileProps) {
    const { user, role } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState({
        full_name: "",
        surname: "",
        headline: "",
        bio: "",
        location: "",
        years_experience: 0,
        experience_level: "",
        availability: "",
        preferred_job_type: "",
        work_mode: "",
        date_of_birth: "",
        id_number: "",
        gender: "",
        contact_number: "",
    });

    const [skills, setSkills] = useState<{ id?: string; skill_id?: string; skill: string; level?: string }[]>([]);
    const [certifications, setCertifications] = useState<{ id?: string; name: string; issuer?: string | null; issued_at?: string | null }[]>([]);
    const [allSkills, setAllSkills] = useState<{ id: string; name: string }[]>([]);
    const [candidateProfileId, setCandidateProfileId] = useState<string | null>(null);
    const [newSkill, setNewSkill] = useState("");
    const [newCertification, setNewCertification] = useState({ name: "", issuer: "", issued_at: "" });
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingCertification, setSavingCertification] = useState(false);
    const [cvUploading, setCvUploading] = useState(false);
    const [cvName, setCvName] = useState<string | null>(null);
    const [showAllSkills, setShowAllSkills] = useState(false);
    const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

    const resolveCandidateProfileId = useCallback(async (createIfMissing = false) => {
        if (!user) return null;
        if (candidateProfileId) return candidateProfileId;

        const { data: candidateProfile } = await supabase
            .from("candidate_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        const id = candidateProfile?.id ? String(candidateProfile.id) : null;
        if (id) {
            setCandidateProfileId(id);
            return id;
        }

        if (!createIfMissing) return null;

        const { data: createdProfile, error: createError } = await supabase
            .from("candidate_profiles")
            .insert({
                user_id: user.id,
                full_name: String(profile.full_name ?? user.user_metadata?.full_name ?? user.email ?? "").trim(),
                surname: profile.surname || null,
                headline: profile.headline || null,
                bio: profile.bio || null,
                location: profile.location || null,
                years_experience: Number(profile.years_experience ?? 0),
                experience_level: profile.experience_level || null,
                availability: profile.availability || null,
                preferred_job_type: profile.preferred_job_type || null,
                work_mode: profile.work_mode || null,
                date_of_birth: profile.date_of_birth || null,
                id_number: profile.id_number || null,
                gender: profile.gender || null,
                contact_number: profile.contact_number || null,
            })
            .select("id")
            .single();

        if (createError || !createdProfile?.id) {
            console.error("Failed to create candidate profile", createError);
            return null;
        }

        const createdId = String(createdProfile.id);
        setCandidateProfileId(createdId);
        return createdId;
    }, [candidateProfileId, profile, user]);

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
                    surname: candidateProfile.surname || "",
                    headline: candidateProfile.headline || "",
                    bio: candidateProfile.bio || "",
                    location: candidateProfile.location || "",
                    years_experience:
                        candidateProfile.years_experience !== null &&
                            candidateProfile.years_experience !== undefined
                            ? Number(candidateProfile.years_experience)
                            : 0,
                    experience_level: candidateProfile.experience_level || "",
                    availability: candidateProfile.availability || "",
                    preferred_job_type: candidateProfile.preferred_job_type || "",
                    work_mode: candidateProfile.work_mode || "",
                    date_of_birth: candidateProfile.date_of_birth || "",
                    id_number: candidateProfile.id_number || "",
                    gender: candidateProfile.gender || "",
                    contact_number: candidateProfile.contact_number || "",
                });
                setCvName(String(candidateProfile.cv_url ?? "").trim().split("/").pop() || null);

                // Fetch candidate skills
                const { data: candidateSkills } = await supabase
                    .from("candidate_skills")
                    .select("id, skill, skill_id, level")
                    .eq("candidate_profile_id", candidateProfile.id);

                const { data: candidateCertifications } = await supabase
                    .from("candidate_certifications")
                    .select("id, name, issuer, issued_at")
                    .eq("candidate_id", candidateProfile.id)
                    .order("issued_at", { ascending: false });

                setSkills(candidateSkills || []);
                setCertifications(candidateCertifications || []);
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

        const normalizedNewSkill = newSkill.trim().toLowerCase();
        if (skills.some((s) => s.skill.trim().toLowerCase() === normalizedNewSkill)) return;

        try {
            const createdSkill = await addCandidateSkillByName(newSkill.trim(), "beginner");
            setSkills((prev) => [...prev, createdSkill]);
            setAllSkills((prev) => {
                const exists = prev.some((skill) => skill.name.trim().toLowerCase() === normalizedNewSkill);
                if (exists) return prev;
                const next = [
                    ...prev,
                    {
                        id: String(createdSkill.skill_id ?? ""),
                        name: createdSkill.skill,
                    },
                ].filter((skill) => String(skill.id).trim() && String(skill.name).trim());
                return next.sort((a, b) => a.name.localeCompare(b.name));
            });
            setNewSkill("");
        } catch (error) {
            console.error("Failed to add candidate skill", error);
            showFeedback(
                "Could not add skill",
                "We couldn't save that skill right now. Please try again.",
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

        void refreshCandidateEmbedding(profileId).catch((syncError) =>
            console.error("Failed to refresh candidate embedding after removing skill", syncError),
        );
    };

    const handleSaveProfile = async () => {
        if (!user) return;

        try {
            setSavingProfile(true);

            const updateData = {
                ...profile,
                date_of_birth: profile.date_of_birth || null,
                id_number: profile.id_number || null,
                gender: profile.gender || null,
                contact_number: profile.contact_number || null,
                surname: profile.surname || null,
                updated_at: new Date().toISOString(),
            };
            const profileId = await resolveCandidateProfileId(true);
            let finalProfileId = profileId;

            if (profileId) {
                const { error: updateError } = await supabase
                    .from("candidate_profiles")
                    .update(updateData)
                    .eq("id", profileId);
                if (updateError) throw updateError;
            } else {
                const { data: createdProfile, error: createProfileError } = await supabase
                    .from("candidate_profiles")
                    .insert({ ...updateData, user_id: user.id })
                    .select("id")
                    .single();
                if (createProfileError) throw createProfileError;
                finalProfileId = createdProfile?.id ? String(createdProfile.id) : null;
                if (finalProfileId) setCandidateProfileId(finalProfileId);
            }

            if (finalProfileId) {
                await refreshCandidateEmbedding(finalProfileId).catch((syncError) =>
                    console.error("Failed to refresh candidate embedding after saving profile", syncError),
                );
            }

            const normalizedFullName = String(profile.full_name ?? "").trim();
            const normalizedSurname = String(profile.surname ?? "").trim();
            const combinedDisplayName = [normalizedFullName, normalizedSurname].filter(Boolean).join(" ").trim();
            if (combinedDisplayName) {
                const { error: metadataError } = await supabase.auth.updateUser({
                    data: {
                        full_name: combinedDisplayName,
                    },
                });

                if (metadataError) {
                    console.error("Failed to sync auth user metadata after saving profile", metadataError);
                }
            }

            showFeedback(
                "Profile saved",
                "Your profile updates were saved successfully.",
            );
            window.setTimeout(() => {
                navigate("/candidate/dashboard");
            }, 300);
        } catch (error) {
            console.error("Failed to save candidate profile", error);
            showFeedback(
                "Could not save profile",
                "We couldn't save your profile right now. Please try again.",
            );
        } finally {
            setSavingProfile(false);
        }
    };

    const handleUploadCv = async (file: File | null) => {
        if (!file) return;

        try {
            setCvUploading(true);
            const path = await uploadCandidateCV(file);
            setCvName(path.split("/").pop() ?? null);
            showFeedback(
                "CV uploaded",
                "Your CV was uploaded successfully.",
            );
        } catch (error) {
            console.error("Failed to upload CV", error);
            showFeedback(
                "Could not upload CV",
                "We couldn't upload your CV right now. Please try again.",
            );
        } finally {
            setCvUploading(false);
        }
    };

    const handleAddCertification = async () => {
        if (!newCertification.name.trim()) {
            showFeedback(
                "Missing certification name",
                "Enter the certificate name before saving it.",
            );
            return;
        }

        try {
            setSavingCertification(true);
            const createdCertification = await addCandidateCertification({
                name: newCertification.name.trim(),
                issuer: newCertification.issuer.trim(),
                issuedAt: newCertification.issued_at,
            });
            setCertifications((prev) => [createdCertification, ...prev]);
            setNewCertification({ name: "", issuer: "", issued_at: "" });
        } catch (error) {
            console.error("Failed to add certification", error);
            showFeedback(
                "Could not add certification",
                "We couldn't save that certification right now. Please try again.",
            );
        } finally {
            setSavingCertification(false);
        }
    };

    const handleRemoveCertification = async (certificationId?: string) => {
        const normalizedCertificationId = String(certificationId ?? "").trim();
        if (!normalizedCertificationId) return;

        try {
            await removeCandidateCertification(normalizedCertificationId);
            setCertifications((prev) => prev.filter((cert) => cert.id !== normalizedCertificationId));
        } catch (error) {
            console.error("Failed to remove certification", error);
            showFeedback(
                "Could not remove certification",
                "We couldn't remove this certification right now. Please try again.",
            );
        }
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

    const visibleSkills = showAllSkills ? skills : skills.slice(0, 12);
    const hiddenSkillsCount = Math.max(0, skills.length - visibleSkills.length);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <Button variant="ghost" onClick={handleBack} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
                </Button>

                {/* Profile Info */}
                <Card className="p-6 border-gray-200">
                    <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Full Names</Label>
                            <Input
                                placeholder="e.g. Thando Siphesihle"
                                value={profile.full_name}
                                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Surname</Label>
                            <Input
                                placeholder="e.g. Mokoena"
                                value={profile.surname}
                                onChange={(e) => setProfile({ ...profile, surname: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <Label>Professional Title</Label>
                            <Input
                                placeholder="e.g. Junior Data Analyst"
                                value={profile.headline}
                                onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <Label>Professional Summary</Label>
                            <Textarea
                                rows={5}
                                placeholder="Tell employers about your background, strengths, and the kind of work you are looking for."
                                value={profile.bio}
                                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Date of Birth</Label>
                            <Input
                                type="date"
                                value={profile.date_of_birth}
                                onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>ID Number</Label>
                            <Input
                                placeholder="e.g. 9901015800087"
                                value={profile.id_number}
                                onChange={(e) => setProfile({ ...profile, id_number: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Gender</Label>
                            <Input
                                placeholder="e.g. Female"
                                value={profile.gender}
                                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Contact Number</Label>
                            <Input
                                placeholder="e.g. 071 234 5678"
                                value={profile.contact_number}
                                onChange={(e) => setProfile({ ...profile, contact_number: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Location</Label>
                            <Input
                                placeholder="e.g. Johannesburg"
                                value={profile.location}
                                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Experience Level</Label>
                            <Input
                                placeholder="e.g. Entry level"
                                value={profile.experience_level}
                                onChange={(e) => setProfile({ ...profile, experience_level: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Years of Experience</Label>
                            <Input
                                type="number"
                                min={0}
                                value={profile.years_experience}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        years_experience: Number(e.target.value || 0),
                                    })
                                }
                            />
                        </div>

                        <div>
                            <Label>Availability</Label>
                            <Input
                                placeholder="e.g. Immediately available"
                                value={profile.availability}
                                onChange={(e) => setProfile({ ...profile, availability: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Preferred Job Type</Label>
                            <select
                                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={profile.preferred_job_type}
                                onChange={(e) => setProfile({ ...profile, preferred_job_type: e.target.value })}
                            >
                                <option value="">Any job type</option>
                                <option value="Full-time">Full-time</option>
                                <option value="Part-time">Part-time</option>
                                <option value="Contract">Contract</option>
                                <option value="Internship">Internship</option>
                                <option value="Temporary">Temporary</option>
                            </select>
                        </div>

                        <div>
                            <Label>Work Mode</Label>
                            <select
                                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={profile.work_mode}
                                onChange={(e) => setProfile({ ...profile, work_mode: e.target.value })}
                            >
                                <option value="">Any work mode</option>
                                <option value="remote">Remote</option>
                                <option value="hybrid">Hybrid</option>
                                <option value="onsite">On-site</option>
                            </select>
                        </div>
                    </div>
                </Card>

                <Card className="mt-6 border-gray-200 p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">CV / Resume</h2>
                            <p className="text-sm text-gray-500">
                                Upload your latest CV so your profile and matching data stay current.
                            </p>
                        </div>
                        {cvName && (
                            <Badge variant="secondary" className="max-w-[220px] truncate">
                                {cvName}
                            </Badge>
                        )}
                    </div>

                    <label className="block cursor-pointer" htmlFor="candidate-profile-cv-upload">
                        <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 px-5 py-6 text-center transition hover:bg-blue-100">
                            <p className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
                                <Upload className="h-4 w-4" />
                                {cvUploading ? "Uploading CV..." : cvName ? "Replace CV" : "Upload CV"}
                            </p>
                            <p className="mt-1 text-xs text-blue-600">
                                Click to choose your CV file.
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Accepted: PDF, DOC, DOCX, TXT
                            </p>
                            {cvName && (
                                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                                    <FileText className="h-3.5 w-3.5" />
                                    {cvName}
                                </p>
                            )}
                        </div>
                    </label>
                    <input
                        id="candidate-profile-cv-upload"
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className="sr-only"
                        disabled={cvUploading}
                        onChange={async (e) => {
                            const file = e.target.files?.[0] ?? null;
                            await handleUploadCv(file);
                            e.currentTarget.value = "";
                        }}
                    />
                </Card>

                {/* Skills */}
                {/* Skills */}
                <Card className="p-6 border-gray-200 mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold">Skills</h2>
                            <p className="text-sm text-gray-500">
                                {skills.length} skills on your profile
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Type a skill name"
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                            />
                            <Button size="sm" onClick={handleAddSkill}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    {skills.length > 12 ? (
                        <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-medium text-blue-900">Large skill library</p>
                                <p className="text-xs text-blue-700">
                                    Showing {visibleSkills.length} of {skills.length} skills.
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setShowAllSkills((prev) => !prev)}>
                                {showAllSkills ? "Collapse" : `Show All ${skills.length}`}
                                {showAllSkills ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                            </Button>
                        </div>
                    ) : null}
                    <div className={`flex flex-wrap gap-2 ${showAllSkills ? "max-h-[420px] overflow-y-auto pr-1" : ""}`}>
                        {visibleSkills.map((s, index) => (
                            <div
                                key={`${s.id ?? s.skill_id ?? s.skill}-${index}`}
                                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900"
                            >
                                <span className="max-w-[180px] truncate text-sm font-medium" title={s.skill}>{s.skill}</span>

                                {/* Skill Level Dropdown */}
                                <select
                                    value={s.level || "beginner"}
                                    className="rounded border border-blue-200 bg-white px-2 py-1 text-sm"
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
                                            void refreshCandidateEmbedding(profileId).catch((syncError) =>
                                                console.error("Failed to refresh candidate embedding after updating skill level", syncError),
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
                    {!showAllSkills && hiddenSkillsCount > 0 ? (
                        <button
                            type="button"
                            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition hover:text-blue-800"
                            onClick={() => setShowAllSkills(true)}
                        >
                            Show {hiddenSkillsCount} more skills
                            <ChevronDown className="h-4 w-4" />
                        </button>
                    ) : null}
                </Card>

                <Card className="mt-6 border-gray-200 p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Certifications</h2>
                            <p className="text-sm text-gray-500">
                                Add certifications earned through assessments or external providers.
                            </p>
                        </div>
                        <Badge variant="secondary">{certifications.length} added</Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Input
                            placeholder="Certification name"
                            value={newCertification.name}
                            onChange={(e) => setNewCertification((prev) => ({ ...prev, name: e.target.value }))}
                        />
                        <Input
                            placeholder="Issuer"
                            value={newCertification.issuer}
                            onChange={(e) => setNewCertification((prev) => ({ ...prev, issuer: e.target.value }))}
                        />
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={newCertification.issued_at}
                                onChange={(e) => setNewCertification((prev) => ({ ...prev, issued_at: e.target.value }))}
                            />
                            <Button onClick={handleAddCertification} disabled={savingCertification}>
                                {savingCertification ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {certifications.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
                            <p className="text-sm font-medium text-gray-900">No certifications added yet</p>
                            <p className="mt-1 text-xs text-gray-500">
                                Add the certifications you already hold so employers can see them immediately.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {certifications.map((cert) => (
                                <div
                                    key={cert.id ?? `${cert.name}-${cert.issued_at ?? ""}`}
                                    className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
                                >
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900">{cert.name}</p>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                                                <Building2 className="h-3.5 w-3.5" />
                                                {String(cert.issuer ?? "").trim() || "Issuer not specified"}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                {String(cert.issued_at ?? "").trim() || "Date not specified"}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded-md p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                        onClick={() => handleRemoveCertification(cert.id)}
                                        aria-label={`Delete ${cert.name}`}
                                        title={`Delete ${cert.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={handleBack} disabled={savingProfile}>Cancel</Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                    >
                        {savingProfile ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving changes...
                            </>
                        ) : (
                            "Save Changes"
                        )}
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
