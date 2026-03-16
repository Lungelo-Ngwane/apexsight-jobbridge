import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Briefcase, ChevronLeft, ChevronRight, MapPin, Search, Users } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { getTalentPoolCandidates, type TalentPoolCandidate } from "@/lib/employer";

type ExperienceFilter = "all" | "junior" | "mid" | "senior";
type SortKey = "name" | "experience" | "skills" | "location";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 20;

function getExperienceBand(years: number | null): ExperienceFilter {
  if (years === null || years === undefined) return "junior";
  if (years >= 6) return "senior";
  if (years >= 3) return "mid";
  return "junior";
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortCandidates(candidates: TalentPoolCandidate[], key: SortKey, direction: SortDirection) {
  const sorted = [...candidates].sort((a, b) => {
    if (key === "experience") {
      return (a.yearsExperience ?? -1) - (b.yearsExperience ?? -1);
    }
    if (key === "skills") {
      return a.skills.length - b.skills.length;
    }
    if (key === "location") {
      return compareText(a.location ?? "", b.location ?? "");
    }
    return compareText(a.fullName, b.fullName);
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

export function EmployerCandidatesPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<TalentPoolCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedExperience, setSelectedExperience] = useState<ExperienceFilter>("all");
  const [selectedSkill, setSelectedSkill] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("experience");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  useEffect(() => {
    getTalentPoolCandidates()
      .then((rows) => {
        setCandidates(rows);
        setSelectedCandidateId(rows[0]?.id ?? null);
      })
      .catch((error) => console.error("Failed to load talent pool", error))
      .finally(() => setLoading(false));
  }, []);

  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          candidates
            .map((candidate) => (candidate.location ?? "").trim())
            .filter((location) => location.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [candidates],
  );

  const skillOptions = useMemo(
    () =>
      Array.from(
        new Set(
          candidates.flatMap((candidate) =>
            candidate.skills
              .map((skill) => (skill.skill ?? "").trim())
              .filter((skill) => skill.length > 0),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [candidates],
  );

  const filteredCandidates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return candidates.filter((candidate) => {
      const normalizedSkills = candidate.skills.map((skill) => (skill.skill ?? "").toLowerCase());
      const matchesSearch =
        !query ||
        candidate.fullName.toLowerCase().includes(query) ||
        (candidate.headline ?? "").toLowerCase().includes(query) ||
        (candidate.location ?? "").toLowerCase().includes(query) ||
        (candidate.bio ?? "").toLowerCase().includes(query) ||
        normalizedSkills.some((skill) => skill.includes(query));

      const matchesLocation =
        selectedLocation === "all" ||
        (candidate.location ?? "").toLowerCase() === selectedLocation.toLowerCase();

      const matchesExperience =
        selectedExperience === "all" ||
        getExperienceBand(candidate.yearsExperience) === selectedExperience;

      const matchesSkill =
        selectedSkill === "all" ||
        normalizedSkills.some((skill) => skill === selectedSkill.toLowerCase());

      return matchesSearch && matchesLocation && matchesExperience && matchesSkill;
    });
  }, [candidates, searchTerm, selectedLocation, selectedExperience, selectedSkill]);

  const sortedCandidates = useMemo(
    () => sortCandidates(filteredCandidates, sortKey, sortDirection),
    [filteredCandidates, sortDirection, sortKey],
  );

  const pageCount = Math.max(1, Math.ceil(sortedCandidates.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedCandidates = useMemo(
    () => sortedCandidates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, sortedCandidates],
  );

  const selectedCandidate = useMemo(() => {
    const preferredId = selectedCandidateId && sortedCandidates.some((candidate) => candidate.id === selectedCandidateId)
      ? selectedCandidateId
      : pagedCandidates[0]?.id ?? sortedCandidates[0]?.id ?? null;
    return sortedCandidates.find((candidate) => candidate.id === preferredId) ?? null;
  }, [pagedCandidates, selectedCandidateId, sortedCandidates]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedLocation, selectedExperience, selectedSkill, sortKey, sortDirection]);

  useEffect(() => {
    if (selectedCandidate?.id && selectedCandidate.id !== selectedCandidateId) {
      setSelectedCandidateId(selectedCandidate.id);
    }
  }, [selectedCandidate?.id, selectedCandidateId]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "name" || nextKey === "location" ? "asc" : "desc");
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-neutral-950">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-950/90">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Browse Talent Pool</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Use filters, sorting, and pagination to work through large candidate pools without card overload.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Card className="mb-6 border-gray-200 p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search candidates, titles, locations, or skills..."
                className="pl-10 dark:border-white/10 dark:bg-neutral-950 dark:text-white"
              />
            </div>

            <select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950 dark:text-white" value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
              <option value="all">All locations</option>
              {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>

            <select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950 dark:text-white" value={selectedExperience} onChange={(event) => setSelectedExperience(event.target.value as ExperienceFilter)}>
              <option value="all">All experience</option>
              <option value="junior">Junior (0-2 years)</option>
              <option value="mid">Mid (3-5 years)</option>
              <option value="senior">Senior (6+ years)</option>
            </select>

            <select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950 dark:text-white" value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)}>
              <option value="all">All skills</option>
              {skillOptions.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
            </select>

            <Button
              type="button"
              variant="outline"
              className="dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
              onClick={() => {
                setSearchTerm("");
                setSelectedLocation("all");
                setSelectedExperience("all");
                setSelectedSkill("all");
                setSortKey("experience");
                setSortDirection("desc");
              }}
            >
              Reset
            </Button>
          </div>
        </Card>

        {loading ? (
          <Card className="border-gray-200 p-6 text-center dark:border-white/10 dark:bg-neutral-900">
            <CircularLoader size="md" label="Loading candidates..." />
          </Card>
        ) : filteredCandidates.length === 0 ? (
          <Card className="border-gray-200 p-6 text-center text-gray-500 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-400">
            No candidates match your filters.
          </Card>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="overflow-hidden border-gray-200 shadow-sm dark:border-white/10 dark:bg-neutral-900">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-white/10">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{filteredCandidates.length} candidates</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Showing {pagedCandidates.length} on page {currentPage} of {pageCount}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Sorted by</span>
                  <Badge variant="secondary">{sortKey} {sortDirection}</Badge>
                </div>
              </div>

              <div className="hidden grid-cols-[minmax(0,2.1fr)_1fr_0.8fr_1.1fr_0.9fr] gap-4 border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 dark:border-white/10 dark:text-gray-300 md:grid">
                <button type="button" className="flex items-center gap-2 text-left transition-colors hover:text-gray-900 dark:hover:text-white" onClick={() => toggleSort("name")}>Candidate <ArrowUpDown className="h-4 w-4" /></button>
                <button type="button" className="flex items-center gap-2 text-left transition-colors hover:text-gray-900 dark:hover:text-white" onClick={() => toggleSort("location")}>Location <ArrowUpDown className="h-4 w-4" /></button>
                <button type="button" className="flex items-center gap-2 text-left transition-colors hover:text-gray-900 dark:hover:text-white" onClick={() => toggleSort("experience")}>Experience <ArrowUpDown className="h-4 w-4" /></button>
                <button type="button" className="flex items-center gap-2 text-left transition-colors hover:text-gray-900 dark:hover:text-white" onClick={() => toggleSort("skills")}>Top skills <ArrowUpDown className="h-4 w-4" /></button>
                <span className="text-left">Action</span>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-white/10">
                {pagedCandidates.map((candidate) => {
                  const active = selectedCandidate?.id === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => setSelectedCandidateId(candidate.id)}
                      className={`grid w-full gap-4 px-4 py-4 text-left transition-colors md:grid-cols-[minmax(0,2.1fr)_1fr_0.8fr_1.1fr_0.9fr] ${active ? "bg-blue-50 dark:bg-blue-500/10" : "bg-white hover:bg-gray-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/70"}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">{candidate.fullName}</p>
                        <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-400">{candidate.headline ?? "Candidate"}</p>
                        <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-500 md:hidden">{candidate.bio ?? "No bio added yet."}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{candidate.location ?? "Not set"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" />
                        <span>{candidate.yearsExperience ?? 0} yrs</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.skills.slice(0, 3).map((skill) => (
                          <Badge key={`${candidate.id}-${skill.skill}`} variant="secondary" className="max-w-full truncate dark:border-white/10 dark:bg-neutral-800 dark:text-white">
                            {skill.skill}
                          </Badge>
                        ))}
                        {candidate.skills.length > 3 ? <Badge variant="outline" className="dark:border-white/10 dark:text-white">+{candidate.skills.length - 3}</Badge> : null}
                      </div>
                      <div className="flex items-center md:justify-end">
                        <Button
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className={active ? "" : "dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800"}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/employer/messages?candidate=${candidate.id}`);
                          }}
                        >
                          Message
                        </Button>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-white/10">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Page {currentPage} of {pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" disabled={currentPage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Prev
                  </Button>
                  <Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" disabled={currentPage >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="sticky top-28 h-fit border-gray-200 p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
              {selectedCandidate ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCandidate.fullName}</h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{selectedCandidate.headline ?? "Candidate"}</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                      {getExperienceBand(selectedCandidate.yearsExperience).toUpperCase()}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedCandidate.location ?? "Location not set"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      <span>{selectedCandidate.yearsExperience ?? 0} years experience</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{selectedCandidate.skills.length} recorded skills</span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Profile summary</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-700 dark:text-gray-300">{selectedCandidate.bio ?? "No bio added yet."}</p>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Skills</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCandidate.skills.length > 0 ? (
                        selectedCandidate.skills.map((skill) => (
                          <Badge key={`${selectedCandidate.id}-${skill.skill}`} variant="secondary" className="dark:border-white/10 dark:bg-neutral-800 dark:text-white">
                            {skill.skill}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No skills recorded yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <Button className="w-full" onClick={() => navigate(`/employer/messages?candidate=${selectedCandidate.id}`)}>
                      Message Candidate
                    </Button>
                    {selectedCandidate.cvUrl ? (
                      <Button variant="outline" className="w-full dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" onClick={() => window.open(selectedCandidate.cvUrl ?? "", "_blank", "noopener,noreferrer")}>
                        View CV Path
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Select a candidate to inspect their details.</p>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
