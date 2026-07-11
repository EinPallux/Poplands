# CLAUDE.md — Poplands

Guidance for Claude Code (and humans) working in this repository.

## What this project is

**Poplands** — a single-player, browser-first, 3D low-poly cozy game built with **three.js + strict TypeScript + Vite**. The player grows a floating sky island chunk by chunk (8×8-block chunks), places buildings/props on a block grid, earns currencies (Pops ● / Stardust ✦), completes gentle quests, and watches Islanders & Pals live on the island. Signature trait: **outstanding, springy "pop" animations on every interaction** — juice is core IP, not garnish.

## Current state

**v0.5 "Little Neighbours" — feature-complete & verified. v0.6 "Living Canvas" — feature-complete & verified (awaiting milestone review). v0.4 accepted.**
The diorama breathes. **Islanders (S16)** move in as homes appear (min Σhouse-capacity, cap 12, monotonic), **wander** a three.js-free FSM (walkable = on-island, not landmark-blocked, no solid prop; paths OK), and are **tappable** (pause → cute speech bubble + wave emote + babble). **Move-in moment**: a new resident walks in from the cloud edge with a named toast. **Pals (S18)**: cat/dog/bunny/chick/pig/cow scamper in per 8 nature items (cap 6), nibble grass, and get **petted** (hearts + chirp). Rendered by a shared **Tier-C `AgentRenderer`** (SkeletonUtils clone, mixer, idle↔walk blend, ±10% anti-sync, per-model scale-normalize) fed by pull-model snapshots. **`AssetRegistry` now keeps clips + skinned-safe clone.** **Day-night cycle (S7)**: `TimeOfDay` keyframes lights/sky/cloud-sea/fog dawn→day→dusk→night (freeze setting), **lantern glow** at night (`GlowLayer`), **fireflies + shooting stars + balloon** (`AmbientLife`), spaced **bird/cricket** ambient audio, and a **liveliness** Pops dividend. **Save v4** (islanders+pals rosters, migration). **v0.6 (all in)**: **themed chunks** (Meadow/Sandbar/Spooky/Snowcap — per-chunk lawn + per-outline-point grass lip & **themed slab rock**, biome preview on survey chips, `themeFor` seeded), **theme-specific secrets** (per-biome roll, "nothing" pinned at 50% so the rate is unchanged) + **ambient emitters** (`ThemeAmbience`: spooky mist/bats, snow, sand — fixed pools, night-driven, reduced-motion-safe), the **Island Album** (📖/J), **Photo mode** (P), **fps cap**, **river/path auto-tiling** (S10 — `resolveTileShape` 16-mask blob reduction + per-kit GLB variants swapped in the instanced pools, neighbours ripple), **edge-anchor placement** (S8 — docks/jetties/boats must straddle the coast; `edgeAnchorOrigin` reaches all four edges), **Tiers 11–14 content** (62 items, Harbor/Spooky/Winter/Grand), **UI-scale + colour-blind** passes (S23 — `--ui-scale` per-widget, ghost ✓/✕ badge + block-reason text + afford ✕ flag), and **themed/phased lazy-loading** (S4 — `content/assetPhases.ts` boot/early/themed:&lt;biome&gt;; `AssetRegistry.loadPhase`/`ensure`/`phaseOf` + pending-cache; boot 8.6→2.4 MB, pipeline hard-fails >3 MB boot; PropRenderer defers still-loading models, whole-kit-aware). **143 tests green**; `verify-v04.mts` (12) + `verify-v05.mts` (10) + `verify-a11y.mts` (5) + `verify-lazyload.mts` (13) all green; check+build clean. Verified via a 6-dimension adversarial review (3 confirmed fixes: variant-race crash, load-failure recovery, ghost dispose).
**v0.6 real-hardware polish only** (non-blocking): auto-tile GLB base-orientation eyeball, live 12-wanderer/6-Pal 60 fps confirm (unmeasurable headless), theme beauty shots for ART review. Optional v0.5 polish carried: fuller move-in *set-piece* popup, sit-on-bench/observe behaviours.

---

