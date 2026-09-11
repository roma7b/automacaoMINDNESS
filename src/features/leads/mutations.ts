import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { leads } from "@/db/schema";
import type { QualificationResult } from "@/integrations/openai/qualify-lead";
import type { InstagramProfileSnapshot } from "./types";

export async function upsertDiscoveredLead(
  funnel: "customer" | "affiliate",
  profile: InstagramProfileSnapshot,
  qualification: QualificationResult,
  source: string,
) {
  const [row] = await db
    .insert(leads)
    .values({
      instagramUsername: profile.username,
      funnel,
      pipelineStatus: qualification.fitsIcp ? "qualified" : "discovered",
      icpScore: qualification.icpScore,
      profileType: qualification.profileType,
      profileSnapshot: profile,
      source,
    })
    .onConflictDoUpdate({
      target: [leads.instagramUsername, leads.funnel],
      set: {
        icpScore: qualification.icpScore,
        profileType: qualification.profileType,
        profileSnapshot: profile,
        pipelineStatus: qualification.fitsIcp ? "qualified" : "discovered",
        updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      },
    })
    .returning();

  return row;
}
