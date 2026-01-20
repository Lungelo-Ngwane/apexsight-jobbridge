import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Badge } from "@/app/components/ui/badge";
import { 
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Plus,
  X,
  MapPin,
  DollarSign,
  Briefcase,
  Target
} from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

interface JobPostingFlowProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function JobPostingFlow({ onComplete, onCancel }: JobPostingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([
    "Data Analysis",
    "Python",
    "SQL"
  ]);

  const totalSteps = 4;

  const steps = [
    { number: 1, title: "Job Details", icon: Briefcase },
    { number: 2, title: "Skills Required", icon: Target },
    { number: 3, title: "Compensation", icon: DollarSign },
    { number: 4, title: "Review & Publish", icon: CheckCircle2 }
  ];

  const availableSkills = [
    "Data Analysis", "Python", "SQL", "Excel", "Power BI",
    "Tableau", "R Programming", "Statistical Analysis",
    "Machine Learning", "Data Visualization"
  ];

  const handleAddSkill = (skill: string) => {
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSelectedSkills(selectedSkills.filter(s => s !== skill));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="jobTitle" className="text-sm font-medium text-gray-700">
                Job Title *
              </Label>
              <Input
                id="jobTitle"
                placeholder="e.g., Senior Data Analyst"
                className="mt-2"
                defaultValue="Senior Data Analyst"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department" className="text-sm font-medium text-gray-700">
                  Department *
                </Label>
                <Select defaultValue="analytics">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analytics">Analytics</SelectItem>
                    <SelectItem value="engineering">Engineering</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location" className="text-sm font-medium text-gray-700">
                  Location *
                </Label>
                <Select defaultValue="johannesburg">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="johannesburg">Johannesburg</SelectItem>
                    <SelectItem value="cape-town">Cape Town</SelectItem>
                    <SelectItem value="durban">Durban</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employmentType" className="text-sm font-medium text-gray-700">
                  Employment Type *
                </Label>
                <Select defaultValue="full-time">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="experience" className="text-sm font-medium text-gray-700">
                  Experience Level *
                </Label>
                <Select defaultValue="intermediate">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                    <SelectItem value="intermediate">Intermediate (2-5 years)</SelectItem>
                    <SelectItem value="senior">Senior (5+ years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                Job Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe the role, responsibilities, and your company culture..."
                className="mt-2 min-h-[120px]"
                defaultValue="We are seeking a Senior Data Analyst to join our Analytics team..."
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Define Required Skills
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Select the verified skills candidates must have. Only candidates with these skills will see your posting.
              </p>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">
                    Selected Skills ({selectedSkills.length})
                  </Label>
                  <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    {selectedSkills.map((skill) => (
                      <Badge
                        key={skill}
                        className="bg-blue-600 text-white pl-3 pr-2 py-1.5 flex items-center gap-2"
                      >
                        {skill}
                        <button
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:bg-blue-700 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    {selectedSkills.length === 0 && (
                      <span className="text-sm text-gray-500">
                        Select skills from the list below
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">
                    Available Skills
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableSkills
                      .filter(skill => !selectedSkills.includes(skill))
                      .map((skill) => (
                        <button
                          key={skill}
                          onClick={() => handleAddSkill(skill)}
                          className="flex items-center justify-between p-3 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                        >
                          <span className="text-sm font-medium text-gray-700">{skill}</span>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </button>
                      ))}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-900">
                    <strong>Tip:</strong> Focus on essential skills only. 
                    The more specific you are, the higher quality matches you'll receive.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Minimum Skill Level Required
              </Label>
              <Select defaultValue="intermediate">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner (60-69%)</SelectItem>
                  <SelectItem value="intermediate">Intermediate (70-84%)</SelectItem>
                  <SelectItem value="advanced">Advanced (85%+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Compensation & Benefits
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Transparent salary information increases application rates by 60%
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Salary Range (Monthly) *
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="salaryMin" className="text-xs text-gray-600">
                    Minimum
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      R
                    </span>
                    <Input
                      id="salaryMin"
                      type="number"
                      placeholder="25,000"
                      className="pl-7"
                      defaultValue="30000"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="salaryMax" className="text-xs text-gray-600">
                    Maximum
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      R
                    </span>
                    <Input
                      id="salaryMax"
                      type="number"
                      placeholder="40,000"
                      className="pl-7"
                      defaultValue="45000"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Additional Benefits
              </Label>
              <Textarea
                placeholder="e.g., Medical aid, Pension fund, Performance bonuses, Remote work options..."
                className="min-h-[100px]"
                defaultValue="Medical aid, Pension fund, Performance bonuses, Learning budget"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Market Insights</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Market average for this role:</span>
                  <span className="font-semibold">R32,000 - R42,000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Your offering:</span>
                  <Badge className="bg-green-100 text-green-700">Competitive</Badge>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Review Your Job Posting
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Please review all details before publishing
              </p>
            </div>

            <Card className="p-6 border-gray-200 bg-gray-50">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-1">
                    Senior Data Analyst
                  </h4>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Analytics Department</span>
                    <span>•</span>
                    <span>Johannesburg</span>
                    <span>•</span>
                    <span>Full-time</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Required Skills
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSkills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Salary Range
                  </Label>
                  <p className="text-lg font-semibold text-gray-900">
                    R30,000 - R45,000 per month
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Estimated Reach
                  </Label>
                  <div className="bg-white rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Qualified candidates:</span>
                      <span className="text-2xl font-bold text-blue-600">~127</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Based on verified skills and location preferences
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-900">
                  <p className="font-medium mb-1">Ready to publish!</p>
                  <p>Your job posting will be visible to qualified candidates immediately.</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create Job Posting</h1>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
                      currentStep >= step.number
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <div className="text-center mt-2">
                    <div className={`text-xs font-medium ${
                      currentStep >= step.number ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mb-6 ${
                    currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="p-8 border-gray-200">
          {renderStepContent()}
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentStep < totalSteps ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Publish Job Posting
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
