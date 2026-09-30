export type AgentPlan = {
  steps: Array<{
    objective: string;
    action: string;
    tool: "browser" | "api" | "mcp" | "human" | "llm";
    target?: string;
    expectedOutcome: string;
    requiresApproval: boolean;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }>;
};

export type LlmProvider = {
  plan(goal: string): Promise<AgentPlan>;
};
