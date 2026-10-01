import { BrowserTool } from "@/lib/browser/tool";
import { getEnv } from "@/lib/env";
import type { Job, JobSearchQuery, JobSource, JobSourceResult } from "@/lib/jobs/types";

export function createJobSources(): JobSource[] {
  const env = getEnv();
  if (env.DEMO_MODE) return [new MockJobSource()];
  return [new LinkedInJobSource(), new GreenhouseJobSource(env.GREENHOUSE_BOARDS.split(",").map((value) => value.trim()).filter(Boolean)), new LeverJobSource(env.LEVER_SITES.split(",").map((value) => value.trim()).filter(Boolean))];
}

export class LinkedInJobSource implements JobSource {
  readonly name = "LinkedIn" as const;
  async searchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const browser = new BrowserTool();
    try {
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query.role)}&location=${encodeURIComponent(query.location)}&f_TPR=r${query.postedWithinHours * 3600}`;
      const navigation = await browser.navigate(url);
      if (!navigation.success) return { source: this.name, status: "FAILED", jobs: [], message: navigation.output };
      const text = await browser.getPageText();
      if (/sign in|join now|log in/i.test(text)) return { source: this.name, status: "LOGIN_REQUIRED", jobs: [], message: "LinkedIn requires login before job results can be inspected." };
      if (/captcha|unusual activity|automated/i.test(text)) return { source: this.name, status: "BLOCKED", jobs: [], message: "LinkedIn blocked automated access or presented a CAPTCHA. NEXUS will not bypass it." };
      const links = await browser.getLinks("a[href*='/jobs/view/']");
      const jobs = [...new Map(links.map((link) => [link.href, { source: this.name, sourceJobId: link.href.match(/jobs\/view\/(\d+)/)?.[1] ?? link.href, title: link.text || query.role, company: "LinkedIn listing", location: query.location, employmentType: "Internship", description: text.slice(0, 20_000), applicationUrl: link.href, sourceUrl: link.href, skills: extractSkills(text), extractedAt: new Date() } satisfies Job])).values()];
      return { source: this.name, status: jobs.length ? "RESULTS_FOUND" : "NO_RESULTS", jobs, message: jobs.length ? `Found ${jobs.length} accessible LinkedIn listing(s).` : "No accessible LinkedIn job cards were found." };
    } catch (error) { return { source: this.name, status: "FAILED", jobs: [], message: error instanceof Error ? error.message : "LinkedIn search failed" }; }
    finally { await browser.close().catch(() => undefined); }
  }
  async getJobDetails() { return null; }
  async getApplicationUrl(sourceJobId: string) { return sourceJobId.startsWith("http") ? sourceJobId : null; }
}

export class GreenhouseJobSource implements JobSource {
  readonly name = "Greenhouse" as const;
  constructor(private readonly boards: string[]) {}
  async searchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    if (!this.boards.length) return { source: this.name, status: "FAILED", jobs: [], message: "No Greenhouse boards are configured." };
    const jobs: Job[] = [];
    try { for (const board of this.boards) { const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`); if (!response.ok) continue; const body = await response.json() as { jobs?: Array<{ id: number; title: string; location?: { name?: string }; content?: string; updated_at?: string; absolute_url: string }> }; for (const item of body.jobs ?? []) { const job = greenhouseJob(item, board); if (matchesQuery(job, query)) jobs.push(job); } } return { source: this.name, status: jobs.length ? "RESULTS_FOUND" : "NO_RESULTS", jobs, message: jobs.length ? `Found ${jobs.length} Greenhouse listing(s).` : "No matching Greenhouse listings were found." }; } catch (error) { return { source: this.name, status: "FAILED", jobs: [], message: error instanceof Error ? error.message : "Greenhouse search failed" }; }
  }
  async getJobDetails() { return null; }
  async getApplicationUrl(sourceJobId: string) { return sourceJobId.startsWith("http") ? sourceJobId : null; }
}

