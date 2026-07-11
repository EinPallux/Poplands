# CLAUDE.md — Poplands

Guidance for Claude Code (and humans) working in this repository.

## What this project is

**Poplands** — a single-player, browser-first, 3D low-poly cozy game built with **three.js + strict TypeScript + Vite**. The player grows a floating sky island chunk by chunk (8×8-block chunks), places buildings/props on a block grid, earns currencies (Pops ● / Stardust ✦), completes gentle quests, and watches Islanders & Pals live on the island. Signature trait: **outstanding, springy "pop" animations on every interaction** — juice is core IP, not garnish.

## Current state

**v0.4 "New Horizons" — core loop built & verified (expansion + arrival set piece + secrets); awaiting user review. v0.3 accepted.**
The island grows: **chunk expansion** (S7/S8 — Survey → buy adjacent 8×8 chunk with Pops+Stardust, seeded offers, 36-chunk cap, growth-aware base/outline re-trace), the **chunk-arrival set piece** (S11/S12/ART §7.2 — rises from the cloud sea, spring dock-bounce, confetti+fanfare, 0.8 s soft input-lock, eased camera reframe + shadow refit, reduced-motion path), and **secrets** (S19 — deterministic per-chunk dig/chest/flora roll matching GDD §10, `findSecret` quest wired, save v3 + migration). **110 tests green**; headless `scripts/verify-v04.mts` (survey→buy→grow→dig secret→persist, 12 checks). Deferred: **Tier 7+ catalog is license-gated** (Pirate/RTS packs unverified — audit still open, CONTENT §1.1); the 60 fps arrival-torture + 36-chunk soak are hardware-dependent gates (software renderer can't measure fps; draws/tris sit far under budget); tutorial steps 11–12 are a follow-up.

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
Waiting on the user's v0.4 core-loop review. The expansion/arrival/secrets loop is built + verified; the remaining v0.4 items are **blocked or hardware-dependent**, so they're the natural next steps once unblocked:
1. **Asset license audit** (`ATTRIBUTIONS.md`, CONTENT §1.1) — the gating dependency for the **Tier 7–8 "Riverside" + Tier 9–10 "Harbor" catalog** (~17 items already designed, mapped to Nature Assets 2 / Fantasy Town / Pirate / RTS packs). Verify pack licenses, record them, then land the catalog (widen `ItemDef.tier` to 10, add the entries + manifest ids, `npm run assets`). Lighthouse needs a `bake-prefabs` composite.
2. **Perf gates** (real hardware / user playtest — the software renderer can't measure fps): the 10-arrival confetti torture test at 60 fps and the 36-chunk scripted soak within TECH §6.5 draw/tri budgets. Add a scripted "worst-case island" soak scene + a chunk-arrival replay button (S24).
3. **Tutorial steps 11–12** (call-a-chunk → investigate-the-sparkle) — extend the chain once the tutorial-XP pacing is re-tuned for the new steps.
4. Polish: per-block grass-ripple on arrival (currently a sparkle approximation), the survey-balloon prefab (currently a procedural 🎈 marker), chest/flora GLB markers (currently the ✨ sparkle for all kinds).
