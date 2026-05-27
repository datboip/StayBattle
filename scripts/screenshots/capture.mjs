#!/usr/bin/env node
/**
 * Capture screenshots of the running app for the README.
 *
 * Assumes:
 *   - dev server up at http://localhost:3000
 *   - a battle exists with at least a handful of listings
 *   - a voter exists in the DB whose id is in DEMO_VOTER
 *
 * Run:
 *   node scripts/screenshots/capture.mjs
 *
 * Output: docs/screenshots/*.png — committed to git, used by README.md
 *
 * Future (Phase C): swap the DEMO_VOTER hardcode for a Faker.js-seeded
 * fixture DB so captures are deterministic + don't leak real voter
 * names. Also add ffmpeg→gifski for a hero demo GIF.
 */
import { chromium } from "playwright";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "docs", "screenshots");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// Real voter in the DB. Pre-injected into localStorage so we skip
// NameGate. Replace via env vars when running against a different DB.
const DEMO_VOTER = {
  id: process.env.DEMO_VOTER_ID ?? "00000000-0000-0000-0000-000000000000",
  name: process.env.DEMO_VOTER_NAME ?? "Alex",
};

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

async function makePage(browser, { viewport = "desktop", signedIn = true } = {}) {
  const ctx = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    colorScheme: "dark",
  });
  // Server-side gate (post 2026-05-27 privacy audit) reads the voter
  // identity from a cookie, not localStorage — so the cookie has to be
  // primed BEFORE the first navigation or SSR will treat the visitor
  // as anonymous and skip rendering listings/participants/etc.
  if (signedIn) {
    const url = new URL(BASE_URL);
    await ctx.addCookies([
      {
        name: "staybattle_voter",
        value: JSON.stringify({ id: DEMO_VOTER.id, name: DEMO_VOTER.name }),
        domain: url.hostname,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }
  const page = await ctx.newPage();
  // Hide the Next.js dev-mode badge ("N" floating in the corner of
  // every dev-mode page) from every screenshot. The dev indicator
  // renders inside a custom <nextjs-portal> element parked as a
  // top-level child of <body>; hiding it from the outside CSS works
  // because the element itself is in the light DOM. No-op on
  // `next start` production builds, where the element never mounts.
  await page.addStyleTag({
    content: `nextjs-portal { display: none !important; }`,
  });
  // Pre-set localStorage flags BEFORE any page UI renders. This
  // includes dismissing the demo-mode modal so it doesn't blanket
  // every screenshot.
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({
    content: `nextjs-portal { display: none !important; }`,
  });
  await page.evaluate(({ id, name, signedIn }) => {
    // Dismiss the demo-mode disclaimer modal in every captured shot
    window.localStorage.setItem("staybattle:demo-modal-dismissed:v1", "1");
    window.localStorage.setItem("staybattle:theme:v1", "dark");
    if (signedIn) {
      window.localStorage.setItem(
        "staybattle:auth:v2",
        JSON.stringify({ id, name }),
      );
    }
  }, { ...DEMO_VOTER, signedIn });
  return { ctx, page };
}

async function shoot(page, name, { fullPage = false } = {}) {
  const out = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: out, fullPage });
  const { size } = await stat(out);
  console.log(`  ✓ ${name.padEnd(28)} ${Math.round(size / 1024)} KB`);
  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Capturing to ${OUT_DIR}`);
  console.log(`Base: ${BASE_URL}`);
  console.log("─".repeat(60));

  const browser = await chromium.launch({ headless: true });

  // 1) Sign-in screen (signed-out, both viewports)
  for (const vp of ["desktop", "mobile"]) {
    const { ctx, page } = await makePage(browser, { viewport: vp, signedIn: false });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await shoot(page, vp === "mobile" ? "sign-in-mobile" : "sign-in", { fullPage: true });
    await ctx.close();
  }

  // 2) Main app view — header + invite panel (viewport-only, tight)
  {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await shoot(page, "battle-header");
    await ctx.close();
  }

  // 3) Voting grid — desktop viewport-only (no full page → keeps file size sane)
  {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // Scroll to roster so the screenshot lands on listings, not the header
    await page.evaluate(() =>
      document.querySelector(".sb-roster")?.scrollIntoView({ block: "start" }),
    );
    await page.waitForTimeout(600);
    await shoot(page, "voting-grid");
    await ctx.close();
  }

  // 4) Voting grid — mobile viewport-only
  {
    const { ctx, page } = await makePage(browser, { viewport: "mobile" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.evaluate(() =>
      document.querySelector(".sb-roster")?.scrollIntoView({ block: "start" }),
    );
    await page.waitForTimeout(600);
    await shoot(page, "voting-grid-mobile");
    await ctx.close();
  }

  // 5) Review-one-by-one mode — scroll to listings, find button by text, click via DOM
  {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    // Scroll the listings into view first
    await page.evaluate(() => {
      document.querySelector(".sb-roster")?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(800);
    // Find and click the button via DOM (locator was hitting weird timeouts)
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => /review one-by-one/i.test(b.textContent || ""));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) {
      // Wait for the review-mode overlay to render
      await page.waitForTimeout(1500);
      await shoot(page, "review-mode");
    } else {
      console.log("  · review-mode skipped (button not found in DOM)");
    }
    await ctx.close();
  }

  // 6) Map section — scroll past the grid
  {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // The map renders in a section below the listings — scroll to it
    await page.evaluate(() => {
      const m = document.querySelector(".leaflet-container");
      if (m) m.scrollIntoView({ block: "center" });
      else window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1200);
    await shoot(page, "map");
    await ctx.close();
  }

  // 5b) Capture 3 review-mode frames showing different listings, for the
  // marketing site's CSS-loop swipe animation.
  for (const i of [1, 2, 3]) {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      document.querySelector(".sb-roster")?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(600);
    const opened = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find((b) => /review one-by-one/i.test(b.textContent || ""));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (opened) {
      await page.waitForTimeout(1000);
      // Advance to listing i-1 by pressing ArrowRight (i-1) times.
      // Frame 1 = first listing, no advance; Frame 2 = +1; Frame 3 = +2
      for (let j = 0; j < i - 1; j++) {
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(700);
      }
      await shoot(page, `review-mode-${i}`);
    } else {
      console.log(`  · review-mode-${i} skipped (button not found)`);
    }
    await ctx.close();
  }

  // 7) Trophy case — full-page clip at the trophy region with laptop-screen
  // proportions (1440x900 wide → fits laptop frame like the others)
  {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const trophyY = await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll("h2"))
        .find((el) => /trophy case|past battles/i.test(el.textContent || ""));
      const section = h?.closest("section");
      if (!section) return null;
      const rect = section.getBoundingClientRect();
      return Math.max(0, rect.top + window.scrollY - 80); // padding above
    });
    if (trophyY != null) {
      const out = join(OUT_DIR, "trophy-case.png");
      // fullPage: true makes `clip` page-relative instead of viewport-relative
      await page.screenshot({
        path: out,
        fullPage: true,
        clip: { x: 0, y: trophyY, width: 1440, height: 900 },
      });
      const { size } = await stat(out);
      console.log(`  ✓ ${"trophy-case".padEnd(28)} ${Math.round(size / 1024)} KB`);
    } else {
      console.log("  · trophy-case skipped (no past battles)");
    }
    await ctx.close();
  }

  // 8) Tinder-style review mode on MOBILE (the swipe vote, big-card form)
  {
    const { ctx, page } = await makePage(browser, { viewport: "mobile" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      document.querySelector(".sb-roster")?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(800);
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => /review one-by-one/i.test(b.textContent || ""));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) {
      await page.waitForTimeout(1500);
      await shoot(page, "review-mode-mobile");
    } else {
      console.log("  · review-mode-mobile skipped (button not found)");
    }
    await ctx.close();
  }

  // 9) Comments thread expanded on one listing — element-only (the card)
  {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      document.querySelector(".sb-roster")?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(600);
    const opened = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find((b) => /trash talk\s*·\s*[1-9]\d*/i.test(b.textContent || ""));
      if (!btn) return false;
      btn.scrollIntoView({ block: "center" });
      btn.click();
      return true;
    });
    if (opened) {
      await page.waitForTimeout(900);
      const handle = await page.evaluateHandle(() => {
        const panel = document.querySelector('[id^="talk-"]');
        if (!panel) return null;
        return panel.closest("article.sb-fighter-card") ?? panel.closest("article");
      });
      const exists = await page.evaluate((el) => !!el, handle).catch(() => false);
      if (exists) {
        await handle.asElement()?.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const out = join(OUT_DIR, "comments-expanded.png");
        await handle.asElement()?.screenshot({ path: out });
        const { size } = await stat(out);
        console.log(`  ✓ ${"comments-expanded".padEnd(28)} ${Math.round(size / 1024)} KB`);
      }
    } else {
      console.log("  · comments-expanded skipped (no card with comments)");
    }
    await ctx.close();
  }

  // Note: no add-listing capture. AddListingForm only renders during
  // the submission phase; the seeded demo battle is in voting phase so
  // the form is gone by the time the screenshots run. If we ever want a
  // hero shot of paste-a-URL, seed a second submission-phase demo battle
  // and capture it from there — for now the form is small enough that
  // the README doesn't need a dedicated frame.

  await browser.close();
  console.log("─".repeat(60));
  console.log("Done. Commit docs/screenshots/ if happy.");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
