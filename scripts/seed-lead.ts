import "dotenv/config";
import { withOperatorBrowserPage } from "@/integrations/browser/cdp";
import { fetchProfileSnapshot } from "@/integrations/instagram/profile";
import { qualifyLead } from "@/integrations/openai/qualify-lead";
import { upsertDiscoveredLead } from "@/features/leads/mutations";

const username = process.argv[2];
if (!username) {
  console.error("Uso: pnpm tsx scripts/seed-lead.ts <username>");
  process.exit(1);
}

async function main() {
  await withOperatorBrowserPage(async (page) => {
    const profile = await fetchProfileSnapshot(page, username);
    const qualification = await qualifyLead(profile);
    const lead = await upsertDiscoveredLead("customer", profile, qualification, "manual-seed");
    console.log("Lead salvo:", { id: lead.id, status: lead.pipelineStatus, score: qualification.icpScore });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