**v0.4 "New Horizons" — feature-complete & verified; awaiting user milestone review. v0.3 accepted.**
The island grows: **chunk expansion** (S7/S8 — Survey → buy adjacent 8×8 chunk with Pops+Stardust, seeded offers, 36-chunk cap, growth-aware base/outline re-trace), the **chunk-arrival set piece** (S11/S12/ART §7.2 — rises from the cloud sea, spring dock-bounce, whoosh-thunk-fanfare SFX + celebration popup, 0.8 s soft input-lock, eased camera reframe + shadow refit, reduced-motion path), **secrets** (S19 — deterministic per-chunk dig/chest/flora roll matching GDD §10, save v3 + migration), the **tutorial finale** (`chunks` predicate → call-a-chunk → dig-a-secret → free play), and the **Tier 7–10 "Riverside/Harbor" catalog** (17 items, scales AABB-tuned). **License audit CLOSED** — all packs CC0 (Fantasy RTS → Quaternius, rest → Kenney; `ATTRIBUTIONS.md`). **111 tests green**; headless `scripts/verify-v04.mts` (survey→buy→grow→dig secret→persist, 12 checks), `scripts/soak-v04.mts` (36 chunks @ 71 draws/17.7k tris ≪ budget); 60 fps confirmed smooth on user hardware. Remaining = polish only (per-block grass-ripple, survey-balloon prefab, chest/flora GLB markers).

---

**v0.3 "Pops & Purpose" built (user-accepted, continued to v0.4).**
The loop closes: earn → spend → level → quest. On top of v0.2 (placement/props/juice/save/build-UI, user-approved 2026-07-11): **economy** (S13 — Pops/Stardust wallets, lazy capped income accrual, offline-safe reads, collect/collect-all, gated purchase + 100 % refund), **progression** (S14 — XP/levels to 20, `round10(60·L^1.55)` curve, tier gating with live catalog reveals), **quests** (S15 — predicate DSL, 12-step tutorial chain, rolling 2-slot postcards, milestone counters), **content Tiers 3–6** (~40 more items + `bake-prefabs` pipeline for Bakery/Well/Scarecrow/Apple Tree), and the **full HUD + juice** (S21/S11 — wallet pills, SVG level ring, Mailbox, world-anchored ripen bubbles, coin-arc, celebrate). Sim stays three.js-free and event-driven; UI reads via bus + signal stores. **89 tests green**; headless smoke `scripts/verify-v03.mts` (boot → tutorial-advances-on-place → charge/reward → Tier-2 buildable at L1 → collect → save → reload, 14 checks) + beauty shots `scripts/shots-v03.mts`.
Feel polish from user feedback (2026-07-11): pop-in overshoot raised to ~1.19 (bouncier placements); build-bar tab switches now play a staggered card cascade. Adversarial-review hardening: postcard cooldown refill (quest tick in the loop), tutorial funds its own XP (no L2/L3 grind wall), skipped-card deprioritisation, `xpGranted` ledger bounded to live placements, carried-item survives mid-move autosave, ripe bubbles derive from economy state each frame.
Known polish items: backlit foliage reads too dark from low north angles; windmill is still a hardcoded landmark (becomes a real prefab-pipeline building in v0.5). No expansion yet — the tutorial's "Islander getting ready to move in" beat is a placeholder until v0.5.
`/assets` contains 17 raw low-poly packs (~2,100 GLB models) — the content library (never loaded at runtime).

## Document map (read before working)

