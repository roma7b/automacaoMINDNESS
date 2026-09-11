import type { InferSelectModel } from "drizzle-orm";
import type { jobs } from "@/db/schema";

type Job = InferSelectModel<typeof jobs>;

export async function dispatchJob(job: Job): Promise<void> {
  switch (job.type) {
    default:
      throw new Error(`Tipo de job não implementado ainda: ${job.type}`);
  }
}
