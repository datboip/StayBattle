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
import { mkdir, stat, readFile } from "node:fs/promises";
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
  // Hide the Next.js dev-mode badge ("N" floating in the corner) from
  // every screenshot. addInitScript runs on every new document in the
  // context — including after each capture-block's `page.goto(...)` —
  // which is what makes this survive the navigations that earlier
  // page.addStyleTag attempts lost. The handler injects a <style> tag
  // on DOMContentLoaded so the rule is in place before paint, and uses
  // a data attribute to avoid double-inserting on HMR navigations.
  await ctx.addInitScript(() => {
    const inject = () => {
      if (!document.head) return;
      if (document.head.querySelector('style[data-cap-hide-nextjs]')) return;
      const s = document.createElement('style');
      s.setAttribute('data-cap-hide-nextjs', '');
      s.textContent = 'nextjs-portal{display:none!important}';
      document.head.appendChild(s);
    };
    inject();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    }
  });
  // Mobile shots get a fake iOS status bar (9:41 + signal/wifi/battery
  // icons) + a Dynamic Island silhouette painted in. Makes the captured
  // PNG read as a real iPhone screenshot rather than a flat web page.
  // Built via DOM ops only — no innerHTML — to satisfy the security
  // hook that blocks string-template HTML injection.
  if (viewport === "mobile") {
    await ctx.addInitScript(() => {
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const inject = () => {
        if (!document.body) return;
        if (document.body.querySelector('[data-cap-status-bar]')) return;

        // === Status bar container ===
        const bar = document.createElement('div');
        bar.setAttribute('data-cap-status-bar', '');
        bar.style.cssText =
          'position:fixed;top:0;left:0;right:0;height:47px;z-index:2147483647;' +
          'display:flex;align-items:center;justify-content:space-between;' +
          'padding:0 28px 0 32px;font:600 17px -apple-system,SF Pro Text,system-ui,sans-serif;' +
          'color:#fff;pointer-events:none;background:transparent;' +
          'letter-spacing:-0.02em;';

        // 9:41 time text on the left
        const time = document.createElement('span');
        time.textContent = '9:41';
        bar.appendChild(time);

        // Right cluster: signal + wifi + battery icons
        const right = document.createElement('span');
        right.style.cssText = 'display:inline-flex;gap:6px;align-items:center';

        // Signal bars — SVG built via createElementNS
        const sig = document.createElementNS(SVG_NS, 'svg');
        sig.setAttribute('width', '18');
        sig.setAttribute('height', '11');
        sig.setAttribute('viewBox', '0 0 18 11');
        sig.setAttribute('fill', '#fff');
        [[0, 7, 4], [5, 4, 7], [10, 1, 10]].forEach(([x, y, h]) => {
          const r = document.createElementNS(SVG_NS, 'rect');
          r.setAttribute('x', String(x));
          r.setAttribute('y', String(y));
          r.setAttribute('width', '3');
          r.setAttribute('height', String(h));
          r.setAttribute('rx', '0.5');
          sig.appendChild(r);
        });
        const bar4 = document.createElementNS(SVG_NS, 'rect');
        bar4.setAttribute('x', '15');
        bar4.setAttribute('y', '0');
        bar4.setAttribute('width', '3');
        bar4.setAttribute('height', '11');
        bar4.setAttribute('rx', '0.5');
        bar4.setAttribute('opacity', '0.4');
        sig.appendChild(bar4);
        right.appendChild(sig);

        // Wifi — three concentric arcs + dot
        const wifi = document.createElementNS(SVG_NS, 'svg');
        wifi.setAttribute('width', '16');
        wifi.setAttribute('height', '11');
        wifi.setAttribute('viewBox', '0 0 16 11');
        wifi.setAttribute('fill', 'none');
        wifi.setAttribute('stroke', '#fff');
        wifi.setAttribute('stroke-width', '1.5');
        wifi.setAttribute('stroke-linecap', 'round');
        ['M1 4 Q8 -2 15 4', 'M3.5 6 Q8 2 12.5 6'].forEach((d) => {
          const p = document.createElementNS(SVG_NS, 'path');
          p.setAttribute('d', d);
          wifi.appendChild(p);
        });
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', '8');
        dot.setAttribute('cy', '9');
        dot.setAttribute('r', '1');
        dot.setAttribute('fill', '#fff');
        dot.setAttribute('stroke', 'none');
        wifi.appendChild(dot);
        right.appendChild(wifi);

        // Battery — outlined rect with fill + small nipple
        const batWrap = document.createElement('span');
        batWrap.style.cssText = 'display:inline-flex;align-items:center;gap:1px';
        const batOuter = document.createElement('span');
        batOuter.style.cssText =
          'width:24px;height:11px;border:1px solid rgba(255,255,255,0.55);' +
          'border-radius:3px;padding:1px;display:inline-flex;align-items:center;' +
          'justify-content:flex-start';
        const batFill = document.createElement('span');
        batFill.style.cssText = 'width:80%;height:100%;background:#fff;border-radius:1.5px';
        batOuter.appendChild(batFill);
        const batNip = document.createElement('span');
        batNip.style.cssText =
          'width:1.5px;height:4px;background:rgba(255,255,255,0.55);' +
          'border-radius:0 1px 1px 0;display:inline-block';
        batWrap.appendChild(batOuter);
        batWrap.appendChild(batNip);
        right.appendChild(batWrap);

        bar.appendChild(right);
        document.body.appendChild(bar);

        // Dynamic Island silhouette — a black pill sitting on top of
        // the status bar.
        const island = document.createElement('div');
        island.style.cssText =
          'position:fixed;top:11px;left:50%;transform:translateX(-50%);' +
          'width:126px;height:37px;background:#000;border-radius:20px;' +
          'z-index:2147483646;pointer-events:none;';
        document.body.appendChild(island);

        // Push the rest of the page down so the app's own header
        // doesn't sit under the status bar.
        document.documentElement.style.paddingTop = '47px';
      };
      inject();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
      }
    });
  }
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
  // Pre-set localStorage flags BEFORE any page UI renders. This
  // includes dismissing the demo-mode modal so it doesn't blanket
  // every screenshot.
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
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

  // 10) Bake the mobile screenshots into phone-shaped PNGs. Wraps each
  //     raw mobile capture in a Magic UI device frame (MIT) via a
  //     headless HTML render, then screenshots THAT — output is a
  //     single PNG with bezel + Dynamic Island + screen baked in, no
  //     runtime CSS frame logic needed on the marketing site.
  await bakePhoneMockup(browser, {
    inputName: "review-mode-mobile",
    outputName: "iphone-review-mode",
    frame: "iphone",
  });
  await bakePhoneMockup(browser, {
    inputName: "voting-grid-mobile",
    outputName: "pixel-voting-grid",
    frame: "pixel",
  });

  await browser.close();
  console.log("─".repeat(60));
  console.log("Done. Commit docs/screenshots/ if happy.");
}

