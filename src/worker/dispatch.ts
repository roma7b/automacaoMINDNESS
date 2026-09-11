import type { InferSelectModel } from "drizzle-orm";
import type { jobs } from "@/db/schema";
import { runHashtagDiscovery } from "@/features/leads/discovery-pipeline";
import { sendFirstContact } from "@/features/leads/first-contact-pipeline";

type Job = InferSelectModel<typeof jobs>;

interface DiscoverHashtagPayload {
  hashtag: string;
  funnel?: "customer" | "affiliate";
  maxNewLeads?: number;
  maxPosts?: number;
}

interface BrowserFirstContactPayload {
  leadId: number;
  dryRun?: boolean;
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
        maxPosts: payload.maxPosts,
      });
      console.log("[worker] descoberta concluída:", summary);
      return;
    }
    case "browser_first_contact": {
      const payload = parsePayload<BrowserFirstContactPayload>(job);
      const result = await sendFirstContact(payload.leadId, { dryRun: payload.dryRun ?? true });
      console.log(
        `[worker] primeiro contato ${result.dryRun ? "(DRY RUN)" : "(ENVIADO)"} pra @${result.username}:`,
        result,
      );
      return;
    }
    default:
      throw new Error(`Tipo de job não implementado ainda: ${job.type}`);
  }
}
