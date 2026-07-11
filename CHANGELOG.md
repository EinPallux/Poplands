# Changelog

All notable changes to **Poplands** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: milestone-based `0.x` (see [ROADMAP.md](ROADMAP.md)), aiming for semantic versioning from 1.0.

## [Unreleased]

### Added — v0.2 "Builder's Joy" (pending user milestone review)
- **Placement system (S8/S9):** two-layer cell occupancy (ground overlays under props), footprint validation incl. cross-chunk & rotation, place / move (pick-up-and-carry with Esc-return) / remove tools, ghost preview with mint/coral validity, R-rotation, occupied/off-island rejection feedback. 6 new island tests.
- **Prop renderer (S10):** InstancedMesh pools per item (merged sub-meshes, swap-remove, grow-by-doubling) + unique-clone tier, promote-animate-demote for juiced placement of instanced items, bulk rebuild on load. Verified: 238 props at ~65 draw calls.
- **Juice v1 (S11/S12/S22):** pop-in (backOut overshoot), pop-out (squash & shrink), ghost shake on rejection, carried-item bob; pooled puff particles (dust ring on place, poof on remove); synthesized WebAudio SFX — pitch-laddering plop, thock, poof. Reduced-motion handled inside presets.
- **Save/load v1 (S3):** versioned localStorage schema with migrations registry, debounced autosave + pagehide flush, rolling 2-slot backups with corrupt-slot recovery, unknown-content attic quarantine, export to file / import with validation. 6 new save tests.
- **Catalog & content:** 25 Tier-1/2 items as data (`content/catalog.ts`) mapped to manifest models; starter island converted to real, editable placements seeded on fresh saves; the old windmill remains a cell-blocking landmark.
- **Build UI (S21/S23):** bottom build bar (category tabs, item cards with post-boot 3D-rendered thumbnails, footprint/cost chips), Move/Remove tool buttons, contextual hint pill, B-collapse; settings panel (quality, volume, reduced motion, export/import); toasts. Keyboard: R rotate · Esc cancel · B catalog · M/X tools.
- **Verification harness:** `scripts/verify-build.mts` drives the built game headlessly — place via UI click, rejection, reload persistence, remove, 190-item stress with draw-call budget assertion. All checks green.

### Changed — island base rework (user review feedback, 2026-07-11)
- Replaced the crag-skirt underside with a **layered slab base** matching the user's reference: overhanging grass lip, sand band, terracotta rock band tapering to a rounded bottom; organic wobbly silhouette from a traced block outline (new `core/outline.ts` with 7 tests + `world/SlabBuilder.ts`), deterministic and growth-ready for chunk expansion.
- Saturation pass: vivid lime lawn + saturated strata colors (`slabColors` in the palette; ART §3.1/§5 updated). Distant islets rebuilt as miniature slabs.

### Added — v0.1 "First Light" implementation (user-approved 2026-07-11)
- Project scaffold: Vite + strict TypeScript + ESLint (with three.js-free layering rule for `core`/`content`/`sim`) + Prettier + Vitest + GitHub Actions CI.
- Core modules with 26 unit tests: grid/chunk math, tween engine + springs (`backOut` pop easing), typed event bus, signals, i18n string table, seeded RNG.
- Asset pipeline v1: manifest-driven optimize (gltf-transform dedup/prune/weld) + per-model AABB/clip metadata lint; 31 curated models → `public/assets` (0.47 MB). Dev tools: `inspect-model`, headless `screenshot` capture.
- Rendering: ACES/sRGB renderer, warm sun + hemisphere recipe, quality tiers with fps auto-probe, gradient sky dome, **cloud-sea shader** (driver-safe hash — the classic `sin`-hash breaks on ANGLE), drifting puffball clouds, distant parallax islets, fog.
- World: face-culled vertex-colored chunk ground (grass jitter, dirt sides), warm-tinted crag skirt with central keel, pre-decorated 2×2-chunk starter island, composed **spinning windmill** (Fantasy Town kit walls + rotor).
- Camera & input: damped orbit/pan/zoom rig with clamps, Q/E azimuth snaps, R reset, intro swoop, grab-the-world pan, analytic ground picking with mint hover highlight.
- App shell: game loop (dt clamp, visibility pause), loading screen with honest progress, debug HUD (`?debug=1` or backquote).

### Added
- Complete planning documentation set (planning phase — no code yet):
  - `GAME_DESIGN_DOCUMENT.md` — vision, pillars, core loop, grid/chunk design, economy & progression rules, quests, Islanders/Pals, secrets, camera/UX, v1.0 scope.
  - `ROADMAP.md` — milestones v0.1 "First Light" → v1.0 "Grand Opening" with per-milestone exit criteria and post-1.0 backlog.
  - `TECHNICAL_ARCHITECTURE.md` — stack (three.js + strict TS + Vite, zero backend), repo layout & layering rules, sim/presentation seam, save schema & migrations, rendering tiers & budgets, asset pipeline, testing/CI/deploy strategy.
  - `SYSTEMS_BREAKDOWN.md` — specifications for systems S1–S24 (events, interfaces, DoD) and the three critical cross-system flows.
  - `ART_DIRECTION.md` — visual pillars, color script, lighting recipe, world dressing, the "Everything Pops" animation language with tuning table, UI art direction, custom-asset deliverables.
  - `CONTENT_PLAN.md` — asset-pack audit (~2,100 GLBs across 17 packs), full catalog tiers 1–20 mapped to real asset files, quest/postcard plans, Islander & Pal rosters, economy tuning tables, audio shopping list.
  - `CLAUDE.md` — repository working guide: locked decisions, conventions, definition of done.
  - `CHANGELOG.md` — this file.

### Decided
- User-confirmed (2026-07-11): perspective camera · English-first with i18n-ready string table · desktop-first (touch post-1.0) · pause-for-review after each milestone. Implementation of **v0.1 "First Light"** green-lit.

### Notes
- ⚠️ Open action item: asset **license audit** (`ATTRIBUTIONS.md`) before any public release — see CONTENT_PLAN §1.1.

## Planned milestones
`0.1` First Light · `0.2` Builder's Joy · `0.3` Pops & Purpose · `0.4` New Horizons · `0.5` Little Neighbors · `0.6` Living Canvas · `0.7→1.0` Grand Opening — scope and exit criteria in [ROADMAP.md](ROADMAP.md).
