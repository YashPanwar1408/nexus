import type { AgentPlan } from "@/lib/llm/types";

export type AgentState = {
  missionId: string;
  status: "DRAFT" | "PLANNING" | "RUNNING" | "WAITING_APPROVAL" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";
  goal: string;
  plan?: AgentPlan;
  currentStepId?: string;
  lastVerifiedOutcome?: string;
  failure?: { message: string; recoverable: boolean };
};
