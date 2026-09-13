import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, leads } from "@/db/schema";
import { withOperatorBrowserPage } from "@/integrations/browser/cdp";
import {
  collectPostUrlsFromHashtag,
  extractAuthorUsernameFromPost,
} from "@/integrations/instagram/discovery";
import { fetchProfileSnapshot } from "@/integrations/instagram/profile";
import { qualifyLead } from "@/integrations/openai/qualify-lead";
import { canVisitProfileNow, randomDiscoveryDelayMs } from "@/lib/rate-limit";
import { upsertDiscoveredLead } from "./mutations";

export interface DiscoveryRunSummary {
  hashtag: string;
  postsScanned: number;
  profilesVisited: number;
  newQualifiedLeads: number;
  skippedExisting: number;
}

async function isAlreadyKnown(username: string, funnel: "customer" | "affiliate") {
  const [existing] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.instagramUsername, username), eq(leads.funnel, funnel)));
  return Boolean(existing);
}

async function logProfileViewed(username: string) {
  await db.insert(auditLog).values({
    entityType: "instagram_profile",
    entityId: username,
    event: "profile_viewed",
  });
}

/**
 * One browser job: opens a single tab, scrolls a hashtag's grid for post
 * URLs, then visits each new author's profile to qualify them — all gated
 * by the same daily visit cap and operating-hours check the DM sender uses,
 * so discovery and outreach share one account-health budget.
 */
export async function runHashtagDiscovery(
  hashtag: string,
  funnel: "customer" | "affiliate" = "customer",
  { maxNewLeads = 15, maxPosts = 15 }: { maxNewLeads?: number; maxPosts?: number } = {},
): Promise<DiscoveryRunSummary> {
  return withOperatorBrowserPage(async (page) => {
    console.log(`[discovery] coletando posts de #${hashtag}...`);
    const postUrls = await collectPostUrlsFromHashtag(page, hashtag, { maxPosts });
    console.log(`[discovery] ${postUrls.length} posts coletados`);

    let profilesVisited = 0;
    let newQualifiedLeads = 0;
    let skippedExisting = 0;
    const seenUsernames = new Set<string>();

    for (const postUrl of postUrls) {
      if (newQualifiedLeads >= maxNewLeads) break;

      const gate = await canVisitProfileNow();
      if (!gate.allowed) {
        console.warn(`[discovery] parando: ${gate.reason}`);
        break;
      }

      console.log(`[discovery] abrindo post ${postUrl}...`);
      const username = await extractAuthorUsernameFromPost(page, postUrl);
      console.log(`[discovery] autor extraído: ${username ?? "(nenhum)"}`);
      await new Promise((resolve) => setTimeout(resolve, randomDiscoveryDelayMs()));

      if (!username || seenUsernames.has(username)) continue;
      seenUsernames.add(username);

      if (await isAlreadyKnown(username, funnel)) {
        skippedExisting++;
        continue;
      }

      console.log(`[discovery] abrindo perfil @${username}...`);
      const profile = await fetchProfileSnapshot(page, username);
      console.log(`[discovery] perfil obtido, seguidores=${profile.followers}, qualificando...`);
      await logProfileViewed(username);
      profilesVisited++;

      const qualification = await qualifyLead(profile);
      const lead = await upsertDiscoveredLead(funnel, profile, qualification, `hashtag:${hashtag}`);
      if (qualification.fitsIcp) {
        newQualifiedLeads++;
        console.log(
          `[discovery] QUALIFICADO @${username} score ${qualification.icpScore.toFixed(2)} (lead #${lead.id}) — ${qualification.reasoning}`,
        );
      } else {
        console.log(
          `[discovery] @${username} -> score ${qualification.icpScore.toFixed(2)} (lead #${lead.id}, fora do ICP)`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, randomDiscoveryDelayMs()));
    }

    return {
      hashtag,
      postsScanned: postUrls.length,
      profilesVisited,
      newQualifiedLeads,
      skippedExisting,
    };
  });
}
