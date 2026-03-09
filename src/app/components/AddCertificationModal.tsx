import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { addCandidateCertification } from "@/lib/candidate";
import { FileText, Upload } from "lucide-react";

interface AddCertificationModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function AddCertificationModal({ onClose, onSuccess }: AddCertificationModalProps) {
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Certification name is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await addCandidateCertification({
        name: name.trim(),
        issuer: issuer.trim(),
        issuedAt,
        file,
      });
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save certification");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="mb-4 text-xl font-semibold">Add Certification</h2>

        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="Certification name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            <Input
              placeholder="Issuing organisation"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
            />
            <Input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
            <label className="block cursor-pointer" htmlFor="candidate-certificate-upload">
              <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-4 text-center transition hover:bg-blue-100">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
                  <Upload className="h-4 w-4" />
                  {file ? "Replace PDF certificate" : "Upload PDF certificate"}
                </p>
                <p className="mt-1 text-xs text-blue-600">
                  Optional, but recommended for verification.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Accepted format: PDF
                </p>
                {file && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                    <FileText className="h-3.5 w-3.5" />
                    {file.name}
                  </p>
                )}
              </div>
            </label>
            <input
              id="candidate-certificate-upload"
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] ?? null;
                setFile(nextFile);
                setError(null);
              }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-500">
            Add certifications you earned outside platform assessments so employers can see your full track record.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Certification"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
