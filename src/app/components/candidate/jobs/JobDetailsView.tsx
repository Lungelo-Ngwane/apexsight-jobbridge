import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import {
ArrowLeft,
Bookmark,
Briefcase,
Building2,
CheckCircle,
Clock,
ExternalLink,
Gauge,
Globe,
MapPin
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../../context/ThemeContext";

import type { Job } from "./types";
export function JobDetailsView({
  job,
  onBack,
  onSave,
  isSaved,
  onApply,
  isApplying,
  hasApplied,
}: {
  job: Job;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
  onApply: () => void;
  isApplying: boolean;
  hasApplied: boolean;
}) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [logoBroken, setLogoBroken] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const brandColor = job.employer.brand_primary_color ?? "#111111";
  const companyProfileEnabled =
    job.employer.public_company_page !== false &&
    String(job.employer.plan ?? "free").toLowerCase() === "enterprise";
  const customDomainHref = job.employer.custom_domain
    ? `https://${String(job.employer.custom_domain).replace(/^https?:\/\//i, "").trim()}`
    : null;
  const featuredActive =
    Boolean(job.is_featured) &&
    (!job.featured_until || new Date(job.featured_until).getTime() > Date.now());
  const descriptionText = String(job.description ?? "").trim();
  const descriptionNeedsExpand = descriptionText.length > 520;
  const visibleDescription = descriptionNeedsExpand && !showFullDescription
    ? `${descriptionText.slice(0, 520).trimEnd()}...`
    : descriptionText;
  const postedDate = (() => {
    const createdAt = new Date(job.created_at);
    const diffMs = Date.now() - createdAt.getTime();

    if (Number.isNaN(createdAt.getTime()) || diffMs < 0) {
      return "recently";
    }

    const dayMs = 1000 * 60 * 60 * 24;
    const weekMs = dayMs * 7;
    const monthMs = dayMs * 30;

    if (diffMs < weekMs) {
      const days = Math.max(1, Math.floor(diffMs / dayMs));
      return `${days} day${days === 1 ? "" : "s"} ago`;
    }

    if (diffMs < monthMs) {
      const weeks = Math.max(1, Math.floor(diffMs / weekMs));
      return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    }

    const months = Math.max(1, Math.floor(diffMs / monthMs));
    return `${months} month${months === 1 ? "" : "s"} ago`;
  })();
  const heroBackground =
    theme === "dark"
      ? `linear-gradient(135deg, ${brandColor}24 0%, rgba(255,255,255,0.02) 38%, rgba(10,10,11,0) 100%)`
      : `linear-gradient(135deg, ${brandColor}10 0%, rgba(255,255,255,0) 55%)`;
  const quickActionBackground =
    theme === "dark"
      ? `linear-gradient(180deg, ${brandColor}22 0%, rgba(24,24,27,0.98) 36%, rgba(9,9,11,1) 100%)`
      : `linear-gradient(180deg, ${brandColor}16 0%, #ffffff 42%, #ffffff 100%)`;

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return "Salary not disclosed";
    const format = (num: number) => `${(num / 1000).toFixed(0)}k`;
    if (min && max) return `${format(min)} - ${format(max)} per month`;
    if (min) return `From ${format(min)} per month`;
    if (max) return `Up to ${format(max)} per month`;
    return "Salary not disclosed";
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f7fa_0%,#f8fafc_220px,#ffffff_220px)] dark:bg-[linear-gradient(180deg,#09090b_0%,#111827_220px,#09090b_220px)]">
      <div className="sticky top-16 z-20 border-b border-gray-200 bg-white/92 backdrop-blur-lg shadow-sm dark:border-white/10 dark:bg-neutral-950/88">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onBack} className="gap-2 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white">
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to jobs</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button className="!border-emerald-700 !bg-emerald-600 !bg-none !text-white hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300" onClick={onApply} disabled={hasApplied || isApplying}>
                {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply"}
              </Button>
              <Button variant="outline" onClick={onSave} className="gap-2">
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
                <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Card className="mb-6 overflow-hidden border-gray-200/80 bg-white shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-neutral-950">
          <div
            className="border-b border-gray-200/80 px-6 py-6 sm:px-8 dark:border-white/10"
            style={{ background: heroBackground }}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 shadow-sm dark:border-white/10 dark:bg-neutral-800"
                  style={!job.employer.logo_url || logoBroken ? (job.employer.brand_primary_color ? { backgroundColor: brandColor } : undefined) : undefined}
                >
                  {job.employer.logo_url && !logoBroken ? (
                    <img
                      src={job.employer.logo_url}
                      alt={`${job.employer.company_name} logo`}
                      className="h-full w-full rounded-2xl object-cover"
                      onError={() => setLogoBroken(true)}
                    />
                  ) : (
                    <Building2 className={`h-8 w-8 ${job.employer.brand_primary_color ? "text-white" : "text-gray-500 dark:text-gray-200"}`} />
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-gray-200 bg-gray-100 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                      {job.employer.company_name}
                    </Badge>
                    {featuredActive ? (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
                        Featured role
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl dark:text-white">
                      {job.title}
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {job.location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        {job.location}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                      {job.employment_type || "Not specified"}
                    </span>
                    {job.experience_level ? (
                      <span className="flex items-center gap-1.5">
                        <Gauge className="h-4 w-4 text-gray-400" />
                        {job.experience_level}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-gray-400" />
                      Posted {postedDate}
                    </span>
                    {job.featured_until ? (
                      <span className="text-gray-500 dark:text-gray-400">
                        Featured until {new Date(job.featured_until).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Button className="w-full !border-emerald-700 !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300" onClick={onApply} disabled={hasApplied || isApplying}>
                  {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply now"}
                </Button>
                <Button variant="outline" onClick={onSave} className="w-full border-gray-300 dark:border-white/15 dark:bg-neutral-900 dark:text-white">
                  <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
                  {isSaved ? "Saved" : "Save job"}
                </Button>
                {companyProfileEnabled ? (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/companies/${job.employer_id}`)}
                    className="w-full border-gray-300 sm:col-span-2 lg:col-span-1 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Company Profile
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-950">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-950 dark:text-white">Role overview</h2>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                  {formatSalary(job.salary_min, job.salary_max)}
                </div>
              </div>
              <div className="space-y-4">
                <p className="whitespace-pre-line text-[15px] leading-7 text-gray-700 dark:text-gray-300">
                  {visibleDescription}
                </p>
                {descriptionNeedsExpand ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-gray-900 transition hover:text-black dark:text-gray-100 dark:hover:text-white"
                    onClick={() => setShowFullDescription((prev) => !prev)}
                  >
                    {showFullDescription ? "Show less" : "Read full description"}
                  </button>
                ) : null}
              </div>
            </Card>

            {job.skills_required && job.skills_required.length > 0 ? (
              <Card className="border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-950">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-950 dark:text-white">Core skills</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    The capabilities this employer is actively looking for.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {job.skills_required.map((skill, index) => (
                    <Badge
                      key={`${skill}-${index}`}
                      className="rounded-full border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                    >
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <Card
              className="border-gray-200/80 p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-neutral-950"
              style={{ background: quickActionBackground }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Quick action
              </p>
              <h3 className="mt-2 text-xl font-semibold text-gray-950 dark:text-white">Ready to apply?</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                Save the role or submit your application now while the job is still active.
              </p>
              <div className="mt-5 space-y-3">
                <Button className="w-full !border-emerald-700 !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300" onClick={onApply} disabled={hasApplied || isApplying}>
                  {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply now"}
                </Button>
                <Button variant="outline" onClick={onSave} className="w-full border-gray-300 bg-white/80 dark:border-white/15 dark:bg-neutral-900 dark:text-white">
                  <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
                  {isSaved ? "Saved" : "Save for later"}
                </Button>
              </div>
            </Card>

            <Card
              className="border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-950"
              style={{ borderTop: `4px solid ${brandColor}` }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Company
              </p>
              <h3 className="mt-2 text-xl font-semibold text-gray-950 dark:text-white">About {job.employer.company_name}</h3>
              <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                {job.employer.industry ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>{job.employer.industry}</span>
                  </div>
                ) : null}
                {job.employer.careers_page_headline ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                    {job.employer.careers_page_headline}
                  </div>
                ) : (
                  <p>Explore the company profile and active roles before deciding where to apply.</p>
                )}
              </div>
              <div className="mt-5 space-y-3">
                {companyProfileEnabled ? (
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 bg-white dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                    onClick={() => navigate(`/companies/${job.employer_id}`)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Company Profile
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full border-gray-300 bg-white dark:border-white/15 dark:bg-neutral-900 dark:text-white" disabled>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Company profile hidden
                  </Button>
                )}
                {customDomainHref ? (
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 bg-white dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                    onClick={() => window.open(customDomainHref, "_blank", "noopener,noreferrer")}
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    Visit Careers Site
                  </Button>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

