import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  LLM_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  BROWSER_ALLOWED_HOSTS: z.string().default(""),
  ALLOW_LOCAL_BROWSER: z.coerce.boolean().default(false),
  AGENT_STEP_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AGENT_MAX_STEPS: z.coerce.number().int().positive().max(100).default(30),
  DEMO_MODE: z.coerce.boolean().default(false),
});

export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Configuration error: ${result.error.issues.map((issue) => issue.path.join(".") + " is required").join(", ")}`);
  }
  return result.data;
}
