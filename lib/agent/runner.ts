import { prisma } from "@/lib/db/prisma";
import { emitEvent } from "@/lib/events/bus";
import { BrowserTool } from "@/lib/browser/tool";
import { canRetry } from "@/lib/recovery/policy";
import { withTimeout } from "@/lib/recovery/policy";
import { verifyExpectedOutcome } from "@/lib/verification/verify";
import { classifyRisk, requiresApproval } from "@/lib/agent/risk";
import { getEnv } from "@/lib/env";

const MAX_ATTEMPTS = 2;
const activeMissions = new Set<string>();

export async function runMission(missionId: string) {
  if (activeMissions.has(missionId)) return { status: "RUNNING" as const };
  activeMissions.add(missionId);
  let browser: BrowserTool | undefined;
  try {
    const env = getEnv();
    const existing = await prisma.mission.findUniqueOrThrow({ where: { id: missionId }, select: { status: true } });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(existing.status)) return { status: existing.status as "COMPLETED" | "FAILED" | "CANCELLED" };
    await prisma.mission.update({ where: { id: missionId }, data: { status: "RUNNING" } });
    await emitEvent({ missionId, eventType: "MISSION_STARTED", message: "Mission execution started" });
    while (true) {
      const currentMission = await prisma.mission.findUniqueOrThrow({ where: { id: missionId }, select: { status: true } });
      if (currentMission.status === "CANCELLED") return { status: "CANCELLED" as const };
      const stepCount = await prisma.agentStep.count({ where: { missionId } });
      if (stepCount > env.AGENT_MAX_STEPS) { await failMission(missionId, "Mission exceeded the configured maximum step count"); return { status: "FAILED" as const }; }
      const step = await prisma.agentStep.findFirst({ where: { missionId, status: "PENDING" }, orderBy: { order: "asc" } });
      if (!step) {
        const waiting = await prisma.agentStep.findFirst({ where: { missionId, status: "WAITING_APPROVAL" } });
        if (waiting) { await prisma.mission.update({ where: { id: missionId }, data: { status: "WAITING_APPROVAL" } }); return { status: "WAITING_APPROVAL" as const }; }
        const failed = await prisma.agentStep.findFirst({ where: { missionId, status: "FAILED" } });
        if (failed) { await prisma.mission.update({ where: { id: missionId }, data: { status: "FAILED" } }); await emitEvent({ missionId, eventType: "MISSION_FAILED", message: "Mission stopped because a step could not be verified" }); return { status: "FAILED" as const }; }
        await prisma.mission.update({ where: { id: missionId }, data: { status: "COMPLETED" } }); await emitEvent({ missionId, eventType: "MISSION_COMPLETED", message: "All steps completed and verified" }); return { status: "COMPLETED" as const };
      }
      const risk = classifyRisk(step.action);
      const approved = await prisma.approval.findFirst({ where: { missionId, stepId: step.id, status: "APPROVED" } });
      let approval = await prisma.approval.findFirst({ where: { missionId, stepId: step.id, status: "PENDING" } });
      if (requiresApproval(risk) && !approved && !approval) approval = await prisma.approval.create({ data: { missionId, stepId: step.id, action: step.action, target: step.target, reason: "This action may create an external or irreversible consequence", dataShared: step.target, riskLevel: risk } });
      if (approval) { await prisma.agentStep.update({ where: { id: step.id }, data: { status: "WAITING_APPROVAL" } }); await prisma.mission.update({ where: { id: missionId }, data: { status: "WAITING_APPROVAL" } }); await emitEvent({ missionId, stepId: step.id, eventType: "APPROVAL_REQUIRED", message: `Approval required for ${approval.action}`, metadata: { target: step.target, riskLevel: approval.riskLevel } }); return { status: "WAITING_APPROVAL" as const }; }
      browser ??= new BrowserTool();
      await executeStep(missionId, step, browser, env.AGENT_STEP_TIMEOUT_MS);
    }
  } finally { await browser?.close().catch(() => undefined); activeMissions.delete(missionId); }
}

