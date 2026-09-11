import "dotenv/config";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { jobs } from "@/db/schema";
import { getCircuitBreakerState, tripCircuitBreaker } from "@/lib/circuit-breaker";
import { canSendBrowserDmNow } from "@/lib/rate-limit";
import { dispatchJob } from "./dispatch";

const POLL_INTERVAL_MS = 5_000;
const CONSECUTIVE_FAILURE_LIMIT = 5;

let consecutiveFailures = 0;

async function claimNextJob() {
  const nowIso = new Date().toISOString();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "pending"), lte(jobs.runAt, nowIso)))
    .orderBy(jobs.runAt)
    .limit(1);

  if (!job) return null;

  const result = await db
    .update(jobs)
    .set({ status: "running", lockedAt: nowIso })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, "pending")))
    .returning();

  return result[0] ?? null;
}

async function runOnce() {
  const breaker = await getCircuitBreakerState();
  if (breaker.tripped) {
    console.warn(`[worker] pausado: ${breaker.reason}`);
    return;
  }

  const job = await claimNextJob();
  if (!job) return;

  if (job.type === "browser_first_contact") {
    const gate = await canSendBrowserDmNow();
    if (!gate.allowed) {
      await db
        .update(jobs)
        .set({ status: "pending", runAt: new Date(Date.now() + 60_000).toISOString() })
        .where(eq(jobs.id, job.id));
      console.log(`[worker] job ${job.id} adiado: ${gate.reason}`);
      return;
    }
  }

  try {
    await dispatchJob(job);
    await db.update(jobs).set({ status: "done" }).where(eq(jobs.id, job.id));
    consecutiveFailures = 0;
  } catch (error) {
    consecutiveFailures += 1;
    const attempts = job.attempts + 1;
    const failed = attempts >= job.maxAttempts;
    await db
      .update(jobs)
      .set({
        status: failed ? "dead_letter" : "pending",
        attempts,
        lastError: String(error),
        runAt: new Date(Date.now() + 30_000 * attempts).toISOString(),
      })
      .where(eq(jobs.id, job.id));

    console.error(`[worker] job ${job.id} falhou (tentativa ${attempts}):`, error);

    if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
      await tripCircuitBreaker(
        `${consecutiveFailures} falhas consecutivas — última: ${String(error)}`,
      );
    }
  }
}

async function main() {
  console.log("[worker] iniciado, aguardando jobs...");
  for (;;) {
    await runOnce().catch((error) => console.error("[worker] erro no loop:", error));
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();
