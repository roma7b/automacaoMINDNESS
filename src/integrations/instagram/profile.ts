import type { Page } from "playwright";
import type { InstagramProfileSnapshot } from "@/features/leads/types";

// Assumes pt-BR number formatting (".": thousands, ",": decimal, "mil"/"mi"
// compact suffixes) since the operator's Chrome profile is set to pt-BR.
export function parseCount(raw: string): number {
  const normalized = raw.trim().toLowerCase().replace(/\s/g, "");
  const match = normalized.match(/^([\d.,]+)\s*(mil|mi|k|m)?/);
  if (!match) return 0;

  const numberPart = match[1].replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const value = Number.parseFloat(numberPart);
  if (Number.isNaN(value)) return 0;

  switch (match[2]) {
    case "mil":
    case "k":
      return Math.round(value * 1_000);
    case "mi":
    case "m":
      return Math.round(value * 1_000_000);
    default:
      return Math.round(value);
  }
}

/**
 * Instagram's ProfilePage `<meta name="description">` reliably packs
 * "<followers> Followers, <following> Following, <posts> Posts - ..." (or
 * the pt-BR equivalent) regardless of the DOM's ever-changing class names,
 * so we parse that instead of chasing CSS selectors.
 */
export function parseCountsFromMetaDescription(
  content: string,
): { followers: number; following: number; posts: number } | null {
  const match = content.match(
    /([\d.,]+\s*(?:mil|mi|k|m)?)\s*(?:Followers|seguidores),\s*([\d.,]+\s*(?:mil|mi|k|m)?)\s*(?:Following|seguindo),\s*([\d.,]+\s*(?:mil|mi|k|m)?)\s*(?:Posts|publicações)/i,
  );
  if (!match) return null;

  return {
    followers: parseCount(match[1]),
    following: parseCount(match[2]),
    posts: parseCount(match[3]),
  };
}

export class ProfileNotFoundError extends Error {
  constructor(username: string) {
    super(`Perfil não encontrado ou privado/indisponível: @${username}`);
    this.name = "ProfileNotFoundError";
  }
}

/**
 * Scrapes only what's publicly visible on the rendered profile page —
 * counts, bio, category, external link, and recent caption text pulled
 * from image alt attributes (accessibility metadata Instagram itself
 * generates, more stable than guessing class names).
 */
export async function fetchProfileSnapshot(
  page: Page,
  username: string,
): Promise<InstagramProfileSnapshot> {
  await page.goto(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
    waitUntil: "domcontentloaded",
  });

  const notFound = await page
    .getByText(/Sorry, this page isn't available|Esta página não está disponível/i)
    .first()
    .isVisible()
    .catch(() => false);
  if (notFound) throw new ProfileNotFoundError(username);

  await page.waitForSelector("header", { timeout: 15_000 }).catch(() => undefined);

  const metaDescription = await page
    .locator('meta[name="description"]')
    .first()
    .getAttribute("content")
    .catch(() => null);

  const counts = metaDescription ? parseCountsFromMetaDescription(metaDescription) : null;

  const fullName = await page
    .locator("header h1, header h2")
    .first()
    .innerText()
    .catch(() => "");

  // header's <section> children aren't in a fixed bio-is-last order — real
  // layout is [empty, name+counts, bio+link, follow/message buttons, ...].
  // The bio is the first non-empty section after the one with the counts,
  // stopping if we hit the follow/message button section instead.
  const bio = await page
    .locator("header section")
    .allInnerTexts()
    .then((sections) => {
      const countsIdx = sections.findIndex((t) => /seguidores|followers|seguindo|following/i.test(t));
      for (let i = countsIdx + 1; i < sections.length; i++) {
        const text = sections[i].trim();
        if (!text) continue;
        if (/^(Seguir|Follow|Editar perfil|Edit profile|Enviar mensagem|Message)\b/i.test(text)) break;
        return text;
      }
      return "";
    })
    .catch(() => "");

  const externalUrl = await page
    .locator('header a[href*="l.instagram.com"], header a[rel*="me"]')
    .first()
    .getAttribute("href")
    .catch(() => null);

  // The grid lazy-loads past the avatar/story-highlights row, so a small
  // scroll first is needed before real post images (and their alt-text
  // captions) exist in the DOM.
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(1000);

  const recentCaptions = await page
    .locator("main img[alt]")
    .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt") ?? ""))
    .then((alts) =>
      alts
        .filter((alt) => alt && !/foto do perfil|profile picture|story no destaque|story highlight/i.test(alt))
        .slice(0, 6),
    )
    .catch(() => [] as string[]);

  return {
    username,
    fullName: fullName.trim(),
    bio: bio.trim(),
    category: null,
    followers: counts?.followers ?? 0,
    following: counts?.following ?? 0,
    postsCount: counts?.posts ?? 0,
    externalUrl: externalUrl ?? null,
    recentCaptions,
  };
}
