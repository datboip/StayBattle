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
  const page = await ctx.newPage();
  if (signedIn) {
    // Pre-seed voter so we skip the NameGate sign-in form.
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(({ id, name }) => {
      window.localStorage.setItem(
        "staybattle:auth:v2",
        JSON.stringify({ id, name }),
      );
      // Also force dark theme in case the toggle component reads
      // its own key independently of prefers-color-scheme.
      window.localStorage.setItem("staybattle:theme:v1", "dark");
    }, DEMO_VOTER);
  }
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

  // 5) Review-one-by-one mode
  {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /review one-by-one/i }).click();
    await page.waitForTimeout(900);
    await shoot(page, "review-mode");
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

  // 7) Trophy case (only meaningful when a past battle exists — gracefully
  //    skips if the panel isn't on the page)
  {
    const { ctx, page } = await makePage(browser, { viewport: "desktop" });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const trophy = page.locator("text=/Trophy case|past battles/i").first();
    if (await trophy.isVisible().catch(() => false)) {
      await trophy.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await shoot(page, "trophy-case");
    } else {
      console.log("  · trophy-case skipped (no past battles)");
    }
    await ctx.close();
  }

  await browser.close();
  console.log("─".repeat(60));
  console.log("Done. Commit docs/screenshots/ if happy.");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
