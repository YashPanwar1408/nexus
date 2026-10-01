# NEXUS - AI Mission Control

NEXUS is an autonomous AI agent for real-world, multi-step tasks. A user gives NEXUS one natural-language goal. NEXUS then creates a structured plan, executes allowlisted browser actions, observes the result of every important action, verifies the result against evidence, recovers from bounded failures, pauses before risky actions, and records an auditable trace.

The central product rule is simple:

> An action executing is not the same as an action being verified successful.

NEXUS never reports success only because a click, navigation, or API call returned without throwing. A step needs an expected outcome, an observed outcome, evidence, a verification result, and a confidence value.

## What The App Demonstrates

The primary workflow is:

```text
User goal
  -> Structured AI plan
  -> Allowlisted tool execution
  -> Browser observation
  -> Evidence capture
  -> Outcome verification
  -> Recovery when verification fails
  -> Human approval for consequential actions
  -> Final execution and verification
  -> Auditable event trace and replay
```

Example goal:

```text
Find suitable software engineering internships posted in the last 48 hours and prepare applications.
```

The mission control screen shows the goal, current status, ordered steps, live persisted events, browser evidence, approval requests, and final replay.

## Main Screens

### Landing and Create Mission

The landing page explains the five core capabilities and provides the mission form:

- Browser, API, and MCP tool boundary
- Structured autonomous planning
- Evidence-based verification
- Human approval for risky actions
- Bounded automatic recovery

### Mission Control

The mission screen contains:

- Mission goal, status, start time, and progress
- Step-by-step execution timeline
- Current browser URL and latest screenshot evidence
- Persisted live event stream
- Approval modal for high-risk work
- Failure and paused states
- Link to execution replay after completion

### Approval

High-risk actions such as submitting an application, sending an email, purchasing, deleting, publishing, or making an irreversible change are paused. The approval request shows:

- Action
- Target
- Data being shared
- Reason
- Risk level

Approval authorizes execution. It does not mark the action successful. The action still needs real browser evidence and final verification.

### Execution Replay

Replay displays each step with:

- Action
- Expected outcome
- Observed outcome
- Evidence and screenshot
- Verification confidence
- Final status

### Evaluation Dashboard

The evaluation page calculates metrics from persisted missions. It does not fabricate production numbers. When no evaluated missions exist it displays `Not evaluated yet`.

## Architecture

```text
app/
  page.tsx                         Landing and mission creation
  missions/[id]/page.tsx           Mission control
  missions/[id]/replay/page.tsx    Execution replay
  dashboard/page.tsx               Evaluation dashboard
  api/                             Mission, approval, cancellation, event, and health APIs

components/
  mission-view.tsx                 Live mission control UI
  mission-replay.tsx               Evidence replay UI
  evaluation-dashboard.tsx         Grounded metrics UI

lib/
  agent/planner.ts                 Structured plan validation and demo planner
  agent/runner.ts                  Persisted execution loop
  agent/risk.ts                    Risk classification and approval policy
  browser/tool.ts                  Playwright allowlisted browser tool
  events/bus.ts                    Durable event creation and subscriptions
  llm/provider.ts                  Groq and Gemini provider abstraction
  recovery/policy.ts               Retry and timeout policy
  verification/verify.ts           Expected vs observed verification
  testing/scenarios.ts             Deterministic QA scenario harness

prisma/
  schema.prisma                    Mission, step, evidence, approval, and event models
  migrations/                      Database migrations

public/demo/jobs.html              Deterministic local browser fixture
scripts/benchmark.ts               Machine-readable benchmark report generator
scripts/demo.ts                    Demo mission creator
tests/                             Unit and deterministic agent scenario tests
```

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript with strict checking
- PostgreSQL
- Prisma ORM
- Playwright
- Groq Cloud through the Groq OpenAI-compatible chat endpoint
- Optional Gemini provider
- Zod structured validation
- Vitest
- Tailwind CSS/PostCSS

## Requirements

Install these before setup:

- Node.js 22 or newer
- npm
- PostgreSQL 14 or newer, local or hosted
- Chromium for Playwright
- A Groq API key for real planning, or Gemini as an alternative

