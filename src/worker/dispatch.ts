import type { InferSelectModel } from "drizzle-orm";
import type { jobs } from "@/db/schema";
import { runHashtagDiscovery } from "@/features/leads/discovery-pipeline";

type Job = InferSelectModel<typeof jobs>;

interface DiscoverHashtagPayload {
  hashtag: string;
  funnel?: "customer" | "affiliate";
  maxNewLeads?: number;
}

function parsePayload<T>(job: Job): T {
  return job.payload as T;
}

export async function dispatchJob(job: Job): Promise<void> {
  switch (job.type) {
    case "discover_hashtag": {
      const payload = parsePayload<DiscoverHashtagPayload>(job);
      const summary = await runHashtagDiscovery(payload.hashtag, payload.funnel ?? "customer", {
        maxNewLeads: payload.maxNewLeads,
      });
      console.log("[worker] descoberta concluída:", summary);
      return;
    }
    default:
      throw new Error(`Tipo de job não implementado ainda: ${job.type}`);
  }
}
