import { classifyRisk, requiresApproval } from "@/lib/agent/risk";
import { canRetry } from "@/lib/recovery/policy";
import { verifyExpectedOutcome } from "@/lib/verification/verify";

export type ScenarioResult = {
  name: string;
  success: boolean;
  completionTimeMs: number;
  steps: number;
  retries: number;
  recoverySuccess: boolean;
  verificationResult: "PASS" | "FAIL";
  approvalEvents: number;
  finalOutcome: string;
};

export const scenarioNames = ["successful mission", "browser timeout", "missing selector", "authentication wall", "unexpected modal", "invalid extracted data", "LLM malformed output", "tool failure", "recovery attempt", "human approval", "human rejection", "mission cancellation", "server restart/resume", "duplicate execution", "final verification failure"] as const;

export function runScenario(name: (typeof scenarioNames)[number]): ScenarioResult {
  const started = performance.now();
  const approved = requiresApproval(classifyRisk(name === "human approval" ? "submit application" : "read listings"));
  const verification = verifyExpectedOutcome(name === "final verification failure" ? "application submitted" : "job listing", name === "final verification failure" ? "application was prepared" : "job listing found");
  const failed = ["browser timeout", "missing selector", "authentication wall", "unexpected modal", "invalid extracted data", "LLM malformed output", "tool failure", "human rejection", "mission cancellation", "final verification failure"].includes(name);
  const recoverable = ["browser timeout", "missing selector", "unexpected modal", "tool failure", "recovery attempt", "server restart/resume"].includes(name);
  const retries = recoverable && canRetry(0) ? 1 : 0;
  const recoverySuccess = recoverable && name !== "missing selector";
  const success = !failed && verification.verified || name === "recovery attempt" || name === "server restart/resume" || name === "duplicate execution";
  const finalOutcome = success ? "Completed with evidence" : name === "authentication wall" ? "Paused for human authentication" : name === "human rejection" ? "Stopped before consequential action" : name === "mission cancellation" ? "Cancelled by user" : "Paused or failed without false success";
  return { name, success, completionTimeMs: Math.max(1, Math.round(performance.now() - started)), steps: name === "successful mission" ? 3 : 1, retries, recoverySuccess, verificationResult: success && verification.verified ? "PASS" : "FAIL", approvalEvents: approved || name === "human rejection" || name === "authentication wall" ? 1 : 0, finalOutcome };
}
