import "dotenv/config";
import { db } from "@/db/client";
import { jobs } from "@/db/schema";

const leadId = Number(process.argv[2]);
if (!leadId) {
  console.error("Uso: pnpm tsx scripts/enqueue-first-contact.ts <leadId> [--send]");
  console.error("Sem --send roda em dry-run: digita a mensagem mas não envia.");
  process.exit(1);
}

const dryRun = !process.argv.includes("--send");

async function main() {
  const [job] = await db
    .insert(jobs)
    .values({
      type: "browser_first_contact",
      payload: { leadId, dryRun },
      runAt: new Date().toISOString(),
    })
    .returning();

  console.log(
    `Job #${job.id} enfileirado pro lead #${leadId} — ${dryRun ? "DRY RUN (não envia de verdade)" : "ENVIO REAL"}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
