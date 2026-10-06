import { Button } from "@/app/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogTitle } from "@/app/components/ui/dialog";
import { updateCandidateProfile } from "@/lib/candidate";
import { useState,type FormEvent } from "react";

interface EditableProfile { headline?: string | null; bio?: string | null; location?: string | null; years_experience?: number | null; }
export function EditProfileModal({ profile, onClose, onSuccess }: {
  profile: EditableProfile; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({ headline: profile.headline ?? "", bio: profile.bio ?? "",
    location: profile.location ?? "", years_experience: profile.years_experience ?? 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSave(event: FormEvent) {
    event.preventDefault(); if (saving) return;
    if (!Number.isFinite(form.years_experience) || form.years_experience < 0 || form.years_experience > 80) {
      setError("Enter years of experience between 0 and 80."); return;
    }
    setSaving(true); setError(null);
    try { await updateCandidateProfile(form); onSuccess(); onClose(); }
    catch { setError("Your profile couldn't be saved. Please try again."); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}
      onInteractOutside={event => { if (saving) event.preventDefault(); }} showCloseButton={!saving}>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogDescription>Update the information employers see about your experience.</DialogDescription>
      <form onSubmit={handleSave} className="space-y-4" aria-busy={saving}>
        <label className="block">Headline<input className="w-full border p-2 rounded" maxLength={200}
          value={form.headline} onChange={event => setForm({ ...form, headline: event.target.value })} /></label>
        <label className="block">Bio<textarea className="w-full border p-2 rounded" rows={4} maxLength={5000}
          value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} /></label>
        <label className="block">Location<input className="w-full border p-2 rounded" maxLength={200}
          value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} /></label>
        <label className="block">Years of experience<input type="number" min={0} max={80} step={1}
          className="w-full border p-2 rounded" value={form.years_experience}
          onChange={event => setForm({ ...form, years_experience: Number(event.target.value) })} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
