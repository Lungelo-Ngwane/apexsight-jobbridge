import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";
import { createJob } from "@/lib/employer";

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

type Status = "open" | "closed" | "archived";

export function PostJobModal({ onClose, onSuccess }: Props) {
    const [title, setTitle] = useState("");
    // const [department, setDepartment] = useState("");
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");
    const [employmentType, setEmploymentType] = useState("");
    const [status, setStatus] = useState<Status>("open");
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        if (!title || !description) return;

        try {
            setLoading(true);

            await createJob({
                title,
                location,
                description,
                status,
                employmentType
            });

            onSuccess();
            onClose();
        } catch (err) {
            console.error("Failed to create job", err);
            alert(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Post New Job</h2>

                <div className="space-y-3">
                    <Input
                        placeholder="Job Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    {/* <Input
                        placeholder="Department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                    /> */}

                    <Input
                        placeholder="Location (Remote / City)"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />

                    <Input
                        placeholder="Employment Type"
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value)}
                    />

                    <Input
                        placeholder="Job Status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    />

                    <textarea
                        className="w-full border rounded-md p-2 text-sm"
                        rows={5}
                        placeholder="Job Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "Posting..." : "Post Job"}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
