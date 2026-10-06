import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import {
Bookmark,
Briefcase,
Building2,
Clock,
Gauge,
MapPin
} from "lucide-react";
import { useState } from "react";

import type { Job } from "./types";
export function JobCard({
  job,
  onClick,
  onSave,
  isSaved,
  onApply,
  isApplying,
  hasApplied,
}: {
  job: Job;
  onClick: () => void;
  onSave: () => void;
  isSaved: boolean;
  onApply: () => void;
  isApplying: boolean;
  hasApplied: boolean;
}) {
  const [logoBroken, setLogoBroken] = useState(false);
  const featuredActive =
    Boolean(job.is_featured) &&
    (!job.featured_until || new Date(job.featured_until).getTime() > Date.now());

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return null;
    const format = (num: number) => `${(num / 1000).toFixed(0)}k`;
    if (min && max) return `${format(min)} - ${format(max)}`;
    if (min) return `From ${format(min)}`;
    if (max) return `Up to ${format(max)}`;
    return null;
  };

  const getTimeAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const salary = formatSalary(job.salary_min, job.salary_max);

  return (
    <Card className="group relative cursor-pointer overflow-hidden rounded-xl border-gray-200 bg-white transition-all duration-200 hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-neutral-900" onClick={onClick}>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/70 to-white opacity-0 transition-opacity group-hover:opacity-100 dark:from-neutral-900 dark:to-neutral-950" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 shadow-sm dark:border-white/10 dark:bg-neutral-800"
                style={!job.employer.logo_url || logoBroken ? (job.employer.brand_primary_color ? { backgroundColor: job.employer.brand_primary_color } : undefined) : undefined}
              >
                {job.employer.logo_url && !logoBroken ? (
                  <img
                    src={job.employer.logo_url}
                    alt={`${job.employer.company_name} logo`}
                    className="w-full h-full object-cover rounded-lg"
                    onError={() => setLogoBroken(true)}
                  />
                ) : (
                  <Building2 className={`h-5 w-5 ${job.employer.brand_primary_color ? "text-white" : "text-gray-500 dark:text-gray-200"}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{job.employer.company_name}</p>
                {job.employer.industry && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{job.employer.industry}</p>}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label={`${isSaved ? "Unsave" : "Save"} ${job.title}`}
            aria-pressed={isSaved}
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? "fill-blue-600 text-blue-600" : "text-gray-400"}`} />
          </button>
        </div>

        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white"><button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} className="text-left focus-visible:outline focus-visible:outline-2">{job.title}</button></h3>
          {featuredActive && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0">
              Featured
            </Badge>
          )}
        </div>

        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {job.location && (
              <>
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{job.location}</span>
                <span className="text-gray-400">|</span>
              </>
            )}
            <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{job.employment_type || "Not specified"}</span>
            {job.experience_level && (
              <>
                <span className="text-gray-400">|</span>
                <Gauge className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{job.experience_level}</span>
              </>
            )}
          </div>
          {salary && (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <span>{salary}</span>
            </div>
          )}
        </div>

        {job.skills_required && job.skills_required.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {job.skills_required.slice(0, 3).map((skill, index) => (
              <Badge key={`${job.id}-${skill}-${index}`} variant="secondary" className="border-gray-200 bg-gray-100 text-xs text-gray-700 dark:border-white/10 dark:bg-neutral-950 dark:text-gray-300">
                {skill}
              </Badge>
            ))}
            {job.skills_required.length > 3 && (
              <Badge variant="secondary" className="border-gray-200 bg-gray-100 text-xs text-gray-700 dark:border-white/10 dark:bg-neutral-950 dark:text-gray-300">
                +{job.skills_required.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            {getTimeAgo(job.created_at)}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs dark:border-white/10 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800" onClick={(e) => { e.stopPropagation(); onClick(); }}>
              View Details
            </Button>
            <Button size="sm" className="!border-emerald-700 !bg-emerald-600 !bg-none !text-white text-xs hover:!bg-emerald-700 disabled:!border-emerald-200 disabled:!bg-emerald-100 disabled:!text-emerald-700 dark:disabled:!border-emerald-400/20 dark:disabled:!bg-emerald-500/10 dark:disabled:!text-emerald-300" disabled={hasApplied || isApplying} onClick={(e) => { e.stopPropagation(); onApply(); }}>
              {hasApplied ? "Applied" : isApplying ? "Applying..." : "Apply"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