export class LeverJobSource implements JobSource {
  readonly name = "Lever" as const;
  constructor(private readonly sites: string[]) {}
  async searchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    if (!this.sites.length) return { source: this.name, status: "FAILED", jobs: [], message: "No Lever sites are configured." };
    const jobs: Job[] = [];
    try { for (const site of this.sites) { const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`); if (!response.ok) continue; const body = await response.json() as Array<{ id: string; text: string; categories?: { location?: string; commitment?: string }; descriptionPlain?: string; hostedUrl: string; createdAt?: number }>; for (const item of body) { const job = leverJob(item, site); if (matchesQuery(job, query)) jobs.push(job); } } return { source: this.name, status: jobs.length ? "RESULTS_FOUND" : "NO_RESULTS", jobs, message: jobs.length ? `Found ${jobs.length} Lever listing(s).` : "No matching Lever listings were found." }; } catch (error) { return { source: this.name, status: "FAILED", jobs: [], message: error instanceof Error ? error.message : "Lever search failed" }; }
  }
  async getJobDetails() { return null; }
  async getApplicationUrl(sourceJobId: string) { return sourceJobId.startsWith("http") ? sourceJobId : null; }
}

export class MockJobSource implements JobSource {
  readonly name = "Demo" as const;
  async searchJobs(query: JobSearchQuery): Promise<JobSourceResult> { const now = new Date(); const jobs: Job[] = [{ source: this.name, sourceJobId: "demo-acme-swe-intern", title: "Software Engineering Intern", company: "Acme Systems", location: query.location || "Remote", remoteStatus: "Remote", employmentType: "Internship", description: "Build JavaScript services, APIs, and tests with a collaborative engineering team.", postedAt: new Date(now.getTime() - 18 * 60 * 60 * 1000), applicationUrl: "http://localhost:3000/demo/jobs.html", sourceUrl: "http://localhost:3000/demo/jobs.html", skills: ["JavaScript", "APIs", "Testing"], experience: "Internship", extractedAt: now }]; return { source: this.name, status: "RESULTS_FOUND", jobs, message: "Demo data: one deterministic local listing." }; }
  async getJobDetails() { return null; }
  async getApplicationUrl() { return "http://localhost:3000/demo/jobs.html"; }
}

function greenhouseJob(item: { id: number; title: string; location?: { name?: string }; content?: string; updated_at?: string; absolute_url: string }, board: string): Job { const description = stripHtml(item.content ?? ""); return { source: "Greenhouse", sourceJobId: String(item.id), title: item.title, company: board, location: item.location?.name ?? "Not specified", employmentType: /intern/i.test(item.title) ? "Internship" : undefined, description, postedAt: item.updated_at ? new Date(item.updated_at) : undefined, applicationUrl: item.absolute_url, sourceUrl: item.absolute_url, skills: extractSkills(description), extractedAt: new Date() }; }
function leverJob(item: { id: string; text: string; categories?: { location?: string; commitment?: string }; descriptionPlain?: string; hostedUrl: string; createdAt?: number }, site: string): Job { const description = item.descriptionPlain ?? item.text; return { source: "Lever", sourceJobId: item.id, title: item.text, company: site, location: item.categories?.location ?? "Not specified", employmentType: item.categories?.commitment, description, postedAt: item.createdAt ? new Date(item.createdAt) : undefined, applicationUrl: item.hostedUrl, sourceUrl: item.hostedUrl, skills: extractSkills(description), extractedAt: new Date() }; }
function matchesQuery(job: Job, query: JobSearchQuery) { const text = `${job.title} ${job.description}`.toLowerCase(); const roleMatch = text.includes(query.role.toLowerCase().split(" ")[0]); const locationMatch = !query.location || job.location.toLowerCase().includes(query.location.toLowerCase()) || job.remoteStatus?.toLowerCase().includes("remote"); const fresh = !job.postedAt || Date.now() - job.postedAt.getTime() <= query.postedWithinHours * 60 * 60 * 1000; return roleMatch && locationMatch && fresh && (!query.remoteOnly || job.remoteStatus?.toLowerCase().includes("remote")); }
function extractSkills(text: string) { return ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "SQL", "PostgreSQL", "APIs", "Testing", "AWS", "Git"].filter((skill) => text.toLowerCase().includes(skill.toLowerCase())); }
function stripHtml(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
