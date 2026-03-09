import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";
import { addCandidateSkillByName, getSkillsCatalog, type SkillCatalogItem } from "@/lib/candidate";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddSkillModal({ onClose, onSuccess }: Props) {
  const [skillQuery, setSkillQuery] = useState("");
  const [skills, setSkills] = useState<SkillCatalogItem[]>([]);
  const [level, setLevel] = useState("intermediate");
  const [loading, setLoading] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSkills() {
      try {
        setLoadingSkills(true);
        const data = await getSkillsCatalog();
        setSkills(data);
      } catch (err: any) {
        setError(err.message || "Failed to load skills list");
      } finally {
        setLoadingSkills(false);
      }
    }

    loadSkills();
  }, []);

  const normalizedQuery = skillQuery.trim().toLowerCase();

  const selectedSkill = useMemo(
    () => skills.find((item) => item.name.trim().toLowerCase() === normalizedQuery) ?? null,
    [normalizedQuery, skills],
  );

  const filteredSkills = useMemo(() => {
    if (!normalizedQuery) return skills.slice(0, 8);
    return skills
      .filter((item) => item.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [normalizedQuery, skills]);

  async function handleSubmit() {
    if (!normalizedQuery) {
      setError("Enter a skill name.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await addCandidateSkillByName(skillQuery.trim(), level as "beginner" | "intermediate" | "advanced");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add skill");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="mb-4 text-xl font-semibold">Add New Skill</h2>

        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="Start typing a skill name"
              value={skillQuery}
              onChange={(e) => {
                setSkillQuery(e.target.value);
                setError(null);
              }}
              list="candidate-skill-options"
            />
            <datalist id="candidate-skill-options">
              {skills.map((item) => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
              {loadingSkills ? (
                <p className="text-sm text-gray-500">Loading skills...</p>
              ) : filteredSkills.length === 0 ? (
                <p className="text-sm text-gray-500">No matching skills found.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredSkills.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        selectedSkill?.id === item.id
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700"
                      }`}
                      onClick={() => {
                        setSkillQuery(item.name);
                        setError(null);
                      }}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Pick an existing skill or type a new one to add it to the catalog.
            </p>
          </div>

          <select
            className="w-full rounded-md border p-2"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || loadingSkills}>
            {loading ? "Adding..." : "Add Skill"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
