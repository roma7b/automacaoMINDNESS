import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchProfileSnapshot, parseCount, parseCountsFromMetaDescription } from "./profile";

describe("parseCount", () => {
  it("parses plain numbers with pt-BR thousands separator", () => {
    expect(parseCount("812")).toBe(812);
    expect(parseCount("1.234")).toBe(1234);
  });

  it("parses compact mil/mi suffixes", () => {
    expect(parseCount("1,2 mil")).toBe(1200);
    expect(parseCount("45,6 mil")).toBe(45600);
    expect(parseCount("2,3 mi")).toBe(2_300_000);
  });

  it("returns 0 for unparseable input", () => {
    expect(parseCount("")).toBe(0);
    expect(parseCount("—")).toBe(0);
  });
});

describe("parseCountsFromMetaDescription", () => {
  it("parses the pt-BR meta description format", () => {
    const content =
      "812 seguidores, 340 seguindo, 96 publicações - Veja fotos e vídeos do Instagram de Oficina do João (@oficina_do_joao_es)";
    expect(parseCountsFromMetaDescription(content)).toEqual({
      followers: 812,
      following: 340,
      posts: 96,
    });
  });

  it("parses the en-US meta description format", () => {
    const content =
      "812 Followers, 340 Following, 96 Posts - See Instagram photos and videos from Oficina do João (@oficina_do_joao_es)";
    expect(parseCountsFromMetaDescription(content)).toEqual({
      followers: 812,
      following: 340,
      posts: 96,
    });
  });

  it("returns null when the format doesn't match", () => {
    expect(parseCountsFromMetaDescription("Esta página não está disponível")).toBeNull();
  });
});

describe("fetchProfileSnapshot (fixture page, no live Instagram)", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("extracts counts, bio and captions from a rendered profile-shaped page", async () => {
    const page = await browser.newPage();
    await page.route("**/*", async (route) => {
      if (route.request().url().includes("instagram.com/oficina_do_joao_es")) {
        await route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: FIXTURE_PROFILE_HTML,
        });
      } else {
        await route.fulfill({ status: 404, body: "" });
      }
    });

    const snapshot = await fetchProfileSnapshot(page, "oficina_do_joao_es");

    expect(snapshot.followers).toBe(812);
    expect(snapshot.following).toBe(340);
    expect(snapshot.postsCount).toBe(96);
    expect(snapshot.bio).toContain("caderninho");
    expect(snapshot.recentCaptions).toContain("Foto de orçamento anotado à mão");

    await page.close();
  });

  it("throws ProfileNotFoundError for a private/unavailable profile", async () => {
    const page = await browser.newPage();
    await page.route("**/*", async (route) => {
      if (route.request().url().includes("instagram.com/nao_existe")) {
        await route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: `<html><body><span>Sorry, this page isn't available.</span></body></html>`,
        });
      } else {
        await route.fulfill({ status: 404, body: "" });
      }
    });

    await expect(fetchProfileSnapshot(page, "nao_existe")).rejects.toThrow(
      /não encontrado ou privado/,
    );

    await page.close();
  });
});

const FIXTURE_PROFILE_HTML = `<!doctype html>
<html>
<head>
  <meta name="description" content="812 seguidores, 340 seguindo, 96 publicações - Veja fotos e vídeos do Instagram de Oficina do João (@oficina_do_joao_es)">
</head>
<body>
  <header>
    <h1>Oficina do João</h1>
    <a href="https://l.instagram.com/?u=https://wa.me/5527999999999" rel="me nofollow noopener">wa.me</a>
    <section>Oficina mecânica em Vila Velha. Ainda fazemos tudo no caderninho.</section>
  </header>
  <main>
    <article>
      <img alt="Foto de orçamento anotado à mão" />
      <img alt="Profile picture of oficina_do_joao_es" />
    </article>
  </main>
</body>
</html>`;
