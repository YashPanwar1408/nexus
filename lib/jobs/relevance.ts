import type { Job, RelevanceResult, UserProfileInput } from "@/lib/jobs/types";

export function analyzeRelevance(profile: UserProfileInput, job: Job): RelevanceResult {
  const profileSkills = new Set(profile.skills.map(normalize));
  const jobSkills = [...new Set(job.skills.map(normalize).filter(Boolean))];
  const matchedSkills = jobSkills.filter((skill) => profileSkills.has(skill));
  const missingSkills = jobSkills.filter((skill) => !profileSkills.has(skill));
  const roleMatch = profile.preferredRoles.length === 0 || profile.preferredRoles.some((role) => `${job.title} ${job.description}`.toLowerCase().includes(role.toLowerCase()));
  const locationMatch = profile.preferredLocations.length === 0 || profile.preferredLocations.some((location) => job.location.toLowerCase().includes(location.toLowerCase()) || job.remoteStatus?.toLowerCase().includes(location.toLowerCase()));
  const educationMatch = !job.experience || !profile.degree || job.experience.toLowerCase().includes("intern") || job.experience.toLowerCase().includes(profile.degree.toLowerCase());
  const experienceMatch = !job.experience || job.experience.toLowerCase().includes("intern") || profile.experience.length > 0;
  const skillScore = jobSkills.length ? Math.round((matchedSkills.length / jobSkills.length) * 55) : 30;
  const score = Math.max(0, Math.min(100, skillScore + (roleMatch ? 20 : 0) + (locationMatch ? 10 : 0) + (educationMatch ? 10 : 0) + (experienceMatch ? 5 : 0)));
  const reasons = [roleMatch ? "Role aligns with the preferred role." : "Role is outside the preferred role signals.", locationMatch ? "Location matches the profile preferences." : "Location may require review.", matchedSkills.length ? `Matched ${matchedSkills.length} relevant skill(s).` : "No confirmed skill overlap was found."];
  return { score, matchedSkills, missingSkills, experienceMatch, educationMatch, locationMatch, reasons };
}

function normalize(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9+#.]/g, ""); }
