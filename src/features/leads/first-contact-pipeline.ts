import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { leads, messages } from "@/db/schema";
import { withOperatorBrowserPage } from "@/integrations/browser/cdp";
import { captureFailureDiagnostics } from "@/integrations/browser/diagnostics";
import { sendDirectMessage } from "@/integrations/browser/send-dm";
import { scanVisibleThreadText } from "@/integrations/instagram/inbox";
import { draftFirstContactMessage } from "@/integrations/openai/draft-message";
import type { InstagramProfileSnapshot } from "./types";

export class LeadNotEligibleError extends Error {}

export interface FirstContactResult {
  username: string;
  message: string;
  sent: boolean;
  dryRun: boolean;
}

/**
 * Sends (or, by default, dry-runs) the first DM to a lead already sitting
 * at browser_contact_pending. The eligibility check + the mutex-guarded
 * browser job together are what stand in for row locking here — this
 * process only ever runs one browser job at a time.
 */
export async function sendFirstContact(
  leadId: number,
  { dryRun = true }: { dryRun?: boolean } = {},
): Promise<FirstContactResult> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new LeadNotEligibleError(`Lead #${leadId} não encontrado`);
  if (lead.doNotContact) {
    throw new LeadNotEligibleError(`Lead #${leadId} está em do_not_contact`);
  }
  if (lead.channelStatus !== "browser_contact_pending") {
    throw new LeadNotEligibleError(
      `Lead #${leadId} está em canal "${lead.channelStatus}", não elegível pra 1º contato`,
    );
  }

  const profile = lead.profileSnapshot as InstagramProfileSnapshot;
  const draft = await draftFirstContactMessage(profile, lead.id);

  return withOperatorBrowserPage(async (page) => {
    const consoleErrors: string[] = [];
    const networkFailures: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (request) => {
      networkFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    });

    try {
      const result = await sendDirectMessage(page, lead.instagramUsername, draft.message, { dryRun });

      if (!dryRun) {
        await db.insert(messages).values({
          leadId: lead.id,
          direction: "outbound",
          channel: "browser",
          content: draft.message,
          status: "sent",
          sentAt: new Date().toISOString(),
        });

        // Captured right now, before any reply can exist — this baseline is
        // what future inbox checks diff against, so it already contains
        // whatever profile chrome (bio, category, follow button) sits
        // mounted under the thread overlay.
        const baseline = await scanVisibleThreadText(page).catch(() => []);

        await db
          .update(leads)
          .set({
            pipelineStatus: "contacted",
            channelStatus: "waiting_inbound_reply",
            threadBaseline: baseline,
          })
          .where(eq(leads.id, lead.id));
      }

      return { username: lead.instagramUsername, message: draft.message, ...result };
    } catch (error) {
      const diagnosticsDir = await captureFailureDiagnostics(page, leadId, error, {
        consoleErrors,
        networkFailures,
      });

      await db.insert(messages).values({
        leadId: lead.id,
        direction: "outbound",
        channel: "browser",
        content: draft.message,
        status: "failed",
        error: `${String(error)} | diagnostics: ${diagnosticsDir}`,
      });

      throw error;
    }
  });
}
