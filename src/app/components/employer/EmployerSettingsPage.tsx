import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
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
import { useEmployerProfile } from "@/hooks/useEmployerProfile";
import { updateEmployerProfile, uploadEmployerLogo } from "@/lib/employer";
import { useAuth } from "@/app/context/AuthContext";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { CircularLoader } from "@/app/components/ui/circular-loader";

export function EmployerSettingsPage() {
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

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
  }, [profile, user?.email]);

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
        show_on_platform: showOnPlatform,
        public_company_page: publicCompanyPage,
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

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <CircularLoader size="md" label="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
            <p className="text-sm text-gray-600">Manage your account and company preferences</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8 bg-gray-100/80 backdrop-blur p-1">
            <TabsTrigger value="company" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Building2 className="w-4 h-4 mr-2" />
              Company Profile
            </TabsTrigger>
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
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-2xl font-bold">
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
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
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
                <Card className="p-6 bg-blue-50 border-blue-200 shadow-md">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Company page</p>
                        <p className="text-xs text-gray-500">Public company page</p>
                      </div>
                      <Switch checked={publicCompanyPage} onCheckedChange={setPublicCompanyPage} />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Team Members Tab */}
          <TabsContent value="team">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 border-gray-200 shadow-md">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Team Members</h3>
                    <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
                      <Users className="w-4 h-4 mr-2" />
                      Invite Member
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {[
                      { name: "Sarah Motloung", email: "sarah.m@nedbank.co.za", role: "Admin", status: "Active" },
                      { name: "John Khumalo", email: "john.k@nedbank.co.za", role: "Recruiter", status: "Active" },
                      { name: "Thandi Dlamini", email: "thandi.d@nedbank.co.za", role: "Recruiter", status: "Active" }
                    ].map((member, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm font-bold">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-600">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{member.role}</p>
                            <p className="text-xs text-emerald-600">{member.status}</p>
                          </div>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
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
                        <span className="text-sm font-bold text-gray-900">3 / 5</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full" style={{ width: '60%' }} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">2 seats available</p>
                  </div>
                </Card>

                <Card className="p-6 bg-purple-50 border-purple-200 shadow-md">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">Need More Seats?</h4>
                  <p className="text-xs text-gray-700 mb-4">
                    Upgrade your plan to add more team members
                  </p>
                  <Button variant="outline" size="sm" className="w-full border-gray-300 bg-white">
                    View Plans
                  </Button>
                </Card>
              </div>
            </div>
          </TabsContent>

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
                <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
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
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
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
        onOpenChange={setFeedbackOpen}
      />
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
