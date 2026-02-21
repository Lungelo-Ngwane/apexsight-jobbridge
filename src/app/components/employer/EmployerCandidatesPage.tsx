import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Briefcase, MapPin, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getTalentPoolCandidates, type TalentPoolCandidate } from "@/lib/employer";

type ExperienceFilter = "all" | "junior" | "mid" | "senior";

function getExperienceBand(years: number | null): ExperienceFilter {
  if (years === null || years === undefined) return "junior";
  if (years >= 6) return "senior";
  if (years >= 3) return "mid";
  return "junior";
}

export function EmployerCandidatesPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<TalentPoolCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedExperience, setSelectedExperience] = useState<ExperienceFilter>("all");
  const [selectedSkill, setSelectedSkill] = useState("all");

  useEffect(() => {
    getTalentPoolCandidates()
      .then(setCandidates)
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
      ),
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

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Browse Talent Pool</h1>
          <p className="text-sm text-gray-600">Search and filter candidates by skills, location, and experience</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Card className="p-4 mb-6 border-gray-200 shadow-sm">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search candidates, titles, locations, or skills..."
                className="pl-10 border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white"
              value={selectedLocation}
              onChange={(event) => setSelectedLocation(event.target.value)}
            >
              <option value="all">All locations</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white"
              value={selectedExperience}
              onChange={(event) => setSelectedExperience(event.target.value as ExperienceFilter)}
            >
              <option value="all">All experience</option>
              <option value="junior">Junior (0-2 years)</option>
              <option value="mid">Mid (3-5 years)</option>
              <option value="senior">Senior (6+ years)</option>
            </select>

            <select
              className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white"
              value={selectedSkill}
              onChange={(event) => setSelectedSkill(event.target.value)}
            >
              <option value="all">All skills</option>
              {skillOptions.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setSelectedLocation("all");
                setSelectedExperience("all");
                setSelectedSkill("all");
              }}
            >
              Reset
            </Button>
          </div>
        </Card>

        {loading && (
          <Card className="p-6 text-center text-gray-500">Loading candidates...</Card>
        )}

        {!loading && filteredCandidates.length === 0 && (
          <Card className="p-6 text-center text-gray-500">No candidates match your filters.</Card>
        )}

        {!loading && filteredCandidates.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredCandidates.map((candidate) => (
              <Card key={candidate.id} className="p-5 border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{candidate.fullName}</h3>
                    <p className="text-sm text-gray-600 mt-1">{candidate.headline ?? "Candidate"}</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    {getExperienceBand(candidate.yearsExperience).toUpperCase()}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {candidate.location ?? "Location not set"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {candidate.yearsExperience ?? 0} years
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {candidate.skills.length} skills
                  </span>
                </div>

                <p className="mt-3 text-sm text-gray-700 line-clamp-3">{candidate.bio ?? "No bio added yet."}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {candidate.skills.slice(0, 8).map((skill) => (
                    <Badge key={`${candidate.id}-${skill.skill}`} variant="secondary">
                      {skill.skill}
                    </Badge>
                  ))}
                  {candidate.skills.length > 8 && (
                    <Badge variant="outline">+{candidate.skills.length - 8} more</Badge>
                  )}
                </div>

                <div className="mt-5">
                  <Button
                    className="w-full"
                    onClick={() => navigate(`/employer/messages?candidate=${candidate.id}`)}
                  >
                    Message Candidate
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
