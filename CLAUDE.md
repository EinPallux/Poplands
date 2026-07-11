# CLAUDE.md — Poplands

Guidance for Claude Code (and humans) working in this repository.

## What this project is

**Poplands** — a single-player, browser-first, 3D low-poly cozy game built with **three.js + strict TypeScript + Vite**. The player grows a floating sky island chunk by chunk (8×8-block chunks), places buildings/props on a block grid, earns currencies (Pops ● / Stardust ✦), completes gentle quests, and watches Islanders & Pals live on the island. Signature trait: **outstanding, springy "pop" animations on every interaction** — juice is core IP, not garnish.

## Current state

**v0.1 "First Light" built — awaiting user milestone review before starting v0.2.**
Implemented: Vite/TS scaffold, core modules (grid/tween/spring/events/signals/strings) with 26 passing tests, asset pipeline v1 (31 curated models → `public/assets`), renderer + lighting + sky/cloud-sea/clouds/islets, damped camera rig + input + hover picking, starter island (face-culled vertex-colored ground, crag skirt, prop layout, spinning composed windmill), loading screen, debug HUD (`?debug=1`), CI. Dev tools: `scripts/screenshot.mts` (headless beauty shots), `scripts/inspect-model.mts`.
Known polish items for v0.2: backlit foliage reads too dark from low north angles; hanging-moss models render as black shards (cut, needs DoubleSide); windmill is a hardcoded composition (replace via prefab pipeline).
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
Waiting on the user's go-ahead to start **ROADMAP v0.1 "First Light"** (scaffold → pipeline v1 → renderer/sky → camera → static starter island). Follow ROADMAP §Immediate Next Steps.
