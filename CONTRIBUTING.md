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
