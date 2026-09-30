import { z } from "zod";
import { createLlmProvider } from "@/lib/llm/provider";
import { classifyRisk, requiresApproval } from "@/lib/agent/risk";
import type { AgentPlan } from "@/lib/llm/types";
import { getEnv } from "@/lib/env";

const plannedStepSchema = z.object({
  objective: z.string().min(1).max(500), action: z.enum(["navigate", "search", "click", "type", "extract", "read", "observe", "screenshot", "analyze", "prepare", "submit"]), tool: z.enum(["browser", "api", "mcp", "human", "llm"]),
  target: z.string().optional(), expectedOutcome: z.string().min(1), requiresApproval: z.boolean().optional(), riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
const planSchema = z.object({ steps: z.array(plannedStepSchema).min(1).max(30) });

export async function planMission(goal: string): Promise<AgentPlan> {
  if (getEnv().DEMO_MODE) return demoPlan();
  const plan = planSchema.parse(await createLlmProvider().plan(goal));
  return { steps: plan.steps.map((step) => { const riskLevel = classifyRisk(step.action, step.riskLevel); return { ...step, riskLevel, requiresApproval: requiresApproval(riskLevel) || step.requiresApproval === true }; }) };
}

function demoPlan(): AgentPlan {
  return { steps: [
    { objective: "Open the deterministic demo job board", action: "navigate", tool: "browser", target: "http://localhost:3000/demo/jobs.html", expectedOutcome: "NEXUS Demo Jobs is visible", requiresApproval: false, riskLevel: "LOW" },
    { objective: "Extract fresh software engineering opportunities", action: "extract", tool: "browser", target: "main", expectedOutcome: "Software Engineering Intern is visible", requiresApproval: false, riskLevel: "LOW" },
    { objective: "Submit the prepared demo application", action: "submit", tool: "browser", target: "#submit-application", expectedOutcome: "Application submitted", requiresApproval: true, riskLevel: "HIGH" },
  ] };
}
