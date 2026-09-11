import "dotenv/config";
import { db } from "@/db/client";
import { jobs } from "@/db/schema";

const hashtag = process.argv[2];
if (!hashtag) {
  console.error("Uso: pnpm tsx scripts/enqueue-discovery.ts <hashtag> [maxNewLeads]");
  process.exit(1);
}

const maxNewLeads = Number(process.argv[3] ?? 15);

async function main() {
  const [job] = await db
    .insert(jobs)
    .values({
      type: "discover_hashtag",
      payload: { hashtag, funnel: "customer", maxNewLeads },
      runAt: new Date().toISOString(),
    })
    .returning();

  console.log(`Job #${job.id} enfileirado para #${hashtag}. Rode "pnpm run worker" pra processar.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
