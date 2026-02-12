
import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/app/components/Header';
import { SearchBar } from '@/app/components/SearchBar';
import { JobCard, Job } from '@/app/components/JobCard';
import { FilterSidebar } from '@/app/components/FilterSidebar';
import { Button } from '@/app/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getOpenJobs } from '@/lib/candidate';

const JOBS_PER_PAGE = 6;

export interface Job {
  id: string;
  title: string;
  description: string;
  location: string | null;
  employment_type: string | null;
  created_at: string;
  employer: {
    company_name: string;
  };
}

export default function CandidateJobsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOpenJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }, []);

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        job.title.toLowerCase().includes(searchLower) ||
        job.employer.company_name.toLowerCase().includes(searchLower) ||
        (job.location ?? '').toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower);

      // Employment type filter
      const matchesType =
        selectedTypes.length === 0 ||
        selectedTypes.includes(job.employment_type ?? '');

      return matchesSearch && matchesType;
    });
  }, [jobs, searchQuery, selectedTypes]);

  console.log('Filtered Jobs:', jobs);

  // Pagination
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const endIndex = startIndex + JOBS_PER_PAGE;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleTypeChange = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SearchBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onFilterToggle={() => setShowMobileFilters(!showMobileFilters)}
        showMobileFilters={showMobileFilters}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-8 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <FilterSidebar
                selectedTypes={selectedTypes}
                onTypeChange={handleTypeChange}
              />
            </div>
          </aside>

          {/* Mobile Filters Overlay */}
          {showMobileFilters && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setShowMobileFilters(false)}
              />
              <div className="absolute inset-y-0 right-0 w-80 max-w-full bg-white shadow-xl">
                <FilterSidebar
                  selectedTypes={selectedTypes}
                  onTypeChange={handleTypeChange}
                  onClose={() => setShowMobileFilters(false)}
                  isMobile
                />
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1">
            {/* Results Count */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                {filteredJobs.length === 0 ? 'No jobs found' : `${filteredJobs.length} jobs found`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} results
              </p>
            </div>

            {/* Job List */}
            <div className="space-y-4">
              {currentJobs.length > 0 ? (
                currentJobs.map((job) => <JobCard key={job.id} job={job} />)
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                  <p className="text-gray-600">No jobs match your search criteria.</p>
                  <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or search terms.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      onClick={() => handlePageChange(page)}
                      className={`rounded-lg w-10 h-10 p-0 ${currentPage === page
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : ''
                        }`}
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
