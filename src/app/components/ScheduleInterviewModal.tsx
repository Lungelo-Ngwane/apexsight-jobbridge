import { useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { scheduleInterview } from "@/lib/employer";

interface ScheduleInterviewModalProps {
  open: boolean;
  applicationId: string | null;
  candidateName: string;
  onOpenChange: (open: boolean) => void;
  onScheduled: () => Promise<void> | void;
}

function getDefaultDateTimeLocal() {
  const now = new Date();
  now.setMinutes(Math.ceil((now.getMinutes() + 30) / 30) * 30, 0, 0);
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function ScheduleInterviewModal({
  open,
  applicationId,
  candidateName,
  onOpenChange,
  onScheduled,
}: ScheduleInterviewModalProps) {
  const [stage, setStage] = useState<"screening" | "technical" | "final">("screening");
  const [scheduledAt, setScheduledAt] = useState(getDefaultDateTimeLocal);
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [mode, setMode] = useState<"virtual" | "phone" | "onsite">("virtual");
  const [timezone, setTimezone] = useState("Africa/Johannesburg");
  const [locationOrMeetingLink, setLocationOrMeetingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!applicationId) return;

    try {
      setSaving(true);
      const localValue = String(scheduledAt ?? "").trim();
      if (!localValue) {
        throw new Error("Choose an interview date and time.");
      }

      await scheduleInterview({
        applicationId,
        stage,
        scheduledAt: new Date(localValue).toISOString(),
        durationMinutes: Number(durationMinutes ?? 45),
        timezone,
        mode,
        locationOrMeetingLink,
        notes,
      });
      await onScheduled();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
          <DialogDescription>
            Set the first interview details for {candidateName}.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="interview-stage">Stage</Label>
              <Select value={stage} onValueChange={(value) => setStage(value as typeof stage)}>
                <SelectTrigger id="interview-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interview-mode">Mode</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
                <SelectTrigger id="interview-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="onsite">Onsite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="interview-date">Date and time</Label>
              <Input
                id="interview-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interview-duration">Duration</Label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger id="interview-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interview-timezone">Timezone</Label>
            <Input
              id="interview-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Africa/Johannesburg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interview-link">
              {mode === "onsite" ? "Location" : mode === "phone" ? "Phone details" : "Meeting link"}
            </Label>
            <Input
              id="interview-link"
              value={locationOrMeetingLink}
              onChange={(e) => setLocationOrMeetingLink(e.target.value)}
              placeholder={mode === "onsite" ? "Office address" : mode === "phone" ? "Dial-in details" : "https://meet.google.com/..."}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interview-notes">Notes</Label>
            <Textarea
              id="interview-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the candidate should know before the interview"
              className="min-h-24"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !applicationId}>
              {saving ? "Scheduling..." : "Schedule Interview"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
