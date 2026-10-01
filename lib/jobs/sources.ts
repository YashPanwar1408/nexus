import { BrowserTool } from "@/lib/browser/tool";
import { getEnv } from "@/lib/env";
import { withTimeout } from "@/lib/recovery/policy";
import type { Job, JobSearchQuery, JobSource, JobSourceResult } from "@/lib/jobs/types";

type GreenhouseResponse = { jobs?: Array<{ id: number; title: string; location?: { name?: string }; content?: string; updated_at?: string; absolute_url: string }> };
type LeverResponse = Array<{ id: string; text: string; categories?: { location?: string; commitment?: string }; descriptionPlain?: string; hostedUrl: string; createdAt?: number }>;

export function createJobSources(): JobSource[] {
  const env = getEnv();
  if (env.DEMO_MODE) return [new MockJobSource()];
  return [new LinkedInJobSource(), new GreenhouseJobSource(parseSourceList(env.GREENHOUSE_BOARDS)), new LeverJobSource(parseSourceList(env.LEVER_SITES))];
}

export class LinkedInJobSource implements JobSource {
  readonly name = "LinkedIn" as const;
  async searchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const browser = new BrowserTool();
    try {
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query.role)}&location=${encodeURIComponent(query.location)}&f_TPR=r${query.postedWithinHours * 3600}`;
      const navigation = await withTimeout(browser.navigate(url), 20_000, "LinkedIn search timed out");
      if (!navigation.success) return { source: this.name, status: "FAILED", jobs: [], message: navigation.output };
      const text = await withTimeout(browser.getPageText(), 8_000, "LinkedIn page inspection timed out");
      if (/sign in|join now|log in/i.test(text)) return { source: this.name, status: "LOGIN_REQUIRED", jobs: [], message: "LinkedIn requires login in the NEXUS browser session. A separate personal Chrome login is not shared with the server." };
      if (/captcha|unusual activity|automated/i.test(text)) return { source: this.name, status: "BLOCKED", jobs: [], message: "LinkedIn blocked automated access or presented a CAPTCHA. NEXUS will not bypass it." };
      const links = await withTimeout(browser.getLinks("a[href*='/jobs/view/']"), 8_000, "LinkedIn job-card extraction timed out");
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
    try { const responses = await Promise.all(this.boards.map(async (board) => { try { const body = await fetchJson<GreenhouseResponse>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`); return (body?.jobs ?? []).map((item) => greenhouseJob(item, board)); } catch { return []; } })); for (const boardJobs of responses) for (const job of boardJobs) if (matchesQuery(job, query)) jobs.push(job); return { source: this.name, status: jobs.length ? "RESULTS_FOUND" : "NO_RESULTS", jobs, message: jobs.length ? `Found ${jobs.length} Greenhouse listing(s).` : "No matching Greenhouse listings were found." }; } catch (error) { return { source: this.name, status: "FAILED", jobs: [], message: error instanceof Error ? error.message : "Greenhouse search failed" }; }
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
    try { const responses = await Promise.all(this.sites.map(async (site) => { try { const body = await fetchJson<LeverResponse>(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`); return (body ?? []).map((item) => leverJob(item, site)); } catch { return []; } })); for (const siteJobs of responses) for (const job of siteJobs) if (matchesQuery(job, query)) jobs.push(job); return { source: this.name, status: jobs.length ? "RESULTS_FOUND" : "NO_RESULTS", jobs, message: jobs.length ? `Found ${jobs.length} Lever listing(s).` : "No matching Lever listings were found." }; } catch (error) { return { source: this.name, status: "FAILED", jobs: [], message: error instanceof Error ? error.message : "Lever search failed" }; }
  }
  async getJobDetails() { return null; }
  async getApplicationUrl(sourceJobId: string) { return sourceJobId.startsWith("http") ? sourceJobId : null; }
}

export class MockJobSource implements JobSource {
  readonly name = "Demo" as const;
  async searchJobs(query: JobSearchQuery): Promise<JobSourceResult> { const now = new Date(); const fixtures: Array<[string, string, string, string, string[]]> = [["Software Engineering Intern", "Microsoft", "https://careers.microsoft.com/v2/global/en/students", "Build software with a product engineering team.", ["TypeScript", "APIs", "Testing"]], ["Software Engineer Intern", "Google", "https://www.google.com/about/careers/applications/", "Work on software systems, developer tools, and user-facing products.", ["Python", "Java", "APIs"]], ["Frontend Engineering Intern", "Meta", "https://www.metacareers.com/jobs", "Build frontend experiences and reusable interfaces.", ["React", "JavaScript", "TypeScript"]], ["Backend Engineering Intern", "Stripe", "https://stripe.com/jobs", "Develop reliable APIs and payment infrastructure.", ["Node.js", "APIs", "PostgreSQL"]], ["Software Engineering Intern", "GitHub", "https://github.com/about/careers", "Improve developer tools and collaboration workflows.", ["Ruby", "JavaScript", "Git"]], ["Product Engineering Intern", "Atlassian", "https://www.atlassian.com/company/careers", "Build tools that help teams plan and ship work.", ["React", "TypeScript", "Testing"]], ["Software Engineering Intern", "Adobe", "https://careers.adobe.com/us/en", "Create creative cloud experiences and platform services.", ["Java", "JavaScript", "APIs"]], ["Cloud Engineering Intern", "Cloudflare", "https://www.cloudflare.com/careers/jobs/", "Build resilient edge and developer platform systems.", ["Go", "APIs", "AWS"]], ["Software Engineering Intern", "Shopify", "https://www.shopify.com/careers", "Develop commerce tools for merchants and developers.", ["Ruby", "React", "APIs"]], ["Full Stack Engineering Intern", "Figma", "https://www.figma.com/careers/", "Build collaborative design and engineering tools.", ["TypeScript", "React", "Node.js"]], ["Software Engineer Intern", "Uber", "https://www.uber.com/us/en/careers/", "Solve large-scale mobility and marketplace problems.", ["Python", "Java", "SQL"]], ["Data Platform Engineering Intern", "Databricks", "https://www.databricks.com/company/careers", "Build data and machine-learning platform services.", ["Python", "SQL", "AWS"]], ["Software Engineering Intern", "MongoDB", "https://www.mongodb.com/careers", "Build developer-first database experiences.", ["JavaScript", "Python", "APIs"]], ["Infrastructure Engineering Intern", "Amazon", "https://www.amazon.jobs/", "Work on reliable distributed systems and infrastructure.", ["AWS", "Java", "Python"]], ["Software Engineering Intern", "Spotify", "https://www.lifeatspotify.com/jobs", "Build audio products and platform experiences.", ["Java", "Python", "APIs"]], ["Mobile Engineering Intern", "DoorDash", "https://careersatdoordash.com/", "Build consumer and logistics product experiences.", ["Java", "Python", "Testing"]], ["Software Engineering Intern", "Dropbox", "https://jobs.dropbox.com/", "Build collaboration and storage products.", ["Python", "React", "APIs"]], ["Software Engineering Intern", "Canva", "https://www.canva.com/careers/", "Build visual communication tools for millions of users.", ["JavaScript", "React", "TypeScript"]]]; const jobs = fixtures.map(([title, company, url, description, skills], index) => ({ source: this.name, sourceJobId: `demo-${company.toLowerCase()}-${index}`, title, company, location: query.location || "Remote / Global", remoteStatus: "Remote", employmentType: "Internship", description, postedAt: new Date(now.getTime() - (index + 3) * 60 * 60 * 1000), applicationUrl: url, sourceUrl: url, skills, experience: "Internship", extractedAt: now } satisfies Job)).filter((job) => matchesQuery(job, query)).sort(() => Math.random() - 0.5).slice(0, 4); return { source: this.name, status: "RESULTS_FOUND", jobs, message: `DEMO DATA: ${jobs.length} rotating fixture listing(s). Links point to company career pages; listings are not claimed as live openings.` }; }
  async getJobDetails() { return null; }
  async getApplicationUrl() { return "http://localhost:3000/demo/jobs.html"; }
}

function greenhouseJob(item: { id: number; title: string; location?: { name?: string }; content?: string; updated_at?: string; absolute_url: string }, board: string): Job { const description = stripHtml(item.content ?? ""); return { source: "Greenhouse", sourceJobId: String(item.id), title: item.title, company: board, location: item.location?.name ?? "Not specified", employmentType: /intern/i.test(item.title) ? "Internship" : undefined, description, postedAt: item.updated_at ? new Date(item.updated_at) : undefined, applicationUrl: item.absolute_url, sourceUrl: item.absolute_url, skills: extractSkills(description), extractedAt: new Date() }; }
function leverJob(item: { id: string; text: string; categories?: { location?: string; commitment?: string }; descriptionPlain?: string; hostedUrl: string; createdAt?: number }, site: string): Job { const description = item.descriptionPlain ?? item.text; return { source: "Lever", sourceJobId: item.id, title: item.text, company: site, location: item.categories?.location ?? "Not specified", employmentType: item.categories?.commitment, description, postedAt: item.createdAt ? new Date(item.createdAt) : undefined, applicationUrl: item.hostedUrl, sourceUrl: item.hostedUrl, skills: extractSkills(description), extractedAt: new Date() }; }
function matchesQuery(job: Job, query: JobSearchQuery) { const title = job.title.toLowerCase(); const roleTerms = query.role.toLowerCase().split(/\W+/).filter((term) => term.length > 2 && !["the", "and", "for"].includes(term)); const internshipRequested = /intern|internship/.test(query.role.toLowerCase()); const titleTermMatch = roleTerms.filter((term) => title.includes(term)).length >= Math.min(2, roleTerms.length); const internshipMatch = !internshipRequested || /intern|internship|co-op|placement/.test(title); const locationMatch = !query.location || job.location.toLowerCase().includes(query.location.toLowerCase()) || job.remoteStatus?.toLowerCase().includes("remote"); const fresh = !job.postedAt || Date.now() - job.postedAt.getTime() <= query.postedWithinHours * 60 * 60 * 1000; return titleTermMatch && internshipMatch && locationMatch && fresh && (!query.remoteOnly || job.remoteStatus?.toLowerCase().includes("remote")); }
function extractSkills(text: string) { return ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "SQL", "PostgreSQL", "APIs", "Testing", "AWS", "Git"].filter((skill) => text.toLowerCase().includes(skill.toLowerCase())); }
function stripHtml(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function parseSourceList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 50); }
async function fetchJson<T>(url: string): Promise<T | null> { const response = await fetch(url, { signal: AbortSignal.timeout(8_000) }); if (!response.ok) return null; return await response.json() as T; }
