import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { leads, messages } from "@/db/schema";
import type { InstagramProfileSnapshot } from "./types";

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

export interface LeadListItem {
  id: number;
  instagramUsername: string;
  funnel: string;
  pipelineStatus: string;
  channelStatus: string;
  icpScore: number | null;
  profileType: string | null;
  source: string | null;
  doNotContact: boolean;
  createdAt: string;
  bio: string;
  hasSuggestion: boolean;
}

export async function listLeads(): Promise<LeadListItem[]> {
  const rows = await db
    .select()
    .from(leads)
    .orderBy(desc(leads.suggestedReplyAt), desc(leads.icpScore), desc(leads.createdAt));

  return rows.map((row) => {
    const snapshot = row.profileSnapshot as InstagramProfileSnapshot | null;
    return {
      id: row.id,
      instagramUsername: row.instagramUsername,
      funnel: row.funnel,
      pipelineStatus: row.pipelineStatus,
      channelStatus: row.channelStatus,
      icpScore: row.icpScore,
      profileType: row.profileType,
      source: row.source,
      doNotContact: row.doNotContact,
      createdAt: row.createdAt,
      bio: snapshot?.bio ?? "",
      hasSuggestion: Boolean(row.suggestedReply),
    };
  });
}

export async function getLeadById(id: number) {
  const [row] = await db.select().from(leads).where(eq(leads.id, id));
  return row ?? null;
}

export async function getMessagesForLead(leadId: number) {
  return db.select().from(messages).where(eq(messages.leadId, leadId)).orderBy(asc(messages.createdAt));
}
