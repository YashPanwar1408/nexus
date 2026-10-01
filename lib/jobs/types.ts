export type JobSourceName = "LinkedIn" | "Greenhouse" | "Lever" | "Demo";
export type JobSourceState = "CONNECTED" | "SEARCHING" | "RESULTS_FOUND" | "LOGIN_REQUIRED" | "BLOCKED" | "FAILED" | "NO_RESULTS";

export type JobSearchQuery = { role: string; location: string; postedWithinHours: number; remoteOnly: boolean };

export type Job = {
  id?: string;
  source: JobSourceName;
  sourceJobId: string;
  title: string;
  company: string;
  location: string;
  remoteStatus?: string;
  employmentType?: string;
  description: string;
  postedAt?: Date;
  applicationUrl: string;
  sourceUrl: string;
  skills: string[];
  experience?: string;
  salary?: string;
  logoUrl?: string;
  extractedAt: Date;
};

export type JobSourceResult = { source: JobSourceName; status: JobSourceState; jobs: Job[]; message: string };
export type UserProfileInput = { skills: string[]; experience: unknown[]; degree?: string | null; graduationYear?: number | null; location?: string | null; preferredRoles: string[]; preferredLocations: string[] };
export type RelevanceResult = { score: number; matchedSkills: string[]; missingSkills: string[]; experienceMatch: boolean; educationMatch: boolean; locationMatch: boolean; reasons: string[] };

export interface JobSource {
  readonly name: JobSourceName;
  searchJobs(query: JobSearchQuery): Promise<JobSourceResult>;
  getJobDetails(sourceJobId: string): Promise<Job | null>;
  getApplicationUrl(sourceJobId: string): Promise<string | null>;
}
