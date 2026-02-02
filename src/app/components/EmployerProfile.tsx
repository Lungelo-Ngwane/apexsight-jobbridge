import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
    ArrowLeft,
    Building2,
    Briefcase,
    Users
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/app/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { useNavigate } from "react-router-dom";

interface EmployerProfileProps {
    onBack: () => void;
}

export function EmployerProfile({ onBack }: EmployerProfileProps) {
    const { user, role } = useAuth();

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [companyName, setCompanyName] = useState("");
    const [industry, setIndustry] = useState<string | null>(null);
    const [companySize, setCompanySize] = useState<string | null>(null);

    /* -----------------------------
       Load existing employer profile
    ------------------------------*/
    useEffect(() => {
        if (!user) return;

        async function loadProfile() {
            const { data, error } = await supabase
                .from("employer_profiles")
                .select("company_name, industry, company_size")
                .eq("user_id", user.id)
                .single();

            if (error) {
                console.error("Failed to load employer profile:", error);
            } else if (data) {
                setCompanyName(data.company_name);
                setIndustry(data.industry);
                setCompanySize(data.company_size);
            }

            setLoading(false);
        }

        loadProfile();
    }, [user]);

    /* -----------------------------
       Save changes
    ------------------------------*/
    async function handleSave() {
        if (!user) return;

        setSaving(true);

        const { error } = await supabase
            .from("employer_profiles")
            .update({
                company_name: companyName,
                industry,
                company_size: companySize
            })
            .eq("user_id", user.id);

        setSaving(false);

        if (error) {
            console.error("Failed to update profile:", error);
            alert("Failed to save changes");
        } else {
            alert("Profile updated successfully");
            onBack();
        }
    }

    if (loading) {
        return <div className="p-8">Loading profile...</div>;
    }

    const handleBack = () => {
        if (role === "candidate") navigate("/candidate/dashboard");
        else if (role === "employer") navigate("/employer/dashboard");
        else navigate("/");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-6 py-8">

                {/* Header */}
                <Button variant="ghost" onClick={handleBack} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Button>

                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    Company Profile
                </h1>

                {/* Company Information */}
                <Card className="p-6 border-gray-200 space-y-4">

                    {/* Company Name */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Company Name
                        </Label>
                        <Input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                        />
                    </div>

                    {/* Industry */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4" />
                            Industry
                        </Label>
                        <Select value={industry ?? ""} onValueChange={setIndustry}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="financial">Financial Services</SelectItem>
                                <SelectItem value="technology">Technology</SelectItem>
                                <SelectItem value="healthcare">Healthcare</SelectItem>
                                <SelectItem value="retail">Retail</SelectItem>
                                <SelectItem value="education">Education</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Company Size */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Company Size
                        </Label>
                        <Select value={companySize ?? ""} onValueChange={setCompanySize}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select company size" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1-10">1–10</SelectItem>
                                <SelectItem value="11-50">11–50</SelectItem>
                                <SelectItem value="51-200">51–200</SelectItem>
                                <SelectItem value="201-500">201–500</SelectItem>
                                <SelectItem value="500+">500+</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onBack}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 text-white"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
