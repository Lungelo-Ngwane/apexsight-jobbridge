import { useState } from 'react';
import { MapPin, Briefcase, Clock } from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import type { Job } from '@/app/types/job';
import { applyForJob } from '@/lib/candidate';
import { formatDistanceToNow } from 'date-fns';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRecent =
    Date.now() - new Date(job.created_at).getTime() <
    1000 * 60 * 60 * 24 * 7;

  const postedDate = formatDistanceToNow(
    new Date(job.created_at),
    { addSuffix: true }
  );

  const handleApply = async () => {
    try {
      setIsApplying(true);
      setError(null);

      await applyForJob(job.id);

      setApplied(true); // optimistic UI
    } catch (err: any) {
      setError(err.message ?? 'Failed to apply');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card className="rounded-2xl border border-gray-200 bg-white hover:shadow-lg transition-all">
      <div className="p-6">
        <div className="flex gap-4">
          {/* Logo placeholder */}
          <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center font-semibold text-gray-500">
            {job.employer.company_name.charAt(0)}
          </div>

          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <div>
                <h3 className="text-lg font-semibold">{job.title}</h3>
                <p className="text-sm text-gray-600">
                  {job.employer.company_name}
                </p>
              </div>

              {isRecent && (
                <Badge className="bg-green-100 text-green-700">
                  <Clock className="h-3 w-3 mr-1" />
                  New
                </Badge>
              )}
            </div>

            <div className="flex gap-4 text-sm text-gray-600 mb-3">
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </span>
              )}
              {job.employment_type && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {job.employment_type}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 line-clamp-2 mb-4">
              {job.description}
            </p>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Posted {postedDate}
              </span>

              <Button
                onClick={handleApply}
                disabled={isApplying || applied}
                className={`rounded-lg px-6 ${
                  applied
                    ? 'bg-green-600 hover:bg-green-600'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {applied
                  ? 'Applied'
                  : isApplying
                  ? 'Applying...'
                  : 'Apply Now'}
              </Button>
            </div>

            {error && (
              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
