import { type Browser, type BrowserContext, chromium } from "playwright";
import { getEnv } from "@/lib/env";

export class BrowserUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Não foi possível conectar ao Chrome via CDP: ${String(cause)}`);
    this.name = "BrowserUnavailableError";
  }
}

let mutexLocked = false;
const waitQueue: Array<() => void> = [];

async function acquireBrowserMutex(): Promise<() => void> {
  if (!mutexLocked) {
    mutexLocked = true;
    return () => releaseBrowserMutex();
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  mutexLocked = true;
  return () => releaseBrowserMutex();
}

function releaseBrowserMutex() {
  const next = waitQueue.shift();
  if (next) {
    next();
  } else {
    mutexLocked = false;
  }
}

/**
 * Never launches a new Chrome instance. If the operator's already-logged-in
 * Chrome isn't reachable over CDP, this fails loudly so the caller can mark
 * the job as browser_unavailable and pause the queue instead of silently
 * spawning a fresh, unauthenticated browser.
 */
const CDP_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_PAGE_TIMEOUT_MS = 20_000;

/**
 * Playwright's connectOverCDP has NO timeout by default (0 = wait forever) —
 * without an explicit one, a stuck handshake hangs the whole worker with no
 * error and no log line, indistinguishable from the process being alive.
 */
async function connectToOperatorChrome(): Promise<Browser> {
  const env = getEnv();
  try {
    return await chromium.connectOverCDP(env.CHROME_CDP_URL, {
      timeout: CDP_CONNECT_TIMEOUT_MS,
    });
  } catch (cause) {
    throw new BrowserUnavailableError(cause);
  }
}

function getLoggedInContext(browser: Browser): BrowserContext {
  const [context] = browser.contexts();
  if (!context) {
    throw new BrowserUnavailableError(
      "Nenhum contexto logado encontrado no Chrome do operador — faça login no Instagram no perfil dedicado primeiro.",
    );
  }
  return context;
}

/**
 * Runs `task` on a fresh tab in the operator's own logged-in Chrome context,
 * one browser job at a time (mutex), and always closes the tab — even on
 * error — so it never lingers or gets adopted as a user-visible tab.
 */
export async function withOperatorBrowserPage<T>(
  task: (page: import("playwright").Page) => Promise<T>,
): Promise<T> {
  const release = await acquireBrowserMutex();
  let browser: Browser | undefined;
  try {
    browser = await connectToOperatorChrome();
    const context = getLoggedInContext(browser);
    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(DEFAULT_PAGE_TIMEOUT_MS);
    try {
      return await task(page);
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    // We connect over CDP to the operator's own Chrome — closing it would
    // kill their browser session, so only disconnect this client.
    await browser?.close().catch(() => undefined);
    release();
  }
}

export function assertInstagramUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.hostname !== "www.instagram.com" && parsed.hostname !== "instagram.com") {
    throw new Error(`URL fora do domínio permitido (instagram.com): ${url}`);
  }
}
