import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Building2, ExternalLink, Globe, MapPin, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { getPublicEmployerProfile } from "@/lib/candidate";

type EmployerJob = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  created_at: string;
  is_featured?: boolean;
  experience_level?: string | null;
};

type EmployerPublicProfileData = {
  employer: {
    id: string;
    company_name: string;
    plan?: string | null;
    industry: string | null;
    company_size: string | null;
    description: string | null;
    website: string | null;
    address: string | null;
    logo_url: string | null;
    banner_image_url: string | null;
    brand_primary_color: string | null;
    custom_domain: string | null;
    careers_page_headline: string | null;
    enterprise_account_manager_name: string | null;
    enterprise_account_manager_email: string | null;
    sla_tier: string | null;
    sla_uptime_target: string | null;
    sla_response_time_hours: number | null;
  };
  jobs: EmployerJob[];
};

export function EmployerPublicProfilePage() {
  const navigate = useNavigate();
  const { employerId } = useParams<{ employerId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EmployerPublicProfileData | null>(null);
  const [jobSearch, setJobSearch] = useState("");

  useEffect(() => {
    if (!employerId) {
      setLoading(false);
      return;
    }

    getPublicEmployerProfile(employerId)
      .then((result) => setData(result as EmployerPublicProfileData | null))
      .catch((error) => {
        console.error("Failed to load employer public profile", error);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [employerId]);

  const brandColor = data?.employer.brand_primary_color ?? "#111111";
  const careersSiteUrl = useMemo(() => {
    const raw = String(data?.employer.custom_domain ?? "").trim();
    if (!raw) return null;
    return `https://${raw.replace(/^https?:\/\//i, "")}`;
  }, [data?.employer.custom_domain]);
  const visibleJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    if (!query) return data?.jobs ?? [];
    return (data?.jobs ?? []).filter((job) =>
      job.title.toLowerCase().includes(query) ||
      String(job.location ?? "").toLowerCase().includes(query) ||
      String(job.employment_type ?? "").toLowerCase().includes(query) ||
      String(job.experience_level ?? "").toLowerCase().includes(query),
    );
  }, [data?.jobs, jobSearch]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <CircularLoader size="md" label="Loading company profile..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Company profile unavailable</h1>
          <p className="mt-3 text-sm text-gray-600">
            This employer profile is not currently available to candidates.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => navigate("/candidate/jobs")}>
            Back to jobs
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <section
        className="border-b border-black/5"
        style={{ background: `linear-gradient(135deg, ${brandColor}18 0%, #ffffff 65%)` }}
      >
        {data.employer.banner_image_url ? (
          <div className="h-56 w-full overflow-hidden border-b border-black/5 bg-black/5 sm:h-72">
            <img
              src={data.employer.banner_image_url}
              alt={`${data.employer.company_name} banner`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex items-start gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
                  style={!data.employer.logo_url ? { backgroundColor: brandColor } : undefined}
                >
                  {data.employer.logo_url ? (
                    <img src={data.employer.logo_url} alt={`${data.employer.company_name} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-8 w-8 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-[-0.04em] text-gray-900">{data.employer.company_name}</h1>
                    {data.jobs.length > 0 ? (
                      <Badge variant="secondary">{data.jobs.length} open role{data.jobs.length === 1 ? "" : "s"}</Badge>
                    ) : null}
                  </div>
                  {data.employer.careers_page_headline ? (
                    <p className="mt-3 max-w-3xl text-lg text-gray-700">{data.employer.careers_page_headline}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                    {data.employer.industry ? <span>{data.employer.industry}</span> : null}
                    {data.employer.company_size ? <span>{data.employer.company_size} employees</span> : null}
                    {data.employer.address ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {data.employer.address}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {data.employer.description ? (
                <p className="mt-8 max-w-4xl text-base leading-8 text-gray-700">{data.employer.description}</p>
              ) : null}
            </div>

            <Card className="border-black/8 bg-white/80 p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Company Links</h2>
              <div className="mt-4 space-y-3">
                {careersSiteUrl ? (
                  <Button className="w-full justify-start" variant="outline" onClick={() => window.open(careersSiteUrl, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Visit careers site
                  </Button>
                ) : null}
                {data.employer.website ? (
                  <Button className="w-full justify-start" variant="outline" onClick={() => window.open(data.employer.website!, "_blank", "noopener,noreferrer")}>
                    <Globe className="mr-2 h-4 w-4" />
                    Company website
                  </Button>
                ) : null}
                <Button className="w-full justify-start" onClick={() => navigate("/candidate/jobs")}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Browse roles
                </Button>
              </div>

              {(data.employer.sla_tier || data.employer.sla_uptime_target || data.employer.enterprise_account_manager_name) ? (
                <div className="mt-6 rounded-2xl border border-black/8 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <ShieldCheck className="h-4 w-4" />
                    Enterprise support
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    {data.employer.enterprise_account_manager_name ? (
                      <p>Account manager: {data.employer.enterprise_account_manager_name}</p>
                    ) : null}
                    {data.employer.sla_tier || data.employer.sla_uptime_target ? (
                      <p>
                        {data.employer.sla_tier || "Enterprise"}
                        {data.employer.sla_uptime_target ? ` • ${data.employer.sla_uptime_target} uptime target` : ""}
                      </p>
                    ) : null}
                    {data.employer.sla_response_time_hours ? (
                      <p>{data.employer.sla_response_time_hours} hour initial response target</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Open roles</h2>
            <p className="mt-1 text-sm text-gray-600">Explore current opportunities from this employer.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={jobSearch}
              onChange={(event) => setJobSearch(event.target.value)}
              placeholder="Search roles, locations, or levels"
              className="pl-9"
            />
          </div>
        </div>

        {visibleJobs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-gray-600">
              {data.jobs.length === 0
                ? "There are no public open roles for this employer right now."
                : "No roles match your search yet."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleJobs.map((job) => (
              <Card key={job.id} className="border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                      {job.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {job.location}
                        </span>
                      ) : null}
                      {job.employment_type ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Briefcase className="h-4 w-4" />
                          {job.employment_type}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {job.is_featured ? <Badge>Featured</Badge> : null}
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-7 text-gray-600">{job.description}</p>

                <div className="mt-5 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/candidate/jobs?job=${job.id}`)}
                  >
                    View role
                  </Button>
                  <Button
                    className="flex-1 text-white"
                    style={{ backgroundColor: brandColor }}
                    onClick={() => navigate(`/candidate/jobs?job=${job.id}&autoApply=1`)}
                  >
                    Apply
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
