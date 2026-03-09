import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Badge } from "@/app/components/ui/badge";
import { createJob, resolveOrCreateSkill, updateJob } from "@/lib/employer";
import { supabase } from "@/lib/supabase";
import { UpgradeModal } from "./UpgradeModal";
import { useEmployerProfile } from "../../hooks/useEmployerProfile";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";

type Status = "open" | "closed" | "archived";
type JobSkill = { skill_id: string; required?: boolean | null; min_score?: number | null; skills?: { name?: string | null } | null };
type EditableJob = {
  id: string; title: string; description: string; location?: string | null; employment_type?: string | null;
  work_mode?: string | null; department?: string | null; min_years_experience?: number | null;
  salary_min?: number | null; salary_max?: number | null; benefits?: string | null; status: Status;
  experience_level?: string | null; job_skills?: JobSkill[];
};
type Props = { onClose: () => void; onSuccess: () => void; job?: EditableJob };
type SkillOption = { id: string; name: string };
type SelectedSkill = { skill_id: string; name: string; min_score: number | null };

const steps = ["Job Details", "Skills Required", "Compensation", "Review & Publish"];

export function PostJobModal({ onClose, onSuccess, job }: Props) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [minYears, setMinYears] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("open");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [benefits, setBenefits] = useState("");
  const [skills, setSkills] = useState<SelectedSkill[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [skillResults, setSkillResults] = useState<SkillOption[]>([]);
  const [skillSearchLoading, setSkillSearchLoading] = useState(false);
  const [addingCustomSkill, setAddingCustomSkill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { profile } = useEmployerProfile();
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();
  const isEditMode = Boolean(job?.id);

  useEffect(() => {
    setStep(1);
    setTitle(job?.title ?? "");
    setDepartment(job?.department ?? "");
    setLocation(job?.location ?? "");
    setEmploymentType(job?.employment_type ?? "");
    setWorkMode(job?.work_mode ?? "");
    setExperienceLevel(job?.experience_level ?? "");
    setMinYears(typeof job?.min_years_experience === "number" ? String(job.min_years_experience) : "");
    setDescription(job?.description ?? "");
    setStatus(job?.status ?? "open");
    setSalaryMin(typeof job?.salary_min === "number" ? String(job.salary_min) : "");
    setSalaryMax(typeof job?.salary_max === "number" ? String(job.salary_max) : "");
    setBenefits(job?.benefits ?? "");
    setSkills((job?.job_skills ?? []).map((s) => ({
      skill_id: s.skill_id,
      name: String(s.skills?.name ?? "").trim(),
      min_score: typeof s.min_score === "number" ? s.min_score : 65,
    })).filter((s) => s.name));
  }, [job]);

  async function searchSkills(query: string) {
    if (!query) return setSkillResults([]);
    setSkillSearchLoading(true);
    try {
      const { data, error } = await supabase.from("skills").select("id, name").ilike("name", `%${query}%`).limit(12);
      if (error) throw error;
      setSkillResults(data || []);
    } catch (error) {
      console.error("Failed to search skills", error);
    } finally {
      setSkillSearchLoading(false);
    }
  }

  function addSkill(skill: SkillOption) {
    if (!skills.some((item) => item.skill_id === skill.id)) {
      setSkills((prev) => [...prev, { skill_id: skill.id, name: skill.name, min_score: 65 }]);
    }
    setSkillSearch("");
    setSkillResults([]);
  }

  async function addCustomSkill() {
    const normalizedSkillName = skillSearch.replace(/\s+/g, " ").trim();
    if (!normalizedSkillName) return;

    if (
      skills.some((item) => item.name.toLowerCase() === normalizedSkillName.toLowerCase()) ||
      skillResults.some((item) => item.name.toLowerCase() === normalizedSkillName.toLowerCase())
    ) {
      const matchingExistingSkill = skillResults.find(
        (item) => item.name.toLowerCase() === normalizedSkillName.toLowerCase(),
      );
      if (matchingExistingSkill) {
        addSkill(matchingExistingSkill);
      }
      return;
    }

    setAddingCustomSkill(true);
    try {
      const resolvedSkill = await resolveOrCreateSkill(normalizedSkillName);
      addSkill({ id: resolvedSkill.id, name: resolvedSkill.name });
      if (resolvedSkill.created_skill) {
        showFeedback("Skill added", `"${resolvedSkill.name}" was added to the skill catalog.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      showFeedback("Unable to add skill", message);
    } finally {
      setAddingCustomSkill(false);
    }
  }

  function removeSkill(skillId: string) {
    setSkills((prev) => prev.filter((skill) => skill.skill_id !== skillId));
  }

  function updateSkill(skillId: string, minScore: number | null) {
    setSkills((prev) => prev.map((skill) => skill.skill_id === skillId ? { ...skill, min_score: minScore } : skill));
  }

  function validateStep() {
    if (step === 1 && (!title.trim() || !description.trim() || !experienceLevel)) {
      showFeedback("Missing job details", "Add the job title, description, and experience level before continuing.");
      return false;
    }
    if (step === 2 && skills.length === 0) {
      showFeedback("Add skills", "Add at least one structured skill to improve matching.");
      return false;
    }
    if (step === 3 && salaryMin && salaryMax && Number(salaryMax) < Number(salaryMin)) {
      showFeedback("Invalid salary range", "Maximum salary must be greater than or equal to minimum salary.");
      return false;
    }
    return true;
  }

  async function submit() {
    const minYearsValue = minYears ? Number(minYears) : null;
    const salaryMinValue = salaryMin ? Number(salaryMin) : null;
    const salaryMaxValue = salaryMax ? Number(salaryMax) : null;
    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        employment_type: employmentType || null,
        work_mode: workMode || null,
        department: department.trim() || null,
        min_years_experience: Number.isFinite(minYearsValue) ? minYearsValue : null,
        salary_min: Number.isFinite(salaryMinValue) ? salaryMinValue : null,
        salary_max: Number.isFinite(salaryMaxValue) ? salaryMaxValue : null,
        benefits: benefits.trim() || null,
        status,
        experience_level: experienceLevel,
        skills: skills.map((skill) => ({ skill_id: skill.skill_id, is_required: true, min_score: skill.min_score })),
      };
      if (job?.id) await updateJob(job.id, payload);
      else await createJob(payload);
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.message === "PLAN_LIMIT_REACHED") setShowUpgradeModal(true);
      else {
        console.error(error);
        showFeedback(isEditMode ? "Unable to update job" : "Unable to post job", "Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const salaryPreview = useMemo(() => {
    if (salaryMin && salaryMax) return `${salaryMin} - ${salaryMax} per month`;
    if (salaryMin) return `From ${salaryMin} per month`;
    if (salaryMax) return `Up to ${salaryMax} per month`;
    return "Salary not disclosed";
  }, [salaryMin, salaryMax]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <Card className="flex max-h-[92vh] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden p-0">
          <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{isEditMode ? "Edit Job Posting" : "Create Job Posting"}</h2>
                <p className="mt-1 text-sm text-gray-600">Use structured job data to improve matching quality.</p>
              </div>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
            <div className="flex items-start gap-2">
              {steps.map((item, index) => (
                <div key={item} className="flex flex-1 items-start">
                  <div className="flex flex-1 flex-col items-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${step >= index + 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>{step > index + 1 ? <CheckCircle2 className="h-5 w-5" /> : index + 1}</div>
                    <p className={`mt-2 text-center text-xs font-medium ${step >= index + 1 ? "text-gray-900" : "text-gray-500"}`}>{item}</p>
                  </div>
                  {index < steps.length - 1 && <div className={`mt-5 h-0.5 flex-1 ${step > index + 1 ? "bg-blue-600" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto px-5 py-6 sm:px-6">
            {step === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><Label>Job Title *</Label><Input className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div><Label>Department</Label><Input className="mt-2" value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
                <div><Label>Location</Label><Input className="mt-2" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
                <div><Label>Employment Type</Label><Input className="mt-2" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} placeholder="Full-time" /></div>
                <div><Label>Work Mode</Label><Input className="mt-2" value={workMode} onChange={(e) => setWorkMode(e.target.value)} placeholder="Remote / Hybrid / On-site" /></div>
                <div><Label>Experience Level *</Label><Input className="mt-2" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} placeholder="junior / mid / senior" /></div>
                <div><Label>Minimum Years Experience</Label><Input className="mt-2" type="number" min={0} max={50} value={minYears} onChange={(e) => setMinYears(e.target.value)} /></div>
                <div><Label>Status</Label><Input className="mt-2" value={status} onChange={(e) => setStatus(e.target.value as Status)} /></div>
                <div className="md:col-span-2"><Label>Job Description *</Label><Textarea className="mt-2 min-h-[160px]" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div><Label>Search skills</Label><Input className="mt-2" value={skillSearch} onChange={(e) => { setSkillSearch(e.target.value); void searchSkills(e.target.value); }} placeholder="Search verified skills" /></div>
                {skillSearchLoading && <p className="text-xs text-gray-500">Searching...</p>}
                {skillResults.length > 0 && (
                  <div className="rounded-lg border border-gray-200">
                    {skillResults.map((skill) => (
                      <button key={skill.id} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50" onClick={() => addSkill(skill)}>
                        <span>{skill.name}</span><Plus className="h-4 w-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
                {skillSearch.trim() && !skillSearchLoading && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => void addCustomSkill()}
                    disabled={addingCustomSkill}
                  >
                    <span className="truncate">
                      {addingCustomSkill
                        ? "Adding skill..."
                        : `Add "${skillSearch.replace(/\s+/g, " ").trim()}" if it doesn't exist`}
                    </span>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <div className="space-y-3">
                  {skills.map((skill) => (
                    <div key={skill.skill_id} className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[minmax(0,1fr)_180px_44px]">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{skill.name}</p>
                        <p className="text-xs text-gray-500">Required skill</p>
                      </div>
                      <select className="h-11 rounded-md border border-gray-300 bg-white px-3 text-sm" value={skill.min_score ?? ""} onChange={(e) => updateSkill(skill.skill_id, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">Any proficiency</option>
                        <option value="45">Beginner+</option>
                        <option value="65">Intermediate+</option>
                        <option value="85">Advanced+</option>
                        <option value="100">Expert only</option>
                      </select>
                      <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50" onClick={() => removeSkill(skill.skill_id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {skills.length === 0 && <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">Add at least one structured skill to improve matching.</div>}
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Salary Minimum</Label><Input className="mt-2" type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} /></div>
                <div><Label>Salary Maximum</Label><Input className="mt-2" type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Benefits</Label><Textarea className="mt-2 min-h-[120px]" value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="Medical aid, pension, bonus, learning budget..." /></div>
                <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-medium text-gray-900">Compensation preview</p><p className="mt-2 text-sm text-gray-700">{salaryPreview}</p></div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div><h3 className="text-lg font-semibold text-gray-900">{title || "Untitled Job"}</h3><p className="mt-2 text-sm text-gray-600">{department || "No department"} • {location || "No location"} • {employmentType || "No employment type"}</p></div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div className="space-y-4">
                    <div><Label className="mb-2 block">Required Skills</Label><div className="flex flex-wrap gap-2">{skills.length > 0 ? skills.map((skill) => <Badge key={skill.skill_id}>{skill.name}</Badge>) : <span className="text-sm text-gray-500">No skills selected</span>}</div></div>
                    <div><Label className="mb-2 block">Salary Range</Label><p className="text-sm font-semibold text-gray-900">{salaryPreview}</p></div>
                    <div><Label className="mb-2 block">Description</Label><p className="whitespace-pre-wrap text-sm text-gray-700">{description || "No description added."}</p></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4 sm:px-6">
            <Button variant="outline" disabled={step === 1 || loading} onClick={() => setStep((prev) => Math.max(1, prev - 1))}><ArrowLeft className="mr-2 h-4 w-4" />Previous</Button>
            {step < steps.length ? (
              <Button onClick={() => validateStep() && setStep((prev) => prev + 1)} className="bg-blue-600 text-white hover:bg-blue-700">Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
            ) : (
              <Button onClick={submit} disabled={loading} className="bg-green-600 text-white hover:bg-green-700"><CheckCircle2 className="mr-2 h-4 w-4" />{loading ? (isEditMode ? "Saving..." : "Publishing...") : (isEditMode ? "Save Job Posting" : "Publish Job Posting")}</Button>
            )}
          </div>
        </Card>
      </div>

      {showUpgradeModal && <UpgradeModal plan={profile?.plan ?? "free"} onClose={() => setShowUpgradeModal(false)} />}
      <FeedbackDialog open={feedback.open} title={feedback.title} description={feedback.description} onOpenChange={setFeedbackOpen} />
    </>
  );
}
