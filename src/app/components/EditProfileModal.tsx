import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { updateCandidateProfile } from "@/lib/candidate";

export function EditProfileModal({
  profile,
  onClose,
  onSuccess,
}: {
  profile: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    location: profile.location ?? "",
    years_experience: profile.years_experience ?? 0,
  });

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      await updateCandidateProfile(form);
      onSuccess();
      onClose();
    } catch (e) {
      console.error("Failed to update profile", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Edit Profile</h2>

        <input
          className="w-full border p-2 rounded"
          placeholder="Headline"
          value={form.headline}
          onChange={(e) => setForm({ ...form, headline: e.target.value })}
        />

        <textarea
          className="w-full border p-2 rounded"
          placeholder="Bio"
          rows={4}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />

        <input
          className="w-full border p-2 rounded"
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />

        <input
          type="number"
          className="w-full border p-2 rounded"
          placeholder="Years of experience"
          value={form.years_experience}
          onChange={(e) =>
            setForm({ ...form, years_experience: Number(e.target.value) })
          }
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
