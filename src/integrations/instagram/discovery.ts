import type { Page } from "playwright";
import { getBusinessConfig } from "@/lib/business-config";

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
  // Instagram redirects /explore/tags/<tag>/ to this search-results URL now;
  // going straight there skips one hop and matches what actually renders.
  await page.goto(
    `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`#${cleanHashtag}`)}`,
    { waitUntil: "domcontentloaded" },
  );

  const urls = new Set<string>();

  for (let scroll = 0; scroll < maxScrolls && urls.size < maxPosts; scroll++) {
    const hrefs = await page
      .locator('a[href^="/p/"], a[href^="/reel/"]')
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
 * `og:title` on a post page turned out to hold the author's display name
 * ("Giovana Mendonça no Instagram: ..."), not their @handle — no regex
 * recovers a username from an arbitrary display name. Post permalink pages
 * also have no `<header>` (that only exists on profile pages). What does
 * work: the author's profile link is reliably the first profile-shaped
 * href after the left-nav chrome (home/reels/direct/explore/own-account),
 * so we scan early links in DOM order and skip our own operator handle.
 */
export async function extractAuthorUsernameFromPost(page: Page, postUrl: string): Promise<string | null> {
  await page.goto(postUrl, { waitUntil: "domcontentloaded" });

  const ownHandle = getBusinessConfig().company.instagramHandle.replace(/^@/, "").toLowerCase();

  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((anchors) => anchors.slice(0, 40).map((a) => a.getAttribute("href") ?? ""));

  for (const href of hrefs) {
    const segment = href.split("/").filter(Boolean)[0] ?? "";
    if (!isProfileUsername(segment)) continue;
    if (segment.toLowerCase() === ownHandle) continue;
    return segment;
  }

  return null;
}
