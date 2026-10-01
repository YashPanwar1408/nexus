import { prisma } from "@/lib/db/prisma";
import { analyzeRelevance } from "@/lib/jobs/relevance";
import { createJobSources } from "@/lib/jobs/sources";
import type { JobSearchQuery, UserProfileInput } from "@/lib/jobs/types";

export async function searchAndPersistJobs(input: { profileId: string; query: JobSearchQuery; missionId?: string }) {
  const search = await prisma.jobSearch.create({ data: { profileId: input.profileId, missionId: input.missionId, role: input.query.role, location: input.query.location, postedWithinHours: input.query.postedWithinHours, remoteOnly: input.query.remoteOnly, status: "SEARCHING" } });
  const sourceStatuses: Record<string, string> = {};
  const jobs: Array<{ id: string; score: number }> = [];
  for (const source of createJobSources()) {
    const result = await source.searchJobs(input.query);
    sourceStatuses[result.source] = result.status;
    for (const job of result.jobs) {
      if (!job.sourceUrl || !job.applicationUrl) continue;
      const saved = await prisma.job.upsert({ where: { source_sourceJobId: { source: job.source, sourceJobId: job.sourceJobId } }, update: { searchId: search.id, title: job.title, company: job.company, location: job.location, remoteStatus: job.remoteStatus, employmentType: job.employmentType, description: job.description, postedAt: job.postedAt, applicationUrl: job.applicationUrl, sourceUrl: job.sourceUrl, skills: job.skills, experience: job.experience, salary: job.salary, logoUrl: job.logoUrl, extractedAt: job.extractedAt }, create: { ...job, searchId: search.id } });
      const match = analyzeRelevance(await profileInput(input.profileId), job);
      await prisma.jobMatch.upsert({ where: { searchId_jobId: { searchId: search.id, jobId: saved.id } }, update: match, create: { searchId: search.id, jobId: saved.id, ...match } });
      jobs.push({ id: saved.id, score: match.score });
    }
  }
  await prisma.jobSearch.update({ where: { id: search.id }, data: { status: jobs.length ? "RESULTS_FOUND" : "NO_RESULTS", sourceStatuses, completedAt: new Date() } });
  return { searchId: search.id, sourceStatuses, jobCount: jobs.length, jobs: jobs.sort((a, b) => b.score - a.score) };
}

async function profileInput(profileId: string): Promise<UserProfileInput> {
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { id: profileId } });
  return { skills: Array.isArray(profile.skills) ? profile.skills.filter((value): value is string => typeof value === "string") : [], experience: Array.isArray(profile.experience) ? profile.experience : [], degree: profile.degree, graduationYear: profile.graduationYear, location: profile.location, preferredRoles: Array.isArray(profile.preferredRoles) ? profile.preferredRoles.filter((value): value is string => typeof value === "string") : [], preferredLocations: Array.isArray(profile.preferredLocations) ? profile.preferredLocations.filter((value): value is string => typeof value === "string") : [] };
}
