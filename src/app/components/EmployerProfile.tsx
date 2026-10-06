import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { FeedbackDialog,useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue
} from "@/app/components/ui/select";
import { useAuth } from "@/app/context/AuthContext";
import { uploadEmployerLogo } from "@/lib/employer";
import { supabase } from "@/lib/supabase";
import {
ArrowLeft,
Briefcase,
Building2,
Upload,
Users
} from "lucide-react";
import { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";

interface EmployerProfileProps {
    onBack?: () => void;
}

export function EmployerProfile({ onBack }: EmployerProfileProps) {
    const { user, role } = useAuth();

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

    const [companyName, setCompanyName] = useState("");
    const [industry, setIndustry] = useState<string | null>(null);
    const [companySize, setCompanySize] = useState<string | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    /* -----------------------------
       Load existing employer profile
    ------------------------------*/
    useEffect(() => {
        if (!user) return;

        async function loadProfile() {
            const { data, error } = await supabase
                .from("employer_profiles")
                .select("company_name, industry, company_size, logo_url")
                .eq("user_id", user?.id)
                .single();

            if (error) {
                console.error("Failed to load employer profile:", error);
            } else if (data) {
                setCompanyName(data.company_name);
                setIndustry(data.industry);
                setCompanySize(data.company_size);
                setLogoUrl(data.logo_url ?? null);
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
                company_size: companySize,
                logo_url: logoUrl,
            })
            .eq("user_id", user.id);

        setSaving(false);

        if (error) {
            console.error("Failed to update profile:", error);
            showFeedback(
                "Save failed",
                "We couldn't save your company profile changes. Please try again.",
            );
        } else {
            showFeedback(
                "Profile updated",
                "Your company profile was updated successfully.",
            );
        }
    }

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <CircularLoader size="md" label="Loading profile..." />
            </div>
        );
    }

    const handleBack = () => {
        if (role === "candidate") navigate("/candidate/dashboard");
        else if (role === "employer") navigate("/employer/dashboard");
        else navigate("/");
    };

    async function handleLogoUpload(file: File) {
        try {
            setUploadingLogo(true);
            const url = await uploadEmployerLogo(file);
            setLogoUrl(url);
            showFeedback(
                "Logo uploaded",
                "Your company logo has been uploaded successfully.",
            );
        } catch (error) {
            console.error("Failed to upload logo", error);
            showFeedback(
                "Logo upload failed",
                "We couldn't upload your logo right now. Please try again.",
            );
        } finally {
            setUploadingLogo(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

                {/* Header */}
                <Button variant="ghost" onClick={handleBack} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
                </Button>

                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    Company Profile
                </h1>

                {/* Company Information */}
                <Card className="p-6 border-gray-200 space-y-4">
                    <div className="space-y-2">
                        <Label>Company Logo</Label>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Company logo" className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 className="w-6 h-6 text-gray-400" />
                                )}
                            </div>
                            <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm cursor-pointer hover:bg-gray-50">
                                <Upload className="w-4 h-4" />
                                {uploadingLogo ? "Uploading..." : "Upload Logo"}
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    className="hidden"
                                    disabled={uploadingLogo}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return;
                                        void handleLogoUpload(file);
                                        event.currentTarget.value = "";
                                    }}
                                />
                            </label>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, WEBP or SVG recommended.</p>
                    </div>

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
                                <SelectItem value="1-10">1â€“10</SelectItem>
                                <SelectItem value="11-50">11â€“50</SelectItem>
                                <SelectItem value="51-200">51â€“200</SelectItem>
                                <SelectItem value="201-500">201â€“500</SelectItem>
                                <SelectItem value="500+">500+</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onBack ?? handleBack}>
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
            <FeedbackDialog
                open={feedback.open}
                title={feedback.title}
                description={feedback.description}
                onOpenChange={setFeedbackOpen}
            />
        </div>
    );
}
