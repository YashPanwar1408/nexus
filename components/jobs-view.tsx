"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState } from "react";

type Profile = { id: string; confirmedAt: string | null };
type Job = { id: string; source: string; title: string; company: string; location: string; remoteStatus: string | null; employmentType: string | null; description: string; postedAt: string | null; applicationUrl: string; sourceUrl: string; skills: string[]; matches: Array<{ score: number; matchedSkills: string[]; missingSkills: string[]; reasons: string[] }>; application: { id: string; status: string } | null };
type SearchResponse = { searchId: string; sourceStatuses: Record<string, string>; jobCount: number };
type PreparedField = { fieldName: string; value: string | null; status: string; confidence: number };

type Preview = { applicationId: string; job: Job; fields: PreparedField[] };

export function JobsView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [role, setRole] = useState("Software Engineering Intern");
  const [location, setLocation] = useState("India");
  const [hours, setHours] = useState("48");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    void fetch("/api/profile?userId=local-user").then(async (response) => setProfile(await response.json()));
  }, []);

  async function search() {
    if (!profile?.id) {
      setMessage("Create and confirm your profile before searching.");
      return;
    }
    setSearching(true);
    setMessage("");
    const response = await fetch("/api/job-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: profile.id, role, location, postedWithinHours: Number(hours), remoteOnly }) });
    const body = await response.json() as SearchResponse & { error?: string };
    if (!response.ok) setMessage(body.error ?? "Job search failed");
    else {
      setStatuses(body.sourceStatuses);
      const jobsResponse = await fetch(`/api/jobs?searchId=${body.searchId}`);
      setJobs(await jobsResponse.json());
      if (!body.jobCount) setMessage("No matching real listings were found. Check source status details below.");
    }
    setSearching(false);
  }

  async function prepare(job: Job) {
    if (!profile?.id) return;
    const response = await fetch("/api/applications/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: profile.id, jobId: job.id }) });
    const body = await response.json();
    if (!response.ok) setMessage(body.error ?? "Application preparation failed");
    else setPreview({ applicationId: body.applicationId, job, fields: body.fields });
  }

  async function prepareForm() {
    if (!preview) return;
    setPreparing(true);
    const response = await fetch(`/api/applications/${preview.applicationId}/prepare`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) setMessage(body.error ?? "Application form preparation failed");
    else {
      setPreview({ ...preview, fields: body.fields });
      setMessage("Mapped fields were filled where confidence was high. Submission remains blocked until approval.");
    }
    setPreparing(false);
  }

  async function shortlist(jobId: string) {
    const response = await fetch(`/api/jobs/${jobId}/shortlist`, { method: "POST" });
    if (!response.ok) setMessage("Could not shortlist this opportunity");
    else setMessage("Opportunity added to your shortlist.");
  }

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="/">NEXUS <span>MISSION CONTROL</span></a><nav><a className="nav-button" href="/profile">Profile</a><a className="nav-button" href="/applications">Applications</a><a className="nav-button" href="/">New mission</a></nav></header>
    <section className="page-heading"><p className="eyebrow cyan">Job mission / live sources</p><h1>Find work that fits.</h1><p className="muted heading-copy">NEXUS searches configured public sources, filters by freshness, and calculates a deterministic profile match. Unavailable sources are reported, never replaced with invented listings. Personal LinkedIn or Indeed browser logins are not shared with the deployed server.</p></section>
    <section className="job-search-panel"><div><label className="field-label">Role<input value={role} onChange={(event) => setRole(event.target.value)} /></label><label className="field-label">Location<input value={location} onChange={(event) => setLocation(event.target.value)} /></label></div><div><label className="field-label">Posted within<select value={hours} onChange={(event) => setHours(event.target.value)}><option value="24">Last 24 hours</option><option value="48">Last 48 hours</option><option value="168">Last 7 days</option></select></label><label className="check-label"><input type="checkbox" checked={remoteOnly} onChange={(event) => setRemoteOnly(event.target.checked)} /> Remote only</label></div><button className="primary-button" onClick={search} disabled={searching}>{searching ? "Searching sources..." : "Search with NEXUS"}<span>→</span></button></section>
    {!profile?.confirmedAt && <div className="notice-panel">Confirm your profile before searching or preparing applications. <a href="/profile">Open profile →</a></div>}
    {Object.keys(statuses).length > 0 && <section className="source-statuses"><p className="eyebrow">Source status</p>{Object.entries(statuses).map(([source, status]) => <span className={`source-status ${status.toLowerCase()}`} key={source}><strong>{source}</strong> {status.replaceAll("_", " ")}</span>)}</section>}
    {statuses.Demo && <div className="notice-panel">DEMO DATA: rotating fixture opportunities with real company career-page links. These are not claimed as live openings.</div>}
    {message && <p className="error-banner">{message}</p>}
    <section className="job-results"><div className="results-heading"><p className="eyebrow">Normalized opportunities</p><span className="muted">{jobs.length} result{jobs.length === 1 ? "" : "s"}</span></div>{jobs.length === 0 ? <div className="empty-state">Run a search to see real source-attributed opportunities.</div> : <div className="job-grid">{jobs.map((job) => { const match = job.matches[0]; return <article className="job-card" key={job.id}><div className="job-card-top"><span className="source-tag">{job.source}</span>{match && <strong className="match-score">{match.score}% match</strong>}</div><h2>{job.title}</h2><p className="job-company">{job.company}</p><p className="muted">{job.location} {job.remoteStatus ? `· ${job.remoteStatus}` : ""} {job.employmentType ? `· ${job.employmentType}` : ""}</p><p className="job-description">{job.description.slice(0, 210)}{job.description.length > 210 ? "..." : ""}</p><div className="skill-list">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><p className="job-date">{job.postedAt ? `Posted ${new Date(job.postedAt).toLocaleString()}` : "Posting date not provided by source"}</p><div className="job-actions"><a className="ghost-button" href={`/jobs/${job.id}`}>View job</a><button className="ghost-button" onClick={() => void shortlist(job.id)}>Shortlist</button><button className="primary-button" onClick={() => void prepare(job)} disabled={Boolean(job.application)}>{job.application ? job.application.status : "Prepare application"}<span>→</span></button></div></article>; })}</div>}</section>
    {preview && <div className="approval-backdrop"><section className="approval-modal application-preview" role="dialog" aria-modal="true"><p className="eyebrow cyan">APPLICATION PREVIEW</p><h2>{preview.job.title}</h2><p className="muted">{preview.job.company} · {preview.job.source}</p><div className="preview-fields">{preview.fields.map((field) => <div className="preview-field" key={field.fieldName}><span>{field.fieldName}</span><strong>{field.value ?? "Needs your input"}</strong><em>{field.status}</em></div>)}</div><p className="muted">NEXUS prepares only confirmed information. Final submission remains blocked until explicit approval.</p><div className="approval-actions"><button className="ghost-button" onClick={() => setPreview(null)}>Close</button><button className="primary-button" onClick={() => void prepareForm()} disabled={preparing}>{preparing ? "Preparing form..." : "Inspect and fill form"}<span>→</span></button><a className="ghost-button" href={preview.job.applicationUrl} target="_blank" rel="noreferrer">Open application page <span>↗</span></a></div></section></div>}
  </main>;
}
