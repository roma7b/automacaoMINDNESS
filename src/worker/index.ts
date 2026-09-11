import "dotenv/config";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { jobs } from "@/db/schema";
import { getCircuitBreakerState, tripCircuitBreaker } from "@/lib/circuit-breaker";
import { canSendBrowserDmNow } from "@/lib/rate-limit";
import { dispatchJob } from "./dispatch";

const POLL_INTERVAL_MS = 5_000;
const CONSECUTIVE_FAILURE_LIMIT = 5;
// Generous on purpose: human-paced discovery (4-10s between every profile
// visit, by design) legitimately takes minutes for just a handful of leads.
// This ceiling exists to catch genuine hangs, not to rush the pacing.
const JOB_TIMEOUT_MS = 20 * 60_000;

let consecutiveFailures = 0;

/**
 * A job stuck at "running" can only mean the previous worker process died
 * mid-job (crash, kill signal) — this process just started, so nothing else
 * could be holding it. Reclaiming at boot is what makes restart recovery
 * work instead of jobs staying stuck forever.
 */
async function reclaimOrphanedJobs() {
  const reclaimed = await db
    .update(jobs)
    .set({ status: "pending", lastError: "Reclamado após reinício do worker" })
    .where(eq(jobs.status, "running"))
    .returning({ id: jobs.id });

  if (reclaimed.length > 0) {
    console.warn(
      `[worker] ${reclaimed.length} job(s) travado(s) em "running" recuperado(s): ${reclaimed.map((j) => j.id).join(", ")}`,
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms`)), ms),
    ),
  ]);
}

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
    await withTimeout(dispatchJob(job), JOB_TIMEOUT_MS, `job ${job.id} (${job.type})`);
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
  await reclaimOrphanedJobs();
  console.log("[worker] iniciado, aguardando jobs...");
  for (;;) {
    await runOnce().catch((error) => console.error("[worker] erro no loop:", error));
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();
