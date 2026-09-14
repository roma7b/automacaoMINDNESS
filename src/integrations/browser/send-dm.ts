import type { Page } from "playwright";
import { assertInstagramUrl } from "./cdp";

const CHAR_DELAY_MIN_MS = 40;
const CHAR_DELAY_MAX_MS = 140;
const PRE_SEND_PAUSE_MIN_MS = 1200;
const PRE_SEND_PAUSE_MAX_MS = 3000;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export class MessageComposerNotFoundError extends Error {
  constructor(username: string) {
    super(
      `Não achei a caixa de mensagem pro perfil @${username} — o botão "Enviar mensagem" pode ter mudado de lugar.`,
    );
    this.name = "MessageComposerNotFoundError";
  }
}

/**
 * Also used by the inbox-reading side (features/leads/reply-pipeline) since
 * clicking "message" on someone already in a thread opens that same thread
 * rather than starting a new one.
 */
export async function openDmComposer(page: Page, username: string): Promise<void> {
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  assertInstagramUrl(profileUrl);
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });

  // isVisible() is a non-waiting snapshot check — right after goto, the
  // header often hasn't hydrated yet, so it reports false before the
  // button ever gets a chance to render. waitFor actually waits.
  const messageButton = page.getByRole("button", { name: /enviar mensagem|message/i }).first();
  await messageButton.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {
    throw new MessageComposerNotFoundError(username);
  });

  await messageButton.click();
  await page.waitForTimeout(1500);
}

async function typeMessageHumanlike(page: Page, text: string): Promise<void> {
  const composer = page.locator('textarea, div[contenteditable="true"][role="textbox"]').last();
  await composer.click({ timeout: 10_000 });

  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(randomBetween(CHAR_DELAY_MIN_MS, CHAR_DELAY_MAX_MS));
  }

  await page.waitForTimeout(randomBetween(PRE_SEND_PAUSE_MIN_MS, PRE_SEND_PAUSE_MAX_MS));
}

export interface SendDmResult {
  sent: boolean;
  dryRun: boolean;
}

/**
 * Opens the DM composer and types the message with human-like per-character
 * pacing. dryRun (default true everywhere this is called) stops right
 * before the send action — the message sits typed in the composer but
 * nothing is transmitted. Only an explicit dryRun: false actually sends.
 */
export async function sendDirectMessage(
  page: Page,
  username: string,
  message: string,
  { dryRun = true }: { dryRun?: boolean } = {},
): Promise<SendDmResult> {
  await openDmComposer(page, username);
  await typeMessageHumanlike(page, message);

  if (dryRun) {
    return { sent: false, dryRun: true };
  }

  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);

  return { sent: true, dryRun: false };
}
