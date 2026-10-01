import { getEnv } from "@/lib/env";
import type { AgentPlan, LlmProvider } from "@/lib/llm/types";

const planSchema = JSON.stringify({ steps: [{ objective: "string", action: "string", tool: "browser|api|mcp|human", target: "string", expectedOutcome: "string", requiresApproval: "boolean", riskLevel: "LOW|MEDIUM|HIGH|CRITICAL" }] });

export function createLlmProvider(): LlmProvider {
  const env = getEnv();
  if (env.LLM_PROVIDER === "gemini") return new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  return new GroqProvider(env.GROQ_API_KEY, env.GROQ_BASE_URL, env.GROQ_MODEL);
}

class GroqProvider implements LlmProvider {
  constructor(private readonly apiKey: string | undefined, private readonly baseUrl: string, private readonly model: string) {}
  async plan(goal: string): Promise<AgentPlan> {
    if (!this.apiKey) throw new Error("Configuration error: GROQ_API_KEY is required for the groq provider");
    const response = await fetch(`${this.baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, temperature: 0, max_tokens: 1600, messages: [{ role: "system", content: `Return only valid JSON. Do not use markdown fences or commentary. Match this schema exactly: ${planSchema}` }, { role: "user", content: goal }] }) });
    if (!response.ok) {
      if (response.status === 429) throw new Error(`Groq rate limit reached for model ${this.model}; set GROQ_MODEL to an available model or retry later`);
      const details = await response.text();
      throw new Error(`Groq request failed with status ${response.status}: ${summarizeProviderError(details)}`);
    }
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return parsePlan(body.choices?.[0]?.message?.content);
  }
}

function summarizeProviderError(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    const error = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
    return (error ?? body).slice(0, 500);
  } catch { return body.slice(0, 500); }
}

class GeminiProvider implements LlmProvider {
  constructor(private readonly apiKey: string | undefined, private readonly model: string) {}
  async plan(goal: string): Promise<AgentPlan> {
    if (!this.apiKey) throw new Error("Configuration error: GEMINI_API_KEY is required for the gemini provider");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: `Return only JSON matching this schema: ${planSchema}\nGoal: ${goal}` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
    const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return parsePlan(body.candidates?.[0]?.content?.parts?.[0]?.text);
  }
}

function parsePlan(content: string | undefined): AgentPlan {
  if (!content) throw new Error("LLM returned an empty plan");
  const value: unknown = JSON.parse(content);
  if (!isAgentPlan(value)) throw new Error("LLM returned a plan with an invalid structure");
  return value;
}

function isAgentPlan(value: unknown): value is AgentPlan {
  if (!value || typeof value !== "object" || !Array.isArray((value as AgentPlan).steps)) return false;
  return (value as AgentPlan).steps.every((step) => typeof step.objective === "string" && typeof step.action === "string" && typeof step.expectedOutcome === "string" && typeof step.requiresApproval === "boolean");
}
