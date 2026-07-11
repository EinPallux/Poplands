# Poplands 🏝️

A single-player, browser-first, 3D low-poly **cozy sky-island builder**. Grow a
floating island chunk by chunk, place buildings and props on a block grid, earn
Pops (●) and Stardust (✦), complete gentle quests, and watch little Islanders and
Pals live on your island — all with outstanding springy "pop" animations on every
interaction. Build all the way to **The Wonder**, the Level-20 capstone with its
own permanent aurora.

Built with **three.js + strict TypeScript + Vite**. No React, no game framework,
no backend, no telemetry — saves are versioned JSON in `localStorage` with
export/import.

## Develop

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

Append `?debug=1` to the URL for the debug HUD + `window.__poplands` handle.

## Quality gate

```bash
npm run check      # tsc --noEmit + eslint (strict; enforces the layering rules)
npm test           # Vitest — grid math, save/migrations, economy, quests, balance…
npm run build      # production build → dist/
```

## Assets

Runtime models are **GLB only**, produced by the manifest pipeline — never loaded
from the raw `/assets` packs (all CC0, see [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)):

```bash
npm run assets     # scripts/asset-manifest.json → public/assets/models/*.glb + manifest.json
```

Headless verification/soak scripts live in `scripts/` (`verify-v0x.mts`,
`balance-v07.mts`, `soak-v07.mts`, `og-image.mts`); run them with
`npx tsx scripts/<name>.mts` after `npm run build`.

## Deploy (Vercel)

The build is a static SPA (`base: './'`), so it hosts anywhere. For **Vercel**:

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
   Vercel auto-detects Vite and reads [`vercel.json`](vercel.json)
   (`npm run build` → `dist/`); no env vars needed.
3. Deploy. Every push to the branch redeploys a preview; production follows your
   configured branch.

Or via the CLI: `npm i -g vercel && vercel` (then `vercel --prod`).

An itch.io HTML5 build is the same `dist/` zipped — planned for the public
release later.

## Docs

Design/architecture live in the repo: [`GAME_DESIGN_DOCUMENT.md`](GAME_DESIGN_DOCUMENT.md),
[`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md),
[`SYSTEMS_BREAKDOWN.md`](SYSTEMS_BREAKDOWN.md),
[`ART_DIRECTION.md`](ART_DIRECTION.md), [`CONTENT_PLAN.md`](CONTENT_PLAN.md),
[`ROADMAP.md`](ROADMAP.md), and [`CHANGELOG.md`](CHANGELOG.md).
[`CLAUDE.md`](CLAUDE.md) is the working guide for contributors.
