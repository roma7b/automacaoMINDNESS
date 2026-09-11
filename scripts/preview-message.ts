import "dotenv/config";
import { withOperatorBrowserPage } from "@/integrations/browser/cdp";
import { fetchProfileSnapshot } from "@/integrations/instagram/profile";
import { qualifyLead } from "@/integrations/openai/qualify-lead";
import { draftFirstContactMessage } from "@/integrations/openai/draft-message";

const usernames = process.argv.slice(2);
if (usernames.length === 0) {
  console.error("Uso: pnpm tsx scripts/preview-message.ts <username> [username2] ...");
  process.exit(1);
}

async function main() {
  await withOperatorBrowserPage(async (page) => {
    for (const username of usernames) {
      console.log(`\n=== @${username} ===`);
      const profile = await fetchProfileSnapshot(page, username);
      console.log("bio:", profile.bio || "(vazia)");
      console.log("seguidores:", profile.followers, "| legendas capturadas:", profile.recentCaptions.length);

      const qualification = await qualifyLead(profile);
      console.log("score ICP:", qualification.icpScore, "| fitsIcp:", qualification.fitsIcp);
      console.log("motivo:", qualification.reasoning);

      if (qualification.fitsIcp) {
        const draft = await draftFirstContactMessage(profile);
        console.log("\nMENSAGEM QUE SERIA ENVIADA:\n" + draft.message);
      } else {
        console.log("(não geraria mensagem — fora do ICP)");
      }
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
