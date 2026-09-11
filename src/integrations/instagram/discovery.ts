import type { Page } from "playwright";

const RESERVED_PATH_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "stories",
  "accounts",
  "direct",
]);

/**
 * Scrolls the hashtag grid and collects unique post/reel URLs. We don't
 * paginate via any private endpoint — just the same lazy-loading scroll a
 * human does, with a pause between scrolls so it isn't a tight machine loop.
 */
export async function collectPostUrlsFromHashtag(
  page: Page,
  hashtag: string,
  { maxPosts = 30, maxScrolls = 10 }: { maxPosts?: number; maxScrolls?: number } = {},
): Promise<string[]> {
  const cleanHashtag = hashtag.replace(/^#/, "");
  await page.goto(`https://www.instagram.com/explore/tags/${encodeURIComponent(cleanHashtag)}/`, {
    waitUntil: "domcontentloaded",
  });

  const urls = new Set<string>();

  for (let scroll = 0; scroll < maxScrolls && urls.size < maxPosts; scroll++) {
    const hrefs = await page
      .locator('main a[href^="/p/"], main a[href^="/reel/"]')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href") ?? ""));

    for (const href of hrefs) {
      if (href) urls.add(new URL(href, "https://www.instagram.com").toString());
    }

    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(800 + Math.random() * 700);
  }

  return [...urls].slice(0, maxPosts);
}

function isProfileUsername(pathSegment: string): boolean {
  return (
    pathSegment.length > 0 &&
    !RESERVED_PATH_SEGMENTS.has(pathSegment) &&
    /^[a-z0-9._]+$/i.test(pathSegment)
  );
}

/**
 * A post page's `og:title` reliably reads "<username> on Instagram: ..."
 * (or the pt-BR "<username> no Instagram: ..."), which survives markup
 * churn far better than any CSS selector into the post header.
 */
export async function extractAuthorUsernameFromPost(page: Page, postUrl: string): Promise<string | null> {
  await page.goto(postUrl, { waitUntil: "domcontentloaded" });

  const ogTitle = await page
    .locator('meta[property="og:title"]')
    .first()
    .getAttribute("content")
    .catch(() => null);

  const fromTitle = ogTitle?.match(/^([a-z0-9._]+)\s+(?:on|no)\s+Instagram/i)?.[1];
  if (fromTitle) return fromTitle;

  const headerHref = await page
    .locator("header a[href^='/']")
    .first()
    .getAttribute("href")
    .catch(() => null);

  if (headerHref) {
    const segment = headerHref.split("/").filter(Boolean)[0] ?? "";
    if (isProfileUsername(segment)) return segment;
  }

  return null;
}
