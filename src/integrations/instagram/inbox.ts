import type { Page } from "playwright";
import { openDmComposer } from "@/integrations/browser/send-dm";

// UI chrome that shows up as text near the thread but isn't message content —
// filtered out rather than relied on to positively identify real messages,
// since we don't know Instagram's exact DOM well enough to target it directly.
const NOISE_PATTERNS = [
  /^enviar$/i,
  /^send$/i,
  /^ativo\(a\)/i,
  /^active/i,
  /^\d+\s*(min|h|d|sem|s)$/i,
  /^hoje/i,
  /^today/i,
  /responder|reply|curtir|like|mensagem de áudio|audio message/i,
];

function looksLikeNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export class ThreadNotFoundError extends Error {
  constructor(username: string) {
    super(`Não consegui abrir a conversa com @${username}.`);
    this.name = "ThreadNotFoundError";
  }
}

/**
 * Reads whatever text is currently visible in the open DM thread. This has
 * NOT been validated against a real ongoing conversation yet (we only have
 * dry-run/no-reply threads so far) — Instagram's thread markup is unknown
 * territory the same way profile pages were before we tested those live.
 * `dir="auto"` is a common Meta-app pattern for user-generated text, used
 * here as a first guess; expect to revisit once a real reply exists.
 */
export async function readThreadMessages(page: Page, username: string): Promise<string[]> {
  await openDmComposer(page, username);
  await page.waitForTimeout(1000);

  const candidates = await page
    .locator('main div[dir="auto"]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));

  const seen = new Set<string>();
  const messages: string[] = [];
  for (const raw of candidates) {
    const text = raw.trim();
    if (looksLikeNoise(text) || seen.has(text)) continue;
    seen.add(text);
    messages.push(text);
  }

  return messages;
}
