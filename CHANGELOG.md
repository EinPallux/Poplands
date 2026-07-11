# Changelog

All notable changes to **Poplands** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: milestone-based `0.x` (see [ROADMAP.md](ROADMAP.md)), aiming for semantic versioning from 1.0.

## [Unreleased]

### Added — v0.3 "Pops & Purpose" (pending user milestone review)
- **Economy (S13):** two currencies (Pops ●, Stardust ✦) with a single-writer wallet. Income buildings accrue Pops lazily — `computeStored` is a pure read over elapsed time clamped to each building's cap, so offline is never special-cased and a backward clock costs nothing (no-grind covenant). Collect one (`cmd:collect`) or all ripe (`cmd:collectAll`); placement charges & 100 %-refunds through one path. Purchases are gated, never blocked mid-drag. 12 economy tests (accrual, cap clamp, offline, refund symmetry).
- **Progression (S14):** XP + levels to 20 on a `round10(60·L^1.55)` curve; placement grants XP once per placement id (idempotence ledger, so move/hydrate never double-count); quest & level rewards feed the same intake. Tier gating — Tiers 1–2 open at L1 (the tutorial teaches them), Tier N≥3 unlocks at level N — with a live "New in Catalog" reveal. 13 progression tests.
- **Quests (S15):** data-driven predicate DSL (`place/own/collectPops/reachLevel/adjacency/findSecret/all`) evaluated by a three.js-free runtime. 12-step tutorial chain (auto-complete, no claim button), a rolling 2-slot postcard pool with cooldown refill + skip-defer, and lifetime milestone counters. Forgiving seeding counts already-owned items; the move exploit is closed (a re-drop never advances counters). 11 quest tests.
- **Content Tiers 3–6 (~40 items):** crops, homes, décor, and income buildings as data, plus a **prefab bake pipeline** composing multi-part landmarks (Bakery, Well, Scarecrow, Apple Tree) from kit pieces into single GLBs.
- **Full HUD & juice (S21/S11):** wallet pills with spring-tick counters, an SVG level ring bound to XP progress, the Mailbox (tutorial + postcard cards, skip), world-anchored ripen bubbles that fill as income accrues, coin-arc collection flight, level-up & quest-complete celebrations. All motion via presets with the reduced-motion path.
- **Verification:** `scripts/verify-v03.mts` — headless boot → tutorial-advances-on-place → charges+rewards → Tier-2 income building buildable at L1 → wallet math → reload persistence (12 checks green). `scripts/shots-v03.mts` captures milestone beauty shots.

### Changed — feel polish (user feedback, 2026-07-11)
- **Bouncier placements:** the `popBounce` pop-in easing now overshoots to ~1.19 (from ~1.16) with a slightly longer-lived settle dip, over a 0.36 s pop — a clearer "boing" on every placement without tipping into wobble.
- **Build-bar tab transitions:** switching category tabs now replays a staggered card cascade (rise + scale + fade, springy easing, 24 ms per-card delay, reduced-motion safe) so the catalog feels alive instead of a static show/hide.
- **Review hardening:** postcard slots refill once their cooldown lapses (a per-frame quest tick), the tutorial funds its own XP so reaching L2/L3 is never a grind wall, a skipped postcard is deprioritised behind the fresh pool, and the XP idempotence ledger is bounded to live placements so it can't grow without limit.

### Added — v0.2 "Builder's Joy" (user-approved 2026-07-11)
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
