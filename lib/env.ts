import { z } from "zod";

const envBoolean = z.preprocess((value) => {
  if (typeof value === "string") return value.toLowerCase() === "true";
  return value;
}, z.boolean().default(false));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  LLM_PROVIDER: z.enum(["grok", "gemini"]).default("grok"),
  XAI_API_KEY: z.string().optional(),
  XAI_BASE_URL: z.string().url().default("https://api.x.ai/v1"),
  XAI_MODEL: z.string().default("grok-3-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  BROWSER_ALLOWED_HOSTS: z.string().default(""),
  ALLOW_LOCAL_BROWSER: envBoolean,
  AGENT_STEP_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AGENT_MAX_STEPS: z.coerce.number().int().positive().max(100).default(30),
  DEMO_MODE: envBoolean,
  GREENHOUSE_BOARDS: z.string().default(""),
  LEVER_SITES: z.string().default(""),
});

export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Configuration error: ${result.error.issues.map((issue) => issue.path.join(".") + " is required").join(", ")}`);
  }
  return result.data;
}
