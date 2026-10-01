"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState } from "react";

type Application = { id: string; status: string; applicationUrl: string; job: { title: string; company: string; source: string; id: string }; fields: Array<{ fieldName: string; status: string }>; events: Array<{ eventType: string; message: string; createdAt: string }> };

export function ApplicationsView() {
  const [applications, setApplications] = useState<Application[]>([]); const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/applications?userId=local-user"); setApplications(await response.json()); }
  useEffect(() => { void load(); }, []);
  async function submit(application: Application) { setMessage(""); const response = await fetch(`/api/applications/${application.id}/submit`, { method: "POST" }); const body = await response.json(); setMessage(response.ok ? `Submission result: ${body.status}` : body.error ?? "Submission failed"); await load(); }
  return <main className="app-shell"><header className="topbar"><a className="brand" href="/">NEXUS <span>MISSION CONTROL</span></a><nav><a className="text-link" href="/jobs">Job mission</a><a className="text-link" href="/profile">Profile</a></nav></header><section className="page-heading"><p className="eyebrow cyan">Applications / execution history</p><h1>Every application, accounted for.</h1><p className="muted heading-copy">Submission is never implied. Status changes only after the browser produces evidence and verification.</p></section><section className="application-list">{message && <p className="success-note">{message}</p>}{applications.length === 0 ? <div className="empty-state">No applications prepared yet. Search jobs to begin.</div> : applications.map((application) => <article className="application-row" key={application.id}><div><span className="source-tag">{application.job.source}</span><h2>{application.job.title}</h2><p className="muted">{application.job.company}</p></div><div><span className={`status-pill ${application.status.toLowerCase()}`}>{application.status.replaceAll("_", " ")}</span><p className="muted">{application.fields.filter((field) => field.status === "MAPPED").length} mapped field(s)</p></div><div className="application-row-actions"><a className="ghost-button" href={`/jobs/${application.job.id}`}>View job</a>{application.status === "AWAITING_APPROVAL" && <button className="danger-button" onClick={() => void submit(application)}>Approve &amp; submit</button>}</div></article>)}</section></main>;
}