// ─── Phone mockup baker ──────────────────────────────────────────
// Takes one of our raw mobile screenshots and renders it inside a phone
// frame (Magic UI iPhone or Pixel, MIT). Saves the result as a single
// transparent-background PNG.
const PHONE_FRAMES = {
  iphone: {
    viewBoxW: 433,
    viewBoxH: 882,
    screen: { left: 4.91, top: 2.18, width: 89.95, height: 95.63, radius: "14.31% / 6.61%" },
    svg: `
      <g mask="url(#sb-iphone-mask)">
        <path d="M2 73C2 32.6832 34.6832 0 75 0H357C397.317 0 430 32.6832 430 73V809C430 849.317 397.317 882 357 882H75C34.6832 882 2 849.317 2 809V73Z" fill="#404040"/>
        <path d="M0 171C0 170.448 0.447715 170 1 170H3V204H1C0.447715 204 0 203.552 0 203V171Z" fill="#404040"/>
        <path d="M1 234C1 233.448 1.44772 233 2 233H3.5V300H2C1.44772 300 1 299.552 1 299V234Z" fill="#404040"/>
        <path d="M1 319C1 318.448 1.44772 318 2 318H3.5V385H2C1.44772 385 1 384.552 1 384V319Z" fill="#404040"/>
        <path d="M430 279H432C432.552 279 433 279.448 433 280V384C433 384.552 432.552 385 432 385H430V279Z" fill="#404040"/>
        <path d="M6 74C6 35.3401 37.3401 4 76 4H356C394.66 4 426 35.3401 426 74V808C426 846.66 394.66 878 356 878H76C37.3401 878 6 846.66 6 808V74Z" fill="#1c1c1f"/>
      </g>
      <defs>
        <mask id="sb-iphone-mask" maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="433" height="882" fill="white"/>
          <rect x="21.25" y="19.25" width="389.5" height="843.5" rx="55.75" ry="55.75" fill="black"/>
        </mask>
      </defs>
    `,
  },
  pixel: {
    viewBoxW: 433,
    viewBoxH: 882,
    screen: { left: 2.08, top: 1.59, width: 83.14, height: 90.70, radius: "9.17% / 3.13%" },
    svg: `
      <path d="M376 153H378C379.105 153 380 153.895 380 155V249C380 250.105 379.105 251 378 251H376V153Z" fill="#404040"/>
      <path d="M376 301H378C379.105 301 380 301.895 380 303V351C380 352.105 379.105 353 378 353H376V301Z" fill="#404040"/>
      <g mask="url(#sb-pixel-mask)">
        <path d="M0 42C0 18.8041 18.804 0 42 0H336C359.196 0 378 18.804 378 42V788C378 811.196 359.196 830 336 830H42C18.804 830 0 811.196 0 788V42Z" fill="#404040"/>
        <path d="M2 43C2 22.0132 19.0132 5 40 5H338C358.987 5 376 22.0132 376 43V787C376 807.987 358.987 825 338 825H40C19.0132 825 2 807.987 2 787V43Z" fill="#1c1c1f"/>
      </g>
      <circle cx="189" cy="28" r="9" fill="#1c1c1f"/>
      <circle cx="189" cy="28" r="4" fill="#404040"/>
      <defs>
        <mask id="sb-pixel-mask" maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="433" height="882" fill="white"/>
          <rect x="9" y="14" width="360" height="800" rx="33" ry="25" fill="black"/>
        </mask>
      </defs>
    `,
  },
};