The app can build and run its deterministic tests without an LLM key. Real planning requires a configured provider.

## First-Time Setup

### 1. Install dependencies

From the repository root:

```powershell
npm install
```

If PowerShell reports that `npm` is not recognized, use the full Windows Node path:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
```

### 2. Install Playwright Chromium

```powershell
npx playwright install chromium
```

If `npx` is not available:

```powershell
& "C:\Program Files\nodejs\npx.cmd" playwright install chromium
```

### 3. Create the environment file

```powershell
Copy-Item .env.example .env
```

Edit `.env` and fill in a real database URL and provider key. Never put real credentials in `.env.example` or commit `.env`.

Example provider configuration:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/nexus?schema=public"
LLM_PROVIDER="groq"
GROQ_API_KEY="your_groq_key"
GROQ_BASE_URL="https://api.groq.com/openai/v1"
GROQ_MODEL="openai/gpt-oss-120b"
```

The Groq model is configurable. If `openai/gpt-oss-120b` is unavailable or rate-limited for the account, set `GROQ_MODEL` to a model currently available in Groq Cloud. Do not hardcode a key in source code.

### 4. Prepare the database

Create a PostgreSQL database named `nexus`, then run:

```powershell
npm run db:migrate
```

Optional seed data:

```powershell
npm run db:seed
```

The health endpoint is:

```text
http://localhost:3000/api/health
```

A `503` response means the database is unavailable. NEXUS does not silently continue with fake state.

## Run The Application

### Development mode

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

If `npm` is not on the PowerShell PATH:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

### Production mode

```powershell
npm run build
npm run start
```

The production server uses the same `.env` configuration and requires the database to be migrated first.

## Run A Real Mission

1. Open `http://localhost:3000`.
2. Enter a goal or use the internship example.
3. Select **Start mission**.
4. On the mission page, select **Start execution**.
5. NEXUS requests a structured plan from Groq Cloud.
6. NEXUS persists the plan as `AgentStep` records.
7. Browser steps execute through the Playwright allowlist.
8. Evidence is captured after each important action.
9. Verification decides whether the observed result supports the expected result.
10. Failed verification triggers a bounded recovery attempt.
11. High-risk steps pause and display the approval modal.
12. Select **Approve & Continue** or **Reject**.
13. Review the persisted event stream and open **Execution Replay** after completion.

The UI polls persisted mission state. It does not use fake timers or simulated progress, so refresh and server restart preserve the durable mission trace.

## Run The Deterministic Demo

The demo avoids third-party website changes. It uses the local fixture at `public/demo/jobs.html` while exercising the real Playwright browser, evidence capture, verification, and approval flow.

PowerShell terminal 1:

```powershell
$env:DEMO_MODE="true"
$env:ALLOW_LOCAL_BROWSER="true"
npm run dev
```

PowerShell terminal 2:

```powershell
npm run demo
```

Open the mission URL printed by the script. Select **Start execution**.

The demo workflow is:

1. Navigate to the local demo job board.
2. Extract the software engineering internship listing.
3. Verify that the fresh listing is visible.
4. Pause before the submit action.
5. Approve the action in Mission Control.
6. Click the local application control.
7. Observe the confirmation text.
8. Verify the final state before completion.

To use real planning again, stop the server and set `DEMO_MODE="false"`.

## API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Database/application health |
| `GET` | `/api/missions` | Recent persisted missions |
| `POST` | `/api/missions` | Create a mission |
| `GET` | `/api/missions/:id` | Mission, steps, evidence, approvals, and events |
| `POST` | `/api/missions/:id/start` | Plan and execute/resume a mission |
| `POST` | `/api/missions/:id/approve` | Approve a pending action and resume |
| `POST` | `/api/missions/:id/reject` | Reject a pending action |
| `POST` | `/api/missions/:id/cancel` | Cancel a non-terminal mission |
| `GET` | `/api/missions/:id/events` | Read the persisted event stream |
| `GET` | `/api/evaluation` | Calculate metrics from persisted missions |

## Environment Variables

