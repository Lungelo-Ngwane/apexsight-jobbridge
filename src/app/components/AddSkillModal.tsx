import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";
import { addCandidateSkill } from "@/lib/candidate";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddSkillModal({ onClose, onSuccess }: Props) {
  const [skill, setSkill] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!skill.trim()) {
      setError("Skill name is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);


      await addCandidateSkill(skill.trim(), level);

      onSuccess(); // refresh dashboard
      onClose();   // close modal
    } catch (err: any) {
      setError(err.message || "Failed to add skill");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Add New Skill</h2>

        <div className="space-y-3">
          <Input
            placeholder="Skill name (e.g. Python)"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          />

          <select
            className="w-full border rounded-md p-2"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding..." : "Add Skill"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
