import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const businessConfigSchema = z.object({
  owner: z.object({ name: z.string().min(1), role: z.string().min(1) }),
  company: z.object({
    name: z.string().min(1),
    website: z.string().min(1),
    instagramHandle: z.string().min(1),
  }),
  channels: z.object({
    whatsappLink: z.string().min(1),
    affiliateGroupLink: z.string().optional().default(""),
  }),
  offer: z.object({
    onePagePitch: z.string().min(1),
    howItWorks: z.array(z.string()).min(1),
    revenueModel: z.string().min(1),
    marketJargon: z
      .array(z.object({ term: z.string(), meaning: z.string() }))
      .default([]),
  }),
  claims: z.object({
    verified: z.array(z.string()).default([]),
    unverified: z.array(z.string()).default([]),
  }),
  icp: z.object({
    segments: z.array(z.string()).min(1),
    keywords: z.array(z.string()).min(1),
    geography: z.string().min(1),
  }),
  affiliates: z.object({
    topics: z.array(z.string()).default([]),
  }),
});

export type BusinessConfig = z.infer<typeof businessConfigSchema>;

let cached: BusinessConfig | null = null;

/**
 * config/business.json is gitignored on purpose — it holds real business
 * identity, offer, and claims. Nothing in this file may be hardcoded
 * elsewhere in the codebase.
 */
export function getBusinessConfig(): BusinessConfig {
  if (cached) return cached;

  const configPath = path.join(process.cwd(), "config", "business.json");
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    throw new Error(
      `config/business.json não encontrado. Copie config/business.example.json para config/business.json e preencha com os dados reais do negócio.`,
    );
  }

  const parsed = businessConfigSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`config/business.json inválido:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