All variables are listed in `.env.example`.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LLM_PROVIDER` | Yes | `groq` or `gemini` |
| `GROQ_API_KEY` | For Groq | Groq Cloud API key; keep only in `.env` or a secret manager |
| `GROQ_BASE_URL` | No | Defaults to `https://api.groq.com/openai/v1` |
| `GROQ_MODEL` | No | Defaults to `openai/gpt-oss-120b` |
| `GEMINI_API_KEY` | For Gemini | Optional Gemini API key |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `APP_URL` | No | Defaults to `http://localhost:3000` |
| `BROWSER_ALLOWED_HOSTS` | No | Comma-separated exact browser host allowlist |
| `ALLOW_LOCAL_BROWSER` | No | Must be `true` for the local demo fixture |
| `AGENT_STEP_TIMEOUT_MS` | No | Per-step timeout, default `60000` |
| `AGENT_MAX_STEPS` | No | Maximum mission steps, default `30` |
| `DEMO_MODE` | No | Uses the deterministic local plan when `true` |

## Safety And Security Model

- The LLM cannot execute shell commands or arbitrary filesystem operations.
- Plans are validated with Zod and only predefined actions are accepted.
- Unsupported tools fail closed instead of returning success.
- Browser navigation accepts only HTTP and HTTPS URLs.
- Private, localhost, link-local, and metadata-resolved targets are blocked unless local browser mode is explicitly enabled.
- Optional exact host allowlisting is available through `BROWSER_ALLOWED_HOSTS`.
- Webpage text is untrusted observation data. It cannot override system policy or approval rules.
- High-risk actions are checked again by the runner immediately before execution.
- Step execution has a timeout, retry limit, and maximum mission step count.
- Duplicate execution attempts are locked in-process.
- Mission state, approvals, evidence, and events are persisted in PostgreSQL.
- API keys and credentials are not written to structured logs.
- The current app has no built-in user authentication. Put it behind an authenticated HTTPS reverse proxy before public deployment.

## Verification Rules

Every important action records:

- Expected outcome
- Observed outcome
- Evidence
- Pass/fail verification result
- Confidence from `0` to `1`
- Actual result and error details when applicable

## Real Internship Discovery

The internship workflow is a first-class domain feature, separate from generic mission metadata. It uses these persisted objects:

```text
UserProfile -> JobSearch -> Job -> JobMatch -> Application -> ApplicationEvent
```

Available screens:

- `/profile`: enter and confirm candidate details.
- `/jobs`: search configured sources, inspect source statuses, and review normalized job cards.
- `/jobs/:id`: inspect job details, source evidence, deterministic relevance, and application preparation.
- `/applications`: review prepared applications and explicitly approve submission.

Every live job must have a source, source job ID, source URL, application URL, extraction timestamp, and normalized fields. The UI never shows the deterministic demo listing in live mode.

### Supported Sources

- **LinkedIn**: public Jobs search through Playwright. Login walls, CAPTCHA, unusual-activity pages, and blocked access are reported; NEXUS does not bypass them.
- **Greenhouse**: public board API. Configure board identifiers in `GREENHOUSE_BOARDS`.
- **Lever**: public postings API. Configure site identifiers in `LEVER_SITES`.
- **Demo**: local static fixture only when `DEMO_MODE=true`.

Example source configuration:

```env
GREENHOUSE_BOARDS="company-one,company-two"
LEVER_SITES="company-one,company-two"
```

### Live Search Flow

1. Confirm a profile at `/profile`.
2. Open `/jobs`.
3. Set role, location, freshness window, and remote-only preference.
4. Select **Search with NEXUS**.
5. Review source statuses and source-attributed results.
6. Inspect relevance matches and source evidence.
7. Select **Prepare application**.
8. Review mapped and missing fields.
9. Select **Inspect and fill form** to open the real application page and fill only high-confidence fields.
10. Review the application in `/applications`.
11. Select **Approve & submit** only when ready.
12. NEXUS verifies the confirmation page, message, or URL. If verification is insufficient, the result is `UNKNOWN`, never `VERIFIED`.

### Application Safety

NEXUS never guesses ambiguous profile data, never submits before an explicit approval request, and never claims a successful application based only on a successful click. Missing resume/profile fields, login requirements, CAPTCHA, changed layouts, and uncertain confirmation are visible failure states.

