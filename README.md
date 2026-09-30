# NEXUS - AI Mission Control

NEXUS turns one natural-language goal into a controlled, auditable execution trace. It plans with structured JSON, uses allowlisted browser actions, observes every action, verifies outcomes against evidence, recovers within bounded limits, and pauses before consequential actions.

## Problem

Autonomous agents are useful only when their work can be inspected and stopped. NEXUS separates action execution from verification and makes human approval a durable state transition rather than a UI decoration.

## Architecture

- `app`: landing, mission control, replay, evaluation, and API routes.
- `lib/agent`: planner, risk policy, persisted execution runner, and mission state.
- `lib/browser`: Playwright browser boundary. The model selects predefined actions only.
- `lib/verification`: expected vs observed verification with confidence.
- `lib/recovery`: bounded retry and timeout policies.
- `lib/events`: Postgres-backed audit events plus structured correlation logs.
- `prisma`: missions, steps, evidence, approvals, and events.
- `lib/testing` and `scripts`: deterministic QA scenarios and benchmark report generation.

## Features

- OpenAI-compatible and Gemini planning providers.
- Browser actions: navigate, search, click, structured type, extract, read, observe, screenshot, and submit.
- High-risk approval enforcement even when a model incorrectly marks the action as safe.
- SSRF protection for private, localhost, link-local, and metadata-resolved browser targets.
- Per-step timeout, maximum mission steps, maximum attempts, duplicate execution lock, cancellation, and resume.
- Evidence screenshots stored under `public/evidence` and linked from replay.
- Dark Mission Control UI, approval modal, failure state, execution replay, and grounded evaluation dashboard.

## Requirements

- Node.js 22+
- PostgreSQL 14+
- Playwright Chromium binaries: `npx playwright install chromium`
- An OpenAI-compatible key or Gemini key for non-demo planning

## Setup

```powershell
Copy-Item .env.example .env
npm install
npx playwright install chromium
```

Create a PostgreSQL database named `nexus`, set `DATABASE_URL` in `.env`, then run:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. `npm run start` serves the production build after `npm run build`.

## Environment variables

`.env.example` documents every variable:

- `DATABASE_URL`: PostgreSQL connection string.
- `LLM_PROVIDER`: `openai` or `gemini`.
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`: OpenAI-compatible provider settings.
- `GEMINI_API_KEY`, `GEMINI_MODEL`: Gemini provider settings.
- `APP_URL`: public application URL used by scripts.
- `BROWSER_ALLOWED_HOSTS`: optional comma-separated exact host allowlist.
- `ALLOW_LOCAL_BROWSER`: set `true` only for the local deterministic demo.
- `AGENT_STEP_TIMEOUT_MS`: per-step execution deadline.
- `AGENT_MAX_STEPS`: mission plan limit.
- `DEMO_MODE`: enables the deterministic local planner; defaults to `false`.

Missing credentials and database configuration are surfaced as errors. They never produce a successful mission.

## Testing

```powershell
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

The Vitest suite covers successful execution, timeout, missing selector, authentication wall, unexpected modal, invalid extraction, malformed LLM output, tool failure, recovery, approval, rejection, cancellation, restart/resume, duplicate execution, and final verification failure. The scenario harness is deterministic and each case returns a structured result.

## Benchmark

The benchmark is a deterministic policy/integration harness, not fabricated production telemetry:

```powershell
npm run benchmark
```

It writes `benchmark-report.json` with 15 scenarios, completion time, steps, retries, recovery, verification, approval events, and final outcome.

## Demo workflow

The demo uses `public/demo/jobs.html`, a stable local page, but exercises the real Playwright browser and approval path:

```powershell
$env:DEMO_MODE="true"
$env:ALLOW_LOCAL_BROWSER="true"
npm run dev
```

In another terminal, with Postgres running:

```powershell
npm run db:migrate
npm run demo
```

Open the printed mission URL and press **Start execution**. NEXUS navigates to the local job board, extracts a fresh internship, pauses before the submit action, then continues only after approval. The browser observes the confirmation text before marking the final step successful.

## Security model

- The LLM cannot execute shell commands or access files. It can only emit validated actions from the planner schema.
- Browser navigation accepts HTTP(S) only, blocks private addresses by default, and supports exact host allowlisting.
- Webpage text is treated as observation data, not instructions. It is never merged into the planner system rules.
- High-risk actions require a persisted approval record. The runner checks risk again before execution.
- Output is stored as text/JSON; no unsafe HTML rendering is used.
- API keys are read only from environment variables and are not included in structured logs.
- Local development has no user authentication layer; deploy behind an authenticated reverse proxy before exposing it publicly.

## Human approval model

Search, read, extract, and compare actions are low risk. Preparing drafts is medium risk. Submission, sending, purchasing, deleting, publishing, and other irreversible actions are high risk. High and critical actions pause the runner. Approval authorizes the action; only browser evidence and verification can mark it successful. Rejection skips the step and never reports completion.

## Production and deployment

```powershell
npm ci
npm run db:migrate
npm run build
npm run start
```

Run the Next.js process behind TLS and an authenticated proxy. Use managed Postgres, set `BROWSER_ALLOWED_HOSTS`, keep `ALLOW_LOCAL_BROWSER=false`, install Chromium in the worker image, and provide a persistent writable evidence volume. The current event bus is process-local for subscribers but durable events are written to Postgres; use a queue/pub-sub worker when scaling beyond one process.

## Known limitations

- API authentication and per-user authorization are intentionally left to the deployment proxy.
- The current non-demo executor is browser-only; API/MCP adapters remain explicit extension points and fail closed when unregistered.
- Browser authentication state is not persisted across a new browser process; authentication walls pause for intervention and require a configured session strategy for production.
- Evaluation metrics are calculated only from persisted missions. With no evaluated missions they display `Not evaluated yet`.
