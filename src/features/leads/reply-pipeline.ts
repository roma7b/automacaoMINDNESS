import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, leads, messages } from "@/db/schema";
import { withOperatorBrowserPage } from "@/integrations/browser/cdp";
import { readThreadMessages } from "@/integrations/instagram/inbox";
import { suggestReply } from "@/integrations/openai/suggest-reply";

export class LeadNotFoundError extends Error {}

export interface CheckInboxResult {
  username: string;
  newInboundMessages: number;
  suggestionGenerated: boolean;
}

/**
 * Read-only: opens the thread, diffs the visible text against messages we
 * already know about (sent by us, or already recorded as received), and
 * treats anything new as an inbound reply. Never types or sends anything.
 */
export async function checkInboxForReply(leadId: number): Promise<CheckInboxResult> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new LeadNotFoundError(`Lead #${leadId} não encontrado`);

  const knownMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, leadId))
    .orderBy(asc(messages.createdAt));
  const knownContent = new Set(knownMessages.map((m) => m.content.trim()));
  // Static profile chrome (bio, category, follow button) captured right
  // after sending — it sits mounted under the thread overlay on every
  // check and would otherwise look "new" forever, since it never becomes
  // a row in `messages`.
  for (const text of lead.threadBaseline ?? []) knownContent.add(text.trim());

  const result = await withOperatorBrowserPage(async (page) => {
    const threadTexts = await readThreadMessages(page, lead.instagramUsername);
    const newTexts = threadTexts.filter((text) => !knownContent.has(text));
    return { threadTexts, newTexts };
  });

  await db.update(leads).set({ lastInboxCheckAt: new Date().toISOString() }).where(eq(leads.id, leadId));
  await db.insert(auditLog).values({
    entityType: "instagram_thread",
    entityId: lead.instagramUsername,
    event: "inbox_checked",
  });

  if (result.newTexts.length === 0) {
    return { username: lead.instagramUsername, newInboundMessages: 0, suggestionGenerated: false };
  }

  for (const text of result.newTexts) {
    await db.insert(messages).values({
      leadId,
      direction: "inbound",
      channel: "browser",
      content: text,
      status: "delivered",
    });
  }

  const fullHistory = await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, leadId))
    .orderBy(asc(messages.createdAt));

  const suggestion = await suggestReply(
    fullHistory.map((m) => ({ direction: m.direction as "inbound" | "outbound", content: m.content })),
    leadId,
  );

  await db
    .update(leads)
    .set({
      pipelineStatus: "replied",
      channelStatus: suggestion.intent === "opt_out" ? "do_not_contact" : "human_review_required",
      doNotContact: suggestion.intent === "opt_out",
      doNotContactReason: suggestion.intent === "opt_out" ? "Pedido de parar via Instagram" : undefined,
      suggestedReply: suggestion.suggestedReply,
      suggestedReplyAt: new Date().toISOString(),
    })
    .where(eq(leads.id, leadId));

  return {
    username: lead.instagramUsername,
    newInboundMessages: result.newTexts.length,
    suggestionGenerated: true,
  };
}