The runner distinguishes:

```text
ACTION EXECUTED
```

from:

```text
ACTION VERIFIED SUCCESSFUL
```

A click can execute and still fail verification. A navigation can succeed technically while the page shows an authentication wall. A submission is never reported as complete without a positive observed confirmation.

## Testing

Run the complete local validation suite:

```powershell
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

The deterministic tests cover:

- Successful mission
- Browser timeout
- Missing selector
- Authentication wall
- Unexpected modal
- Invalid extracted data
- Malformed LLM output
- Tool failure
- Recovery attempt
- Human approval
- Human rejection
- Mission cancellation
- Server restart/resume
- Duplicate execution
- Final verification failure

Run the benchmark report:

```powershell
npm run benchmark
```

This writes `benchmark-report.json`. The report contains machine-readable scenario outcomes, completion time, step count, retry count, recovery result, verification result, approval events, and final outcome. It is a deterministic harness report, not fabricated production telemetry.

## UI Screenshots

Paste screenshots into `docs/screenshots/` and update the paths below. The directory is intentionally included as a place for submission screenshots.

### Landing Page

<!-- Paste the landing page screenshot below. Recommended file: docs/screenshots/landing-page.png -->

![NEXUS landing page](docs/screenshots/landing-page.png)

### Create Mission

<!-- Paste the create mission screenshot below. Recommended file: docs/screenshots/create-mission.png -->

![Create mission](docs/screenshots/create-mission.png)

### Mission Control

<!-- Paste the live mission control screenshot below. Recommended file: docs/screenshots/mission-control.png -->

![Mission control](docs/screenshots/mission-control.png)

### Human Approval

<!-- Paste the approval modal screenshot below. Recommended file: docs/screenshots/approval-modal.png -->

![Human approval modal](docs/screenshots/approval-modal.png)

### Execution Replay

<!-- Paste the execution replay screenshot below. Recommended file: docs/screenshots/execution-replay.png -->

![Execution replay](docs/screenshots/execution-replay.png)

### Evaluation Dashboard

<!-- Paste the evaluation dashboard screenshot below. Recommended file: docs/screenshots/evaluation-dashboard.png -->

![Evaluation dashboard](docs/screenshots/evaluation-dashboard.png)

## Production Deployment

```powershell
npm ci
npx playwright install chromium
npm run db:migrate
npm run build
npm run start
```

Production recommendations:

- Use managed PostgreSQL with SSL.
- Keep `.env` outside source control.
- Rotate any key that has been exposed.
- Keep `ALLOW_LOCAL_BROWSER=false`.
- Set `BROWSER_ALLOWED_HOSTS` to the smallest required list.
- Run behind HTTPS and an authenticated reverse proxy.
- Provide a persistent writable volume for `public/evidence` or replace it with object storage.
- Use a queue/worker and shared event transport when scaling beyond one Next.js process.
- Keep browser credentials in a managed secret store.

## Troubleshooting

### `npm` is not recognized

Use the full path:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

### `DATABASE_URL` is missing

Copy `.env.example` to `.env` and set a valid PostgreSQL URL. Restart the dev server after changing `.env`.

### Groq returns an authentication, rate-limit, or model error

Check the Groq Cloud API key and available models, then set `GROQ_MODEL` accordingly. The default is `openai/gpt-oss-120b`. Also verify the key has available quota. NEXUS reports provider errors instead of claiming a plan was created.

### Playwright cannot launch

Run:

```powershell
npx playwright install chromium
```

### The mission is paused

Inspect the Mission Control event stream. Common causes are a required approval, authentication wall, failed verification, exhausted retries, or a configured step timeout.

## Known Limitations

- The current non-demo executor has a real browser adapter; API and MCP adapters remain explicit fail-closed extension points.
- Browser authentication state is not persisted across a new browser process.
- Built-in API authentication and per-user authorization are deployment responsibilities.
- The in-process duplicate lock protects one Node process. Multi-process deployments need a distributed execution lock.
- Evaluation metrics are calculated only from persisted missions and show `Not evaluated yet` when no evaluated missions exist.
