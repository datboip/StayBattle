# Contributing to StayBattle

Thanks for taking a swing at this — pull requests welcome.

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/staybattle.git
cd staybattle
npm install
npm run dev
```

Open <http://localhost:3000>.

## Dev scripts

```bash
npm run dev          # start the dev server
npm run typecheck    # tsc --noEmit
npm test             # run the test suite (vitest)
npm run test:watch   # vitest in watch mode
npm run build        # production build
npm start            # serve the production build
```

CI runs `typecheck`, `test`, and `build` on every push and PR
(`.github/workflows/ci.yml`). A separate workflow
(`.github/workflows/docker.yml`) builds and publishes the multi-arch
Docker image to GHCR on every push to `main` and on every tag —
README typo fixes and other doc-shaped commits skip the Docker
workflow via the workflow's `paths-ignore`, so you won't burn 20+ min
of Actions time on a one-line CHANGELOG edit.

## Updating screenshots

The README's screenshots all live in [`docs/screenshots/`](docs/screenshots/) and are committed to git. If your PR meaningfully changes the UI (new component, new card layout, retooled review mode, etc.), regenerate the affected ones so the README doesn't go stale.

```bash
# 1. Build a clean demo DB from the real DB's listings + fake social data
node scripts/screenshots/seed-demo.mjs

# 2. Spin up a second dev server pointed at the demo DB
STAYBATTLE_DB_DIR=./data-demo STAYBATTLE_DEMO_MODE=true npx next dev --port 3001

# 3. Capture screenshots (in another terminal)
BASE_URL=http://localhost:3001 \
  DEMO_VOTER_ID=$(sqlite3 data-demo/quickie.db "select id from voters where name='Alex'") \
  DEMO_VOTER_NAME=Alex \
  node scripts/screenshots/capture.mjs
```

The capture script also bakes phone-frame mockups (`iphone-review-mode.png`, `pixel-review-mode.png`) by wrapping the mobile shots in an SVG iPhone / Pixel frame + iOS-style status bar at the top. See the top of [`scripts/screenshots/capture.mjs`](scripts/screenshots/capture.mjs) for what each shot exercises.

## Project shape

- `src/app/page.tsx` — server component that fetches listings + places
- `src/app/actions.ts` — server actions for add/vote/comment/place
- `src/lib/db.ts` — SQLite schema + migrations
- `src/lib/scrape.ts` — Airbnb listing scraper (JSON-LD first, OG meta tags fallback)
- `src/lib/geocode.ts` — Nominatim wrapper with viewbox biasing
- `src/lib/rank.ts` — ranking algorithm (score + recency decay)
- `src/components/` — all UI components

## Before opening a PR

1. **Typecheck.** `npm run typecheck` (or `npx tsc --noEmit`) — must pass.
2. **Build.** `npm run build` — must succeed.
3. **Test.** `npm test` — keep failing tests green.
4. **One thing at a time.** Don't mix refactors with features in the same PR.
5. **No new env vars** without updating `.env.example` and the README.

## Filing issues

Use the templates in `.github/ISSUE_TEMPLATE/`. The maintainers respond best to:
- A short title that fits in one line.
- Repro steps if it's a bug. *"Add this URL, click that, observe…"*
- Screenshots for UI bugs (drag-and-drop into the issue body).

## Cutting a release

Versions live in `package.json`. The footer, Help modal, Demo modal, `<meta>` tag, and `/api/version` all read from `src/lib/version.ts`, which is **generated** by `scripts/build-version.mjs` at build time (and on `npm run dev` / `npm run typecheck` via the `pre*` hooks) — don't edit it by hand.

To cut a new release:

1. Update `CHANGELOG.md` — move items out of `[Unreleased]` into a new dated section: `## [X.Y.Z] — YYYY-MM-DD`.
2. Bump `version` in `package.json`.
3. Commit: `chore(release): vX.Y.Z`.
4. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
5. Push: `git push origin main vX.Y.Z`.

Pushing the tag triggers `.github/workflows/release.yml`, which creates a GitHub Release using the matching section of `CHANGELOG.md` as the body, and `.github/workflows/docker.yml`, which publishes the multi-arch image to GHCR tagged with both `vX.Y.Z` and `latest`.

Semver, loosely: `MAJOR` for breaking changes to the on-disk schema or CLI flags; `MINOR` for user-visible features; `PATCH` for bug fixes and tone/copy.

## Style notes

- Avoid `<div>` soup. Prefer semantic tags.
- Don't add third-party services. The whole point is local-first.
- New dependencies need justification in the PR description.
- React components are colocated; lib functions go in `src/lib/`.
- Server actions live in `src/app/actions.ts`. Don't proliferate action files.

## Code of conduct

Be cool. This is a side project for arguing about vacation rentals — keep it light, no harassment, no spam PRs.

## License

By contributing, you agree your work will be released under the AGPL-3.0-only license (see `LICENSE`).
