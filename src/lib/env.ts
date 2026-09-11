import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  OPENAI_MODEL_FAST: z.string().min(1),
  OPENAI_MONTHLY_BUDGET_USD: z.coerce.number().positive(),

  CHROME_CDP_URL: z.string().url(),
  CHROME_PROFILE_DIR: z.string().min(1),

  INSTAGRAM_APP_SECRET: z.string().optional().default(""),
  INSTAGRAM_PAGE_ACCESS_TOKEN: z.string().optional().default(""),
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional().default(""),

  DATABASE_URL: z.string().min(1),

  MAX_DMS_PER_DAY: z.coerce.number().int().positive(),
  MIN_SECONDS_BETWEEN_DMS: z.coerce.number().int().positive(),
  MAX_SECONDS_BETWEEN_DMS: z.coerce.number().int().positive(),
  OPERATING_HOURS: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  OPERATING_TIMEZONE: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas ou ausentes:\n${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
