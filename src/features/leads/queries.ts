import { count } from "drizzle-orm";
import { db } from "@/db/client";
import { leads } from "@/db/schema";

export async function countLeadsByPipelineStatus() {
  const rows = await db
    .select({ status: leads.pipelineStatus, funnel: leads.funnel, total: count() })
    .from(leads)
    .groupBy(leads.pipelineStatus, leads.funnel);

  return rows;
}

export async function countLeadsTotal() {
  const [row] = await db.select({ total: count() }).from(leads);
  return row?.total ?? 0;
}
