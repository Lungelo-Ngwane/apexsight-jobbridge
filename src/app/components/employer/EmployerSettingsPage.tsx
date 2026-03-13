import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { 
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Users,
  Bell,
  Lock,
  Palette,
  Save,
  CheckCircle,
  Upload,
  Shield,
  Key,
  Trash2,
  AlertCircle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Switch } from "@/app/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import {
  getEmployerTeamMembers,
  inviteEmployerTeamMember,
  revokeEmployerTeamMember,
  updateEmployerProfile,
  updateEmployerTeamMember,
  uploadEmployerBanner,
  uploadEmployerLogo,
  type EmployerMembershipRole,
  type EmployerTeamMember,
} from "@/lib/employer";
import { useAuth } from "@/app/context/AuthContext";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { useNavigate } from "react-router-dom";

export function EmployerSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("company");
  const { user } = useAuth();
  const { profile, loading } = useEmployerProfile();

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [showOnPlatform, setShowOnPlatform] = useState(true);
  const [publicCompanyPage, setPublicCompanyPage] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [enterpriseAccountManagerName, setEnterpriseAccountManagerName] = useState("");
  const [enterpriseAccountManagerEmail, setEnterpriseAccountManagerEmail] = useState("");
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(false);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#111111");
  const [customDomain, setCustomDomain] = useState("");
  const [careersPageHeadline, setCareersPageHeadline] = useState("");
  const [slaTier, setSlaTier] = useState("Enterprise");
  const [slaUptimeTarget, setSlaUptimeTarget] = useState("99.9%");
  const [slaResponseTimeHours, setSlaResponseTimeHours] = useState("4");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<EmployerTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamRefreshing, setTeamRefreshing] = useState(false);
  const [teamBusyId, setTeamBusyId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<EmployerTeamMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<EmployerMembershipRole>("recruiter");
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  function handleFeedbackOpenChange(open: boolean) {
    if (!open && feedback.open && feedback.title === "Settings saved") {
      setFeedbackOpen(false);
      navigate("/employer/dashboard");
      return;
    }

    setFeedbackOpen(open);
  }

  useEffect(() => {
    if (!profile) return;

    setCompanyName(profile.company_name ?? "");
    setIndustry(profile.industry ?? "");
    setCompanySize(profile.company_size ?? "");
    setDescription(profile.description ?? "");
    setWebsite(profile.website ?? "");
    setContactEmail(profile.contact_email ?? user?.email ?? "");
    setPhone(profile.phone ?? "");
    setAddress(profile.address ?? "");
    setShowOnPlatform(profile.show_on_platform ?? true);
    setPublicCompanyPage(profile.public_company_page ?? true);
    setLogoUrl(profile.logo_url ?? null);
    setBannerImageUrl(profile.banner_image_url ?? null);
    setEnterpriseAccountManagerName(String(profile.enterprise_account_manager_name ?? "").trim());
    setEnterpriseAccountManagerEmail(String(profile.enterprise_account_manager_email ?? "").trim());
    setWhiteLabelEnabled(Boolean(profile.white_label_enabled));
    setBrandPrimaryColor(String(profile.brand_primary_color ?? "#111111").trim() || "#111111");
    setCustomDomain(String(profile.custom_domain ?? "").trim());
    setCareersPageHeadline(String(profile.careers_page_headline ?? "").trim());
    setSlaTier(String(profile.sla_tier ?? "Enterprise").trim() || "Enterprise");
    setSlaUptimeTarget(String(profile.sla_uptime_target ?? "99.9%").trim() || "99.9%");
    setSlaResponseTimeHours(String(profile.sla_response_time_hours ?? "4").trim() || "4");
  }, [profile, user?.email]);

  async function loadTeamMembers(showLoader = true) {
    try {
      if (showLoader) {
        setTeamLoading(true);
      } else {
        setTeamRefreshing(true);
      }

      const members = await getEmployerTeamMembers();
      setTeamMembers(members);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't load team members right now.";
      showFeedback("Unable to load team", message);
    } finally {
      setTeamLoading(false);
      setTeamRefreshing(false);
    }
  }

  useEffect(() => {
    if (!user || activeTab !== "team") return;
    void loadTeamMembers();
  }, [activeTab, user?.id]);

  async function handleSaveCompanySettings() {
    try {
      setSaving(true);
      await updateEmployerProfile({
        company_name: companyName.trim() || undefined,
        industry: industry.trim() || null,
        company_size: companySize.trim() || null,
        description: description.trim() || null,
        website: website.trim() || null,
        contact_email: contactEmail.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url: logoUrl,
        banner_image_url: bannerImageUrl,
        show_on_platform: showOnPlatform,
        public_company_page: publicCompanyPage,
        enterprise_account_manager_name: enterpriseAccountManagerName.trim() || null,
        enterprise_account_manager_email: enterpriseAccountManagerEmail.trim() || null,
        white_label_enabled: whiteLabelEnabled,
        brand_primary_color: brandPrimaryColor.trim() || null,
        custom_domain: customDomain.trim() || null,
        careers_page_headline: careersPageHeadline.trim() || null,
        sla_tier: slaTier.trim() || null,
        sla_uptime_target: slaUptimeTarget.trim() || null,
        sla_response_time_hours: Number.isFinite(Number(slaResponseTimeHours)) ? Number(slaResponseTimeHours) : null,
      });

      showFeedback(
        "Settings saved",
        "Your company settings were saved successfully.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't save settings right now.";
      showFeedback("Unable to save settings", message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    try {
      setUploadingLogo(true);
      const url = await uploadEmployerLogo(file);
      setLogoUrl(url);
      showFeedback("Logo uploaded", "Your company logo has been uploaded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't upload your logo right now.";
      showFeedback("Logo upload failed", message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleBannerUpload(file: File) {
    try {
      setUploadingBanner(true);
      const url = await uploadEmployerBanner(file);
      setBannerImageUrl(url);
      showFeedback("Banner uploaded", "Your employer banner has been uploaded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't upload your banner right now.";
      showFeedback("Banner upload failed", message);
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleInviteMember() {
    try {
      setTeamBusyId("invite");
      await inviteEmployerTeamMember({
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteRole("recruiter");
      await loadTeamMembers(false);
      showFeedback("Invite created", "The team member has been added to your workspace.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't invite this team member right now.";
      showFeedback("Invite failed", message === "TEAM_MEMBER_LIMIT_REACHED" ? "Your current plan has no free seats left." : message);
    } finally {
      setTeamBusyId(null);
    }
  }

  async function handleRoleChange(memberId: string, role: EmployerMembershipRole) {
    try {
      setTeamBusyId(memberId);
      await updateEmployerTeamMember(memberId, { role, status: "active" });
      await loadTeamMembers(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't update this team member.";
      showFeedback("Update failed", message);
    } finally {
      setTeamBusyId(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      setTeamBusyId(memberId);
      await revokeEmployerTeamMember(memberId);
      await loadTeamMembers(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't remove this team member.";
      showFeedback("Remove failed", message);
    } finally {
      setTeamBusyId(null);
      setMemberToRemove(null);
    }
  }

  const normalizedPlan = String(profile?.plan ?? "free").toLowerCase();
  const planSeatLimit =
    normalizedPlan === "starter" ? 2 :
    normalizedPlan === "professional" ? 5 :
    normalizedPlan === "enterprise" ? 50 :
    1;
  const showTeamTab = normalizedPlan !== "free";
  const isEnterprisePlan = normalizedPlan === "enterprise";
  const seatsUsed = teamMembers.filter((member) => member.status === "active" || member.status === "invited").length;
  const seatsAvailable = Math.max(planSeatLimit - seatsUsed, 0);
  const currentMember = teamMembers.find((member) => member.isCurrentUser) ?? null;
  const canManageTeam = currentMember?.role === "owner" || currentMember?.role === "admin";

  useEffect(() => {
    if (!showTeamTab && activeTab === "team") {
      setActiveTab("company");
    }
    if (!isEnterprisePlan && activeTab === "enterprise") {
      setActiveTab("company");
    }
  }, [activeTab, isEnterprisePlan, showTeamTab]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <CircularLoader size="md" label="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-gray-100/60 to-gray-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-950/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage your account and company preferences</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8 bg-gray-100/80 p-1 backdrop-blur dark:bg-neutral-900 dark:border dark:dark:border-white/10">
            <TabsTrigger value="company" className="data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white">
              <Building2 className="w-4 h-4 mr-2" />
              Company Profile
            </TabsTrigger>
            {showTeamTab ? (
              <TabsTrigger value="team" className="data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-2" />
                Team
              </TabsTrigger>
            ) : null}
            {isEnterprisePlan ? (
              <TabsTrigger value="enterprise" className="data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Enterprise
              </TabsTrigger>
            ) : null}
          </TabsList>

          {/* Company Profile Tab */}
          <TabsContent value="company">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 border-gray-200 shadow-md">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Company Information</h3>
                  
                  {/* Company Logo */}
                  <div className="mb-6 pb-6 border-b border-gray-200">
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">Company Logo</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="w-20 h-20 border-2 border-gray-200">
                        {logoUrl ? <AvatarImage src={logoUrl} alt="Company logo" /> : null}
                        <AvatarFallback className="bg-gradient-to-br from-neutral-900 to-neutral-700 text-white text-2xl font-bold">
                          {companyName?.trim()?.charAt(0)?.toUpperCase() || "C"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <label className="inline-flex items-center gap-2 mb-2 px-3 py-2 border border-gray-300 rounded-md text-sm cursor-pointer hover:bg-gray-50">
                          <Upload className="w-4 h-4" />
                          {uploadingLogo ? "Uploading..." : "Upload New Logo"}
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
                        <p className="text-xs text-gray-500">
                          Recommended size: 400x400px. Max file size: 2MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="company-name" className="text-sm font-medium text-gray-700">
                        Company Name
                      </Label>
                      <Input 
                        id="company-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="mt-2 border-gray-300"
                      />
                    </div>

                    <div>
                      <Label htmlFor="industry" className="text-sm font-medium text-gray-700">
                        Industry
                      </Label>
                      <Input 
                        id="industry"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="mt-2 border-gray-300"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company-size" className="text-sm font-medium text-gray-700">
                        Company Size
                      </Label>
                      <Input 
                        id="company-size"
                        value={companySize}
                        onChange={(e) => setCompanySize(e.target.value)}
                        className="mt-2 border-gray-300"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                        Company Description
                      </Label>
                      <Textarea 
                        id="description"
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-2 border-gray-300"
                      />
                    </div>

                    <div>
                      <Label htmlFor="website" className="text-sm font-medium text-gray-700">
                        Website
                      </Label>
                      <div className="relative mt-2">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input 
                          id="website"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          className="pl-10 border-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-gray-200 shadow-md">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Contact Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        Contact Email
                      </Label>
                      <div className="relative mt-2">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input 
                          id="email"
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="pl-10 border-gray-300"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                        Phone Number
                      </Label>
                      <div className="relative mt-2">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input 
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="pl-10 border-gray-300"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                        Office Address
                      </Label>
                      <div className="relative mt-2">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <Textarea 
                          id="address"
                          rows={3}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="pl-10 border-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveCompanySettings}
                    disabled={saving}
                    className="bg-gradient-to-r from-neutral-950 to-neutral-800 text-white hover:from-neutral-900 hover:to-neutral-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" className="border-gray-300">
                    Cancel
                  </Button>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card className="p-6 bg-gray-50 border-gray-200 shadow-md">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-1">Profile Complete</h4>
                      <p className="text-xs text-gray-700">
                        Your company profile is 100% complete and verified.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 border-gray-200 shadow-md">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">Profile Visibility</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Show on platform</p>
                        <p className="text-xs text-gray-500">Visible to candidates</p>
                      </div>
                      <Switch checked={showOnPlatform} onCheckedChange={setShowOnPlatform} />
                    </div>
                    {isEnterprisePlan ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Company page</p>
                          <p className="text-xs text-gray-500">Public company page</p>
                        </div>
                        <Switch checked={publicCompanyPage} onCheckedChange={setPublicCompanyPage} />
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Team Members Tab */}
          {showTeamTab ? (
          <TabsContent value="team">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 border-gray-200 shadow-md">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Team Members</h3>
                    {teamRefreshing ? <span className="text-xs text-gray-500">Refreshing...</span> : null}
                  </div>

                  <div className="mb-6 grid gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                    <Input
                      type="email"
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      disabled={!canManageTeam || teamBusyId === "invite"}
                    />
                    <select
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value as EmployerMembershipRole)}
                      disabled={!canManageTeam || teamBusyId === "invite"}
                      className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                    >
                      <option value="recruiter">Recruiter</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button
                      onClick={handleInviteMember}
                      disabled={!canManageTeam || !inviteEmail.trim() || teamBusyId === "invite"}
                      className="bg-gradient-to-r from-neutral-950 to-neutral-800 text-white hover:from-neutral-900 hover:to-neutral-700"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      {teamBusyId === "invite" ? "Inviting..." : "Invite Member"}
                    </Button>
                  </div>

                  {teamLoading ? (
                    <CircularLoader size="sm" label="Loading team..." />
                  ) : teamMembers.length === 0 ? (
                    <p className="text-sm text-gray-600">No team members yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-gradient-to-br from-neutral-900 to-neutral-700 text-white text-sm font-bold">
                              {member.name.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {member.name}
                              {member.isCurrentUser ? <span className="ml-2 text-xs text-gray-500">(You)</span> : null}
                            </p>
                            <p className="text-xs text-gray-600">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right min-w-[140px]">
                            {member.role === "owner" ? (
                              <div className="h-9 rounded-md border border-gray-200 bg-gray-100 px-3 text-sm font-medium text-gray-700 flex items-center justify-center">
                                Owner
                              </div>
                            ) : (
                              <select
                                value={member.role}
                                onChange={(event) => void handleRoleChange(member.id, event.target.value as EmployerMembershipRole)}
                                disabled={!canManageTeam || teamBusyId === member.id}
                                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                              >
                                <option value="admin">Admin</option>
                                <option value="recruiter">Recruiter</option>
                              </select>
                            )}
                            <p className={`mt-1 text-xs ${member.status === "active" ? "text-emerald-600" : member.status === "invited" ? "text-amber-600" : "text-gray-500"}`}>
                              {member.status === "invited" ? "Pending invite" : member.status === "revoked" ? "Revoked" : "Active"}
                            </p>
                          </div>
                          {member.role === "owner" ? null : (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!canManageTeam || teamBusyId === member.id}
                              onClick={() => setMemberToRemove(member)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-6 border-gray-200 shadow-md">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Roles & Permissions</h3>
                  <div className="space-y-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-gray-900">Admin</h4>
                        <span className="text-xs text-gray-500">Full access</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Can manage all settings, team members, billing, and job postings
                      </p>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-gray-900">Recruiter</h4>
                        <span className="text-xs text-gray-500">Limited access</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Can post jobs, review candidates, and schedule interviews
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="p-6 border-gray-200 shadow-md">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">Team Usage</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Active Members</span>
                        <span className="text-sm font-bold text-gray-900">{seatsUsed} / {planSeatLimit}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-neutral-900 to-neutral-700"
                          style={{ width: `${Math.min(100, Math.round((seatsUsed / Math.max(planSeatLimit, 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">{seatsAvailable} seat{seatsAvailable === 1 ? "" : "s"} available</p>
                  </div>
                </Card>

                <Card className="p-6 bg-gray-50 border-gray-200 shadow-md">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">Need More Seats?</h4>
                  <p className="text-xs text-gray-700 mb-4">
                    Upgrade your plan to add more team members
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-gray-300 bg-white"
                    onClick={() => navigate("/employer/plans")}
                  >
                    View Plans
                  </Button>
                </Card>
              </div>
            </div>
          </TabsContent>
          ) : null}

          {isEnterprisePlan ? (
          <TabsContent value="enterprise">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card className="p-6 border-gray-200 shadow-md dark:border-white/10 dark:bg-neutral-900">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Enterprise Support</h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Store the account management and SLA details tied to this employer workspace.
                      </p>
                    </div>
                    <Badge variant="secondary" className={isEnterprisePlan ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-700 border-gray-200"}>
                      {isEnterprisePlan ? "Enterprise active" : "Upgrade required"}
                    </Badge>
                  </div>

                  {!isEnterprisePlan ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-white/10 dark:bg-neutral-950">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Enterprise controls are available on the Enterprise plan.</p>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Upgrade to manage account-manager details, SLA targets, and white-label settings in one place.
                      </p>
                      <Button className="mt-4 bg-gradient-to-r from-neutral-950 to-neutral-800 text-white hover:from-neutral-900 hover:to-neutral-700" onClick={() => navigate("/employer/plans")}>
                        View Enterprise Plan
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Account manager name</Label>
                        <Input className="mt-2 border-gray-300 dark:border-white/10" value={enterpriseAccountManagerName} onChange={(e) => setEnterpriseAccountManagerName(e.target.value)} placeholder="e.g. Sarah Mokoena" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Account manager email</Label>
                        <Input className="mt-2 border-gray-300 dark:border-white/10" value={enterpriseAccountManagerEmail} onChange={(e) => setEnterpriseAccountManagerEmail(e.target.value)} placeholder="support@apexsight.co.za" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">SLA tier</Label>
                        <Input className="mt-2 border-gray-300 dark:border-white/10" value={slaTier} onChange={(e) => setSlaTier(e.target.value)} placeholder="Enterprise" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">SLA uptime target</Label>
                        <Input className="mt-2 border-gray-300 dark:border-white/10" value={slaUptimeTarget} onChange={(e) => setSlaUptimeTarget(e.target.value)} placeholder="99.9%" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Initial response time (hours)</Label>
                        <Input className="mt-2 border-gray-300 dark:border-white/10" type="number" min="1" value={slaResponseTimeHours} onChange={(e) => setSlaResponseTimeHours(e.target.value)} />
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="p-6 border-gray-200 shadow-md dark:border-white/10 dark:bg-neutral-900">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">White-label Options</h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Control the brand settings used when your company appears across the product.
                      </p>
                    </div>
                    <Switch checked={whiteLabelEnabled} onCheckedChange={setWhiteLabelEnabled} disabled={!isEnterprisePlan} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Banner image</Label>
                      <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-neutral-950">
                        {bannerImageUrl ? (
                          <img src={bannerImageUrl} alt="Employer banner preview" className="h-40 w-full object-cover" />
                        ) : (
                          <div className="flex h-40 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                            No banner uploaded yet
                          </div>
                        )}
                      </div>
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-950 dark:hover:bg-neutral-900">
                        <Upload className="h-4 w-4" />
                        {uploadingBanner ? "Uploading..." : "Upload Banner"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          disabled={!isEnterprisePlan || !whiteLabelEnabled || uploadingBanner}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            void handleBannerUpload(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand primary color</Label>
                      <div className="mt-2 flex items-center gap-3">
                        <Input className="h-11 w-16 border-gray-300 p-1 dark:border-white/10" type="color" value={brandPrimaryColor} onChange={(e) => setBrandPrimaryColor(e.target.value)} disabled={!isEnterprisePlan || !whiteLabelEnabled} />
                        <Input className="border-gray-300 dark:border-white/10" value={brandPrimaryColor} onChange={(e) => setBrandPrimaryColor(e.target.value)} disabled={!isEnterprisePlan || !whiteLabelEnabled} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom domain</Label>
                      <Input className="mt-2 border-gray-300 dark:border-white/10" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="careers.yourcompany.com" disabled={!isEnterprisePlan || !whiteLabelEnabled} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Careers page headline</Label>
                      <Input className="mt-2 border-gray-300 dark:border-white/10" value={careersPageHeadline} onChange={(e) => setCareersPageHeadline(e.target.value)} placeholder="Join the team building the future of banking" disabled={!isEnterprisePlan || !whiteLabelEnabled} />
                    </div>
                  </div>
                </Card>

              </div>

              <div className="space-y-6">
                <Card className="p-6 border-gray-200 shadow-md dark:border-white/10 dark:bg-neutral-900">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Enterprise Feature Summary</h4>
                  <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-neutral-950">
                      <p className="font-medium text-gray-900 dark:text-white">Dedicated account manager</p>
                      <p className="mt-1">{enterpriseAccountManagerName || "No manager assigned yet."}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-neutral-950">
                      <p className="font-medium text-gray-900 dark:text-white">White-label status</p>
                      <p className="mt-1">{whiteLabelEnabled ? "Brand customization enabled" : "Brand customization disabled"}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-neutral-950">
                      <p className="font-medium text-gray-900 dark:text-white">SLA target</p>
                      <p className="mt-1">{slaUptimeTarget} uptime, {slaResponseTimeHours || "4"} hour initial response</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-gray-50 border-gray-200 shadow-md dark:border-white/10 dark:bg-neutral-900">
                  <h4 className="text-sm font-bold text-gray-900 mb-2 dark:text-white">Need a higher-touch setup?</h4>
                  <p className="text-xs text-gray-700 mb-4 dark:text-gray-400">
                    Use this tab to keep enterprise account details, brand settings, and integration needs in one place.
                  </p>
                  {!isEnterprisePlan ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-gray-300 bg-white dark:border-white/10 dark:bg-neutral-950"
                      onClick={() => navigate("/employer/plans")}
                    >
                      Upgrade to Enterprise
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-neutral-950 to-neutral-800 text-white hover:from-neutral-900 hover:to-neutral-700"
                      onClick={handleSaveCompanySettings}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Enterprise Settings"}
                    </Button>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>
          ) : null}

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <div className="max-w-3xl">
              <Card className="p-6 border-gray-200 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Email Notifications</h3>
                <div className="space-y-5">
                  <NotificationToggle 
                    title="New Applicants"
                    description="Get notified when candidates apply to your jobs"
                    defaultChecked={true}
                  />
                  <NotificationToggle 
                    title="Application Updates"
                    description="Status changes for candidate applications"
                    defaultChecked={true}
                  />
                  <NotificationToggle 
                    title="Interview Reminders"
                    description="Reminders for scheduled interviews"
                    defaultChecked={true}
                  />
                  <NotificationToggle 
                    title="Weekly Summary"
                    description="Weekly report of hiring activities"
                    defaultChecked={false}
                  />
                  <NotificationToggle 
                    title="Product Updates"
                    description="New features and platform updates"
                    defaultChecked={true}
                  />
                </div>
              </Card>

              <Card className="p-6 border-gray-200 shadow-md mt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">In-App Notifications</h3>
                <div className="space-y-5">
                  <NotificationToggle 
                    title="Browser Notifications"
                    description="Show desktop notifications for important updates"
                    defaultChecked={true}
                  />
                  <NotificationToggle 
                    title="Sound Alerts"
                    description="Play sound for new notifications"
                    defaultChecked={false}
                  />
                </div>
              </Card>

              <div className="mt-6">
                <Button className="bg-gradient-to-r from-neutral-950 to-neutral-800 text-white hover:from-neutral-900 hover:to-neutral-700">
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="max-w-3xl space-y-6">
              <Card className="p-6 border-gray-200 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="current-password" className="text-sm font-medium text-gray-700">
                      Current Password
                    </Label>
                    <Input 
                      id="current-password"
                      type="password"
                      className="mt-2 border-gray-300"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">
                      New Password
                    </Label>
                    <Input 
                      id="new-password"
                      type="password"
                      className="mt-2 border-gray-300"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                      Confirm New Password
                    </Label>
                    <Input 
                      id="confirm-password"
                      type="password"
                      className="mt-2 border-gray-300"
                    />
                  </div>
                  <Button className="bg-gradient-to-r from-neutral-950 to-neutral-800 text-white hover:from-neutral-900 hover:to-neutral-700">
                    <Lock className="w-4 h-4 mr-2" />
                    Update Password
                  </Button>
                </div>
              </Card>

              <Card className="p-6 border-gray-200 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Two-Factor Authentication</h3>
                <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200 mb-4">
                  <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-1">2FA Enabled</p>
                    <p className="text-xs text-gray-600">
                      Your account is protected with two-factor authentication
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="border-gray-300">
                  <Key className="w-4 h-4 mr-2" />
                  Manage 2FA Settings
                </Button>
              </Card>

              <Card className="p-6 border-gray-200 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Active Sessions</h3>
                <div className="space-y-3">
                  {[
                    { device: "Chrome on Windows", location: "Johannesburg, South Africa", current: true, lastActive: "Active now" },
                    { device: "Safari on iPhone", location: "Cape Town, South Africa", current: false, lastActive: "2 hours ago" }
                  ].map((session, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {session.device}
                          {session.current && <span className="ml-2 text-xs text-emerald-600">(This device)</span>}
                        </p>
                        <p className="text-xs text-gray-600">{session.location}</p>
                        <p className="text-xs text-gray-500">{session.lastActive}</p>
                      </div>
                      {!session.current && (
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 bg-red-50 border-red-200 shadow-md">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900 mb-1">Danger Zone</h4>
                    <p className="text-xs text-gray-700 mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-100">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <FeedbackDialog
        open={feedback.open}
        title={feedback.title}
        description={feedback.description}
        onOpenChange={handleFeedbackOpenChange}
      />
      <AlertDialog open={Boolean(memberToRemove)} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove
                ? `This will remove ${memberToRemove.name} from your workspace and revoke their access immediately.`
                : "This will remove the team member from your workspace and revoke their access immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(memberToRemove && teamBusyId === memberToRemove.id)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!memberToRemove) return;
                void handleRemoveMember(memberToRemove.id);
              }}
              disabled={Boolean(memberToRemove && teamBusyId === memberToRemove.id)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {memberToRemove && teamBusyId === memberToRemove.id ? "Removing..." : "Remove member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NotificationToggle({ title, description, defaultChecked }: { title: string; description: string; defaultChecked: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