| Doc | Source of truth for |
|---|---|
| [GAME_DESIGN_DOCUMENT.md](GAME_DESIGN_DOCUMENT.md) | design intent, pillars, loops, vocabulary, scope |
| [ROADMAP.md](ROADMAP.md) | sequencing, milestone exit criteria, what to build next |
| [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | stack, layout, layering rules, rendering/perf strategy, save schema, asset pipeline |
| [SYSTEMS_BREAKDOWN.md](SYSTEMS_BREAKDOWN.md) | per-system specs (S1–S24), events, DoD, cross-system flows |
| [ART_DIRECTION.md](ART_DIRECTION.md) | palette, lighting recipe, animation language & tuning specs, UI style |
| [CONTENT_PLAN.md](CONTENT_PLAN.md) | catalog items ↔ asset files, quests, rosters, economy numbers, licensing |
| [CHANGELOG.md](CHANGELOG.md) | history; update with every merged change |

Precedence on conflict: GDD states intent → SYSTEMS/TECH state mechanism → code. Fix downstream to match upstream, or amend upstream explicitly (and say so in the PR).

## Locked decisions (do not re-litigate casually)

- Stack: three.js + TypeScript strict + Vite. **No React/game framework/ECS/Redux.** In-house: signals, tween/spring (juice), event bus, WebAudio wrapper.
- Zero backend, zero telemetry. Saves = versioned JSON in localStorage + export/import.
- Runtime deps ≈ `three` only; any new runtime dependency requires written justification in the PR.
- Grid: 1 block = 1 world unit, Y-up, chunks 8×8, flat island (no elevation in v1.0), 36-chunk soft cap.
- Rendering: three prop tiers (A instanced / B unique / C agents), 1 directional + 1 hemisphere light, budgets in TECH §6.5 are **hard exit criteria**.
- Sim/presentation seam: sim is three.js-free and event-driven (`cmd:*` in, domain events out). UI talks to sim only via bus/stores.
- Assets: **GLB only at runtime**, loaded from `public/assets` produced by the manifest pipeline. Never import from `/assets` (raw packs) at runtime, never hand-copy files into `public/`.
- 100% refunds, no fail states, no FOMO timers — the no-grind covenant (GDD §7.5) is a testable requirement.
- Confirmed by user (2026-07-11): **perspective camera** (35° FOV, not orthographic) · **English-first, i18n-ready** (all user-facing text via the string table `src/core/strings.ts`; never hardcode UI strings; more languages post-1.0) · **desktop-first** (touch polish post-1.0) · **milestone cadence: pause after each milestone** for user review (push + screenshots + status) before starting the next.

## Working conventions

### Code (applies once implementation starts)
- `strict: true`; no `any`/`as` escapes without a `// justified:` comment.
- Layering (ESLint-enforced, TECH §2): `core` → `content` → `sim`/`world` → `render`/`vfx`/`audio`/`build` → `ui` → `app`. three.js types never appear in `core`, `content`, `sim`.
- Content is data: new items/quests/Pals = entries in `src/content/*` + manifest, not new code paths. Item/quest ids are stable strings, never renamed after shipping (save compatibility; removal requires a migration).
- Naming: use the GDD vocabulary exactly (Chunk, Survey, Pops, Stardust, Islander, Pal, Postcard, Placeable) in code, UI, and docs.
- Tests: grid math, save/migrations, economy, quest triggers get Vitest coverage as they land (TECH §12). Run `npm run check && npm test` before any commit once the scaffold exists.
- Animations/juice: implement via the Juice system presets (S11) with the ART §7.2 tuning table — never ad-hoc lerps scattered in features. Reduced-motion must be handled by the preset, not the caller.
- Performance: no steady-state allocation in per-frame paths; new features check the debug HUD counters against TECH §6.5 budgets.

### Process
- Branch per the task instructions; commit messages: imperative, scoped, e.g. `feat(build): ghost validity + pop-in placement`, `docs(roadmap): tighten v0.3 exit criteria`.
- Update CHANGELOG.md (Keep a Changelog format) with every user-visible or doc change.
- When a milestone's work is done, verify its ROADMAP exit criteria explicitly and record results in the PR description.
- Never ship/reference an asset pack that isn't license-verified in `ATTRIBUTIONS.md` (pipeline enforces; see CONTENT_PLAN §1.1 — **the audit is still open**).
- Do not create PRs unless asked. Push to the designated branch.

### Assets quick facts (for implementation work)
- Packs live in `/assets/<Pack Name>/…`; most have `Models/GLB format/*.glb`; `Nature Assets`, `Fantasy RTS Assets`, `Coral Reef Assets` are flat GLB folders; `Nature Assets 2`, `Space`, `Street` use `Models/GLTF format/*.glb`.
- Character GLBs (`NPCS/…`) and Cube Pets are **pre-animated** (clips incl. `idle/walk/sit/interact-*/emote-*` and `idle/walk/run/eat/dance/gesture-*` respectively); pipeline validates required clips.
- Some packs have hash-suffixed duplicate variants (`House-RSwoYSLblu.glb`) — poly.pizza-style exports; treat as variants of the base model and mind the license audit.

## Definition of done (any feature)
1. Matches GDD intent + SYSTEMS spec (or docs amended in the same PR).
2. Juiced per ART §7 (if user-facing) incl. reduced-motion path.
3. Within perf budgets (debug HUD check).
4. Save-compatible (round-trip test if state added).
5. Tests for sim/core logic; `check`+`test` green.
6. CHANGELOG updated.

## What to do next (as of last update)
**v0.7 → v1.0 "Grand Opening" is underway (4 of 5 slices done).** ✅ **Slice 1** — Tiers 15–20 (13 items; `ItemDef.tier`→20, arc unlocks to L20), the **Pop Post** auto-collector (`autoCollectRadius`→EconomySystem radius sweep), the **Grand Assembly Hall** liveliness bonus (`livelinessBonus`→LivelinessSystem), and **The Wonder** capstone (`AuroraLayer` permanent aurora + one-time celebration + `pc.wonder`). ✅ **Slice 3** — full-arc L1→L20 balance pass (`scripts/balance-v07.mts` + `tests/balance.test.ts`): no-grind covenant holds, no tuning needed. ✅ **Slice 4** — hardening: WebGL context-loss recovery (`RendererManager`), storage-full save resilience (`SaveManager`), worst-case perf soak (`soak-v07.mts` — 304 draws/264k tris ≪ budgets). ✅ **Slice 5 (deploy infra)** — Vercel-ready (`vercel.json`, `og-image`, README, v0.7.0). **151 tests + verify-v07/balance-v07/soak-v07 + all regressions green.** ✅ **Slice 2** — Tier 8–12 variety fillers (9 items: coastal homes/nature/decor + a Spooky **Haunted Galleon** income; every tier 8–12 now has a home + income; `verify-slice2.mts` green). **Deploy: Vercel now (preview/iterate), itch.io for the public release later — more content coming first before publish (user, 2026-07-11).** All 5 v0.7 slices done; catalog now 168 items.

**Cozy polish batch (post-v0.7, user 2026-07-11) — done & verified.** Four user asks: ✅ **camera un-mirror** (vertical right-drag orbit sign fix in `InputController`), ✅ **prominent income bubbles** (`WorldFx` surfaces a readable `● amount` cream pill only past a ≥55%-ripe **and** ≥12-Pop threshold so the map stays calm; subtle dot below), ✅ **background music** (optional `public/bgm.mp3` loop via new `MusicSystem`, silent no-op if absent; **Music** volume slider in Settings, `SaveSettings.musicVolume` back-filled no-version-bump), and ✅ **weather** from the post-1.0 backlog (`WeatherSystem`: passing rain showers + a billboarded low-poly rainbow, fixed pools, reduced-motion-safe, self-wires to growth). **152 tests + `verify-cozy.mts` (9 checks) + `verify-a11y`/`verify-v07` regressions all green; check + build clean.** Debug handle gained `weather`/`weatherShower`/`weatherRainbow`/`ripen`/`placementsOf`/`camPolar` for headless verification.

**Remaining before v1.0:** the final release lock (full docs sync + GDD §14 release-gate audit) at publish time, plus whatever new content/features the user wants next. The user is still in an expansion mood ("a lot of stuff to do") — good next candidates from the post-1.0 backlog: a **fishing-pond minigame**, **seasons / limited-time events**, **daily gift** loop, or **island-code sharing** (URL-encoded save).

---

**v0.6 "Living Canvas" is feature-complete & verified** — themed biomes (+ theme secrets/ambient/slab rock), Album, Photo mode, fps cap, river/path auto-tiling, edge-anchor placement, Tiers 11–14 (62 items), UI-scale + colour-blind passes, and themed/phased lazy-loading (S4); 143 tests + `verify-v04`/`v05`/`a11y`/`lazyload` all green; closed by a 6-dimension adversarial review (3 fixes applied). **Awaiting the user's milestone review** (cadence: pause + push + status before starting the next). On real hardware, do the last-mile eyeballs: auto-tile GLB base-orientation, a 12-wanderer/6-Pal 60 fps confirm (unmeasurable headless), and theme beauty shots for ART. Then **v0.7→v1.0 "Grand Opening"** (Tiers 15–20 incl. The Wonder capstone + the remaining ~40 Tier 9–14 content items, full-arc balance, perf/browser hardening, deploy pipeline). Perf note: 20-chunk themed island + agents holds ~78–91 draws / 15–17k tris (≪ TECH §6.5 budgets).
Optional v0.4 polish (non-blocking, can fold into v0.5): per-block grass-ripple on arrival (currently a sparkle approximation), a survey-balloon prefab (currently a 🎈 marker), chest/flora GLB markers (currently the ✨ sparkle for all kinds), and a Settings Credits panel (Kenney + Quaternius).
