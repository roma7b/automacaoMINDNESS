import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";

/**
 * On any browser-job failure we need enough evidence to debug without
 * re-running against the real account: screenshot, accessibility snapshot,
 * URL, and whatever console/network errors the caller collected.
 */
export async function captureFailureDiagnostics(
  page: Page,
  jobId: number | string,
  error: unknown,
  extra: { consoleErrors?: string[]; networkFailures?: string[] } = {},
): Promise<string> {
  const dir = path.join(process.cwd(), "screenshots", `job-${jobId}-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  await page.screenshot({ path: path.join(dir, "screenshot.png"), fullPage: true }).catch(() => undefined);
  const accessibilitySnapshot = await page.ariaSnapshot().catch(() => null);

  await writeFile(
    path.join(dir, "diagnostics.json"),
    JSON.stringify(
      {
        jobId,
        url: page.url(),
        error: String(error),
        consoleErrors: extra.consoleErrors ?? [],
        networkFailures: extra.networkFailures ?? [],
        accessibilitySnapshot,
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  ).catch(() => undefined);

  return dir;
}
