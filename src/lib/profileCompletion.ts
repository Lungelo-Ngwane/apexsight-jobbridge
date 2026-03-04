export function calculateProfileCompletion(profile: any): number {
  let score = 0;

  // Full name
  if (profile.full_name) {
    score += 15;
  }

  // Core profile fields
  if (profile.headline) {
    score += 10;
  }
  if (profile.bio) {
    score += 10;
  }
  if (profile.location) {
    score += 10;
  }
  const hasYearsExperience = profile.years_experience !== null && profile.years_experience !== undefined;
  const hasExperienceLevel = Boolean(String(profile.experience_level ?? "").trim());
  if (hasYearsExperience || hasExperienceLevel) {
    score += 10;
  }

  // Skills
  if (profile.candidate_skills?.length > 0) {
    score += 20;
  }

  // CV uploaded
  if (profile.cv_url) {
    score += 25;
  }

  // Certifications OR assessments (bonus, not required for readiness)
  const hasCerts = profile.candidate_certifications?.length > 0;
  const hasAssessments = profile.candidate_assessments?.length > 0;

  if (hasCerts || hasAssessments) {
    score += 10;
  }

  return Math.min(score, 100);
}

export function isCandidateProfileReadyForApplication(profile: any): boolean {
  const hasName = Boolean(String(profile?.full_name ?? "").trim());
  const hasCv = Boolean(String(profile?.cv_url ?? "").trim());
  const hasSkill = Array.isArray(profile?.candidate_skills) && profile.candidate_skills.length > 0;
  return hasName && hasCv && hasSkill;
}
