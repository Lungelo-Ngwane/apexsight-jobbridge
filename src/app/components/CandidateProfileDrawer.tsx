import { useEffect, useState } from "react";
import { getCandidateDeepView } from "../../lib/employer";
import { Badge } from "./ui/badge";
import { Button } from "@/app/components/ui/button";

export function CandidateProfileDrawer({
  applicationId,
  onClose
}: {
  applicationId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getCandidateDeepView(applicationId).then(setData);
  }, [applicationId]);

  console.log("Candidate Data:", data);

  if (!data) return null;

  console.log("Rendering Candidate Profile Drawer with data:", data);

  return (
    <aside className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-xl p-6 overflow-y-auto">
      {/* Header */}
      {/* Header */}
      <div className="flex justify-between items-start">

        <div>

          <h2 className="text-xl font-bold">
            {data.candidate_profiles.full_name}
          </h2>

          <p className="text-sm text-gray-600">
            {data.candidate_profiles.location}
          </p>


          {/* 🔥 Apexsight Intelligence Block */}
          <div className="mt-3 space-y-1">

            <div className="text-sm font-medium">
              Match Score:
              <span className="ml-2 font-bold text-blue-600">
                {data.score}%
              </span>
            </div>

            <div className="text-sm">
              Match Level:
              <span className="ml-2 font-semibold">
                {data.match_label}
              </span>
            </div>

            <div className="text-sm">
              Recommendation:
              <span className="ml-2 font-semibold text-green-600">
                {data.hiring_recommendation}
              </span>
            </div>

            <div className="text-sm">
              Rank:
              <span className="ml-2 font-semibold">
                #{data.rank}
              </span>
            </div>

          </div>

        </div>


        {/* Score Badge */}
        <Badge className="text-base px-3 py-1">

          {data.score}%

        </Badge>

      </div>

      {data.score_breakdown && (
        <section className="mt-6">
          <h4 className="font-semibold mb-2">Match Breakdown</h4>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Required skills</span>
              <span>{data.score_breakdown.required} / 50</span>
            </div>

            <div className="flex justify-between">
              <span>Optional skills</span>
              <span>{data.score_breakdown.optional} / 20</span>
            </div>

            <div className="flex justify-between">
              <span>Experience level</span>
              <span>{data.score_breakdown.experience} / 15</span>
            </div>

            <div className="flex justify-between">
              <span>Skill proficiency</span>
              <span>{data.score_breakdown.skill_level} / 15</span>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6">
        <h2 className="font-semibold mb-2">Headline</h2>
        <p className="text-sm text-gray-600">{data.candidate_profiles.headline || "Location"}</p>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold mb-2">Experience</h2>
        <p className="text-sm text-gray-600">{data.candidate_profiles.years_experience || "Location"} Years</p>
      </div>

      {/* About */}
      <section className="mt-6">
        <h4 className="font-semibold mb-2">About</h4>
        <p className="text-sm text-gray-700">{data.candidate_profiles.bio}</p>
      </section>

      {/* Skills */}
      <section className="mt-6">
        <h4 className="font-semibold mb-2">Skills</h4>
        <div className="flex flex-wrap gap-2">
          {data.candidate_profiles.candidate_skills.map((s: any) => (
            <Badge key={s.skill} variant="secondary">
              {s.skill}
            </Badge>
          ))}

        </div>
      </section>

      {/* CV */}
      <section className="mt-6">
        <h4 className="font-semibold mb-2">CV</h4>

        {data.candidate_profiles.cv_url ? (
          <a
            href={data.candidate_profiles.cv_url}
            target="_blank"
            className="text-blue-600 text-sm underline"
          >
            Download CV
          </a>
        ) : (
          <p className="text-sm text-gray-500">No CV uploaded</p>
        )}
      </section>


      {/* Actions */}
      <div className="mt-8 space-y-2">
        <Button className="w-full">Shortlist</Button>
        <Button variant="outline" className="w-full">
          Message Candidate
        </Button>
      </div>
    </aside>
  );
}
