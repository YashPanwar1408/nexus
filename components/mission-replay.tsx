"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useEffect, useState } from "react";

type Evidence = { id: string; type: string; url: string | null; screenshotPath: string | null; description: string };
type Step = { id: string; order: number; objective: string; action: string; status: string; actualOutcome: string | null; expectedOutcome: string | null; confidence: number | null; evidence: Evidence[] };
type Mission = { id: string; goal: string; status: string; steps: Step[] };

export function MissionReplay({ missionId }: { missionId: string }) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void fetch(`/api/missions/${missionId}`).then(async (response) => { const body = await response.json(); if (!response.ok) setError(body.error ?? "Replay unavailable"); else setMission(body); }); }, [missionId]);
  if (error) return <main className="app-shell"><p className="error-banner">{error}</p></main>;
  if (!mission) return <main className="app-shell"><div className="skeleton skeleton-large" /></main>;
  return <main className="app-shell"><header className="topbar"><a className="brand" href="/">NEXUS <span>MISSION CONTROL</span></a><a className="text-link" href={`/missions/${missionId}`}>Back to mission</a></header><section className="page-heading"><div><p className="eyebrow">Execution replay / {mission.status}</p><h1>What happened, step by step.</h1><p className="muted heading-copy">{mission.goal}</p></div></section><section className="replay-list">{mission.steps.length === 0 && <div className="empty-state">No execution steps have been recorded yet.</div>}{mission.steps.map((step) => <article className="replay-step" key={step.id}><div className="step-index">STEP {String(step.order).padStart(2, "0")}</div><div className="replay-content"><div className="replay-header"><div><p className="eyebrow">{step.status}</p><h2>{step.objective}</h2></div><span className="confidence">{step.confidence === null ? "Not verified" : `${Math.round(step.confidence * 100)}% confidence`}</span></div><div className="replay-grid"><div><p className="label">Action</p><p>{step.action}</p><p className="label">Expected</p><p className="muted">{step.expectedOutcome ?? "No expectation recorded"}</p><p className="label">Observation</p><p className="muted">{step.actualOutcome ?? "No observation recorded"}</p></div><div className="evidence-strip">{step.evidence.map((evidence) => <div className="evidence-item" key={evidence.id}>{evidence.screenshotPath ? <img src={evidence.screenshotPath} alt={`Evidence for step ${step.order}`} /> : <div className="evidence-placeholder">EVIDENCE</div>}<p>{evidence.description}</p>{evidence.url && <a href={evidence.url} target="_blank" rel="noreferrer">Open source</a>}</div>)}</div></div></div></article>)}</section></main>;
}
