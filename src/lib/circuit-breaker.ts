import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { systemState } from "@/db/schema";

const CIRCUIT_BREAKER_KEY = "circuit_breaker";

interface CircuitBreakerState {
  tripped: boolean;
  reason: string | null;
  trippedAt: string | null;
}

export async function getCircuitBreakerState(): Promise<CircuitBreakerState> {
  const [row] = await db
    .select()
    .from(systemState)
    .where(eq(systemState.key, CIRCUIT_BREAKER_KEY));

  if (!row) return { tripped: false, reason: null, trippedAt: null };
  return row.value as CircuitBreakerState;
}

/**
 * Trips the system-wide pause. Once tripped, the worker must stop dispatching
 * new browser/API jobs until an operator clears it from the painel — this is
 * the last line of defense against account restriction, opt-out spikes, or
 * runaway AI behavior.
 */
export async function tripCircuitBreaker(reason: string) {
  const value: CircuitBreakerState = {
    tripped: true,
    reason,
    trippedAt: new Date().toISOString(),
  };
  await db
    .insert(systemState)
    .values({ key: CIRCUIT_BREAKER_KEY, value })
    .onConflictDoUpdate({ target: systemState.key, set: { value } });
}

export async function resetCircuitBreaker() {
  const value: CircuitBreakerState = { tripped: false, reason: null, trippedAt: null };
  await db
    .insert(systemState)
    .values({ key: CIRCUIT_BREAKER_KEY, value })
    .onConflictDoUpdate({ target: systemState.key, set: { value } });
}
