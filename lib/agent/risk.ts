export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const highRiskPatterns = /\b(submit|send|purchase|buy|delete|publish|irreversible|apply)\b/i;
const mediumRiskPatterns = /\b(prepare|draft|create|modify|edit)\b/i;

export function classifyRisk(action: string, declared?: RiskLevel): RiskLevel {
  if (declared) return declared;
  if (highRiskPatterns.test(action)) return "HIGH";
  if (mediumRiskPatterns.test(action)) return "MEDIUM";
  return "LOW";
}

export function requiresApproval(risk: RiskLevel) {
  return risk === "HIGH" || risk === "CRITICAL";
}
