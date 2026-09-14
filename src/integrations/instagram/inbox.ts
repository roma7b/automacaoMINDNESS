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
  // Confirmed live: opening the composer from a profile page overlays the
  // thread on top of that same profile — its bio link and follow button
  // stay mounted underneath and show up in the same dir="auto" scan.
  /^seguir$/i,
  /^follow$/i,
  /^seguindo$/i,
  /^following$/i,
  /^[a-z0-9-]+\.(com|com\.br|net|org)(\.[a-z]{2})?$/i,
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
 * Reads whatever text is currently visible in the open DM thread. Confirmed
 * live: opening the composer from a profile page overlays the thread on top
 * of that same page rather than navigating away — the modal isn't scoped
 * under <main>, so we scan the whole page and rely on NOISE_PATTERNS plus
 * the caller's diff-against-known-messages to reject the profile content
 * still mounted underneath.
 */
export async function readThreadMessages(page: Page, username: string): Promise<string[]> {
  await openDmComposer(page, username);
  await page.waitForTimeout(1000);

  const candidates = await page
    .locator('div[dir="auto"]')
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
