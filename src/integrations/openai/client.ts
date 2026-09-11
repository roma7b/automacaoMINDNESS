import { and, gte, sum } from "drizzle-orm";
import OpenAI from "openai";
import { db } from "@/db/client";
import { aiCalls } from "@/db/schema";
import { getEnv } from "@/lib/env";

// USD per 1M tokens. Keep in sync with platform.openai.com/docs/pricing.
const MODEL_PRICING_PER_MILLION_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5.1-mini": { input: 0.25, output: 2 },
};

export class BudgetExceededError extends Error {
  constructor(spentUsd: number, budgetUsd: number) {
    super(
      `Orçamento mensal de IA excedido: gasto de $${spentUsd.toFixed(2)} atingiu o limite de $${budgetUsd.toFixed(2)}.`,
    );
    this.name = "BudgetExceededError";
  }
}

function estimateCostUsd(model: string, tokensInput: number, tokensOutput: number) {
  const pricing = MODEL_PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  return (
    (tokensInput / 1_000_000) * pricing.input +
    (tokensOutput / 1_000_000) * pricing.output
  );
}

function startOfCurrentMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getMonthToDateSpendUsd(): Promise<number> {
  const [row] = await db
    .select({ total: sum(aiCalls.costUsd) })
    .from(aiCalls)
    .where(and(gte(aiCalls.createdAt, startOfCurrentMonthIso())));
  return Number(row?.total ?? 0);
}

async function assertBudgetAvailable() {
  const env = getEnv();
  const spent = await getMonthToDateSpendUsd();
  if (spent >= env.OPENAI_MONTHLY_BUDGET_USD) {
    throw new BudgetExceededError(spent, env.OPENAI_MONTHLY_BUDGET_USD);
  }
}

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY });
  return client;
}

interface TrackedCallParams {
  purpose: string;
  model: string;
  leadId?: number;
  input: Omit<OpenAI.Responses.ResponseCreateParamsNonStreaming, "model" | "stream">;
}

/**
 * Every OpenAI call must go through here: it enforces the monthly budget
 * cutoff before the call and records tokens/cost after, so ai_calls stays
 * the single source of truth for cost-per-lead reporting.
 */
export async function createTrackedResponse({
  purpose,
  model,
  leadId,
  input,
}: TrackedCallParams) {
  await assertBudgetAvailable();

  const response = await getClient().responses.create({
    ...input,
    model,
    stream: false,
  });

  const tokensInput = response.usage?.input_tokens ?? 0;
  const tokensOutput = response.usage?.output_tokens ?? 0;
  const costUsd = estimateCostUsd(model, tokensInput, tokensOutput);

  await db.insert(aiCalls).values({
    leadId: leadId ?? null,
    purpose,
    model,
    tokensInput,
    tokensOutput,
    costUsd,
  });

  return response;
}