async function bakePhoneMockup(browser, { inputName, outputName, frame }) {
  const inputPath = join(OUT_DIR, `${inputName}.png`);
  const outputPath = join(OUT_DIR, `${outputName}.png`);
  const def = PHONE_FRAMES[frame];

  // Read input PNG into a base64 data URI so the bake page doesn't need
  // to fetch over the network.
  const imgBuf = await readFile(inputPath);
  const imgSrc = `data:image/png;base64,${imgBuf.toString("base64")}`;
  const s = def.screen;

  // The HTML template that paints the phone. The screen <img> sits
  // behind the SVG frame; the SVG's mask cuts a hole where the screen
  // should be, so the screenshot shows through that hole cleanly.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;}
#phone{
  position:relative;
  width:${def.viewBoxW}px;
  height:${def.viewBoxH}px;
  margin:0;
}
#phone .screen{
  position:absolute;
  left:${s.left}%;
  top:${s.top}%;
  width:${s.width}%;
  height:${s.height}%;
  overflow:hidden;
  border-radius:${s.radius};
  background:#0a0a0c;
}
#phone .screen img{
  display:block;width:100%;height:100%;
  object-fit:cover;object-position:top center;
}
#phone svg.frame{
  position:absolute;inset:0;width:100%;height:100%;
  pointer-events:none;
}
</style></head><body>
<div id="phone">
  <div class="screen"><img src="${imgSrc}"></div>
  <svg class="frame" viewBox="0 0 ${def.viewBoxW} ${def.viewBoxH}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${def.svg}
  </svg>
</div>
</body></html>`;

  const ctx = await browser.newContext({
    viewport: { width: def.viewBoxW, height: def.viewBoxH },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(150);
  await page.locator("#phone").screenshot({ path: outputPath, omitBackground: true });
  await ctx.close();
  const { size } = await stat(outputPath);
  console.log(`  ✓ ${outputName.padEnd(28)} ${Math.round(size / 1024)} KB`);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
