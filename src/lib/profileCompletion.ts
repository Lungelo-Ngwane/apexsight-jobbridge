export function calculateProfileCompletion(profile: any): number {
  let score = 0;

  // Full name
  if (profile.full_name) {
    score += 15;
  }

  // Skills
  if (profile.candidate_skills?.length > 0) {
    score += 25;
  }

  // CV uploaded
  if (profile.cv_url) {
    score += 30;
  }

  // Certifications OR assessments
  const hasCerts = profile.candidate_certifications?.length > 0;
  const hasAssessments = profile.candidate_assessments?.length > 0;

  if (hasCerts || hasAssessments) {
    score += 30;
  }

  return Math.min(score, 100);
}