async function executeStep(missionId: string, step: { id: string; objective: string; action: string; tool: string; target: string | null; expectedOutcome: string | null }, browser: BrowserTool, timeoutMs: number) {
  const current = await prisma.agentStep.findUniqueOrThrow({ where: { id: step.id }, select: { attempts: true } });
  if (current.attempts >= MAX_ATTEMPTS) { await prisma.agentStep.update({ where: { id: step.id }, data: { status: "FAILED", actualOutcome: "Retry limit exceeded" } }); return; }
  await prisma.agentStep.update({ where: { id: step.id }, data: { status: "RUNNING", attempts: { increment: 1 }, startedAt: new Date() } });
  await emitEvent({ missionId, stepId: step.id, eventType: "STEP_STARTED", message: step.objective });
  await emitEvent({ missionId, stepId: step.id, eventType: "TOOL_CALLED", message: `${step.tool}.${step.action}` });
  if (step.tool === "browser" && !["navigate", "search"].includes(step.action)) {
    const currentUrl = await browser.getCurrentUrl().catch(() => "about:blank");
    if (currentUrl === "about:blank") {
      const previousEvidence = await prisma.evidence.findFirst({ where: { step: { missionId }, url: { not: null } }, orderBy: { createdAt: "desc" }, select: { url: true } });
      if (previousEvidence?.url) await browser.navigate(previousEvidence.url);
    }
  }
  const result = step.tool === "browser" ? await withTimeout(browser.execute(step.action, step.target ?? undefined, missionId, step.id), timeoutMs, "Tool execution timed out").catch((error) => ({ success: false, output: error instanceof Error ? error.message : "Tool execution failed" })) : { success: false, output: `No executor registered for tool: ${step.tool}` };
  const observation = await withTimeout(browser.observe(missionId, step.id), timeoutMs, "Observation timed out").catch((error) => ({ url: "", title: "", text: error instanceof Error ? error.message : "Observation failed", screenshotPath: "" }));
  await prisma.evidence.create({ data: { stepId: step.id, type: "browser_observation", url: observation.url, screenshotPath: observation.screenshotPath, extractedData: { title: observation.title, actionSucceeded: result.success }, description: result.output } });
  await emitEvent({ missionId, stepId: step.id, eventType: "OBSERVATION_CAPTURED", message: "Browser state captured after tool action", metadata: { url: observation.url, title: observation.title } });
  if (observation.text.startsWith("[AUTHENTICATION_WALL]")) {
    await prisma.approval.create({ data: { missionId, stepId: step.id, action: "Authenticate browser session", target: observation.url, reason: "The target page requires human authentication before the agent can continue", dataShared: "Credentials are entered by the user in the browser", riskLevel: "MEDIUM" } });
    await prisma.agentStep.update({ where: { id: step.id }, data: { status: "WAITING_APPROVAL", actualOutcome: observation.text.slice(0, 20_000) } });
    await prisma.mission.update({ where: { id: missionId }, data: { status: "WAITING_APPROVAL" } });
    await emitEvent({ missionId, stepId: step.id, eventType: "APPROVAL_REQUIRED", message: "Human authentication is required before execution can continue", metadata: { url: observation.url } });
    return;
  }
  const verification = verifyExpectedOutcome(step.expectedOutcome ?? step.objective, `${result.output}\n${observation.text}`);
  if (verification.verified && result.success) { await prisma.agentStep.update({ where: { id: step.id }, data: { status: "SUCCEEDED", actualOutcome: `${result.output}\n${observation.text}`.slice(0, 20_000), confidence: verification.confidence, completedAt: new Date() } }); await emitEvent({ missionId, stepId: step.id, eventType: "VERIFICATION_PASSED", message: verification.summary, metadata: { confidence: verification.confidence } }); return; }
  await emitEvent({ missionId, stepId: step.id, eventType: "VERIFICATION_FAILED", message: verification.summary, metadata: { confidence: verification.confidence, output: result.output } });
  if (canRetry(current.attempts + 1, MAX_ATTEMPTS)) { await emitEvent({ missionId, stepId: step.id, eventType: "RECOVERY_STARTED", message: "Re-observing after an unverified action" }); await prisma.agentStep.update({ where: { id: step.id }, data: { status: "PENDING", actualOutcome: result.output, lastError: result.output } }); await emitEvent({ missionId, stepId: step.id, eventType: "RECOVERY_COMPLETED", message: "Step returned to the queue for one bounded retry" }); } else await prisma.agentStep.update({ where: { id: step.id }, data: { status: "FAILED", actualOutcome: result.output, lastError: result.output, confidence: verification.confidence, completedAt: new Date() } });
}

async function failMission(missionId: string, message: string) {
  await prisma.mission.update({ where: { id: missionId }, data: { status: "FAILED" } });
  await emitEvent({ missionId, eventType: "MISSION_FAILED", message });
}
