"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState } from "react";

type Metrics = { missionSuccessRate: number | null; verificationAccuracy: number | null; recoverySuccessRate: number | null; averageExecutionTimeMs: number | null; unsafeActionsWithoutApproval: number; evaluatedMissions: number };

export function EvaluationDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null); const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/evaluation").then(async (response) => { const body = await response.json(); if (!response.ok) setError(body.error ?? "Evaluation unavailable"); else setMetrics(body); }).catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : "Evaluation unavailable")); }, []);
  return <main className="app-shell"><header className="topbar"><a className="brand" href="/">NEXUS <span>MISSION CONTROL</span></a><a className="text-link" href="/">New mission</a></header><section className="page-heading"><div><p className="eyebrow">Evaluation / grounded metrics</p><h1>Measure the agent, not the story.</h1><p className="muted heading-copy">Metrics are calculated from persisted mission traces. No benchmark run means no invented score.</p></div></section>{error ? <p className="error-banner">{error}</p> : <section className="metric-grid">{[["Mission success rate", metrics?.missionSuccessRate], ["Verification accuracy", metrics?.verificationAccuracy], ["Recovery success rate", metrics?.recoverySuccessRate], ["Average execution time", metrics?.averageExecutionTimeMs === null || metrics?.averageExecutionTimeMs === undefined ? null : `${Math.round(metrics.averageExecutionTimeMs / 1000)}s`], ["Unsafe actions without approval", metrics?.unsafeActionsWithoutApproval]].map(([label, value]) => <article className="metric-card" key={String(label)}><p className="label">{label}</p><strong>{metrics === null ? "—" : value === null || value === undefined ? "Not evaluated yet" : typeof value === "number" && String(label).includes("rate") ? `${Math.round(value * 100)}%` : value}</strong></article>)}</section>}{metrics && <p className="data-note">{metrics.evaluatedMissions === 0 ? "Not evaluated yet" : `Based on ${metrics.evaluatedMissions} evaluated mission${metrics.evaluatedMissions === 1 ? "" : "s"}.`}</p>}</main>;
}
