# Poplands — Roadmap

> Seven milestones. Every one ends with something you can play, watch, and screenshot.

| | |
|---|---|
| **Document** | Roadmap — sequencing & milestone exit criteria |
| **Status** | Planning — awaiting confirmation to start v0.1 |
| **Version** | 0.1.0-plan |
| **Last updated** | 2026-07-10 |
| **Related docs** | [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) · [TECHNICAL_ARCHITECTURE](TECHNICAL_ARCHITECTURE.md) · [SYSTEMS_BREAKDOWN](SYSTEMS_BREAKDOWN.md) (S-numbers below) · [CONTENT_PLAN](CONTENT_PLAN.md) |

**Principles:** ship playable slices, never horizontal layers · juice lands *with* its feature, not in a "polish phase" · every milestone has hard exit criteria (perf + feel) · content tiers arrive with the systems that make them shine. Versions are sequenced, not dated — each milestone is roughly a focused development sprint; quality gates decide when it's done.

---

## v0.1 — "First Light" (Foundation that already looks like the game)
*The island exists, floats, and is beautiful. You can orbit it and want to.*

**Build (systems):** S1 loop/modes · S2 bus/signals · S5 renderer/lighting/quality tiers · S6 camera rig + picking basics · S7 sky/clouds/islets (static golden day) · S24 debug HUD · S4 boot-phase loading.
**Build (world):** project scaffolding per TECH §2 (Vite/TS/ESLint/Vitest/CI check+test) · asset pipeline v1 (`prepare-assets` for a hand-picked ~20-model starter manifest) · static 2×2-chunk starter island with merged ground + skirt, pre-placed props (hardcoded layout — placement comes next) · hover highlight on blocks.

**Playable result:** open URL → swoop onto a gorgeous floating island with drifting clouds; orbit/zoom/pan feels silky; hovering blocks responds.
**Exit criteria:** 60 fps @ Med on mid laptop; boot < 3 MB / TTI < 4 s; camera passes the "blindfold test" (S6 DoD); dusk/day screenshots pass ART §1 pillar check; CI green.

## v0.2 — "Builder's Joy" (The core verb, fully juiced)
*You can build, and building feels incredible. This is the make-or-break feel milestone.*

**Build:** S8 island model (static extent) · S9 placement (place/move/remove/rotate, refunds) · S10 prop renderer (Tier A instancing + Tier B, promote-animate-demote) · S11 juice engine + `pop-in/out`, ghost, hover-lift · S12 particles v1 (dust/poof) · S3 save/load v1 + export/import · S21 UI skeleton (HUD currencies static, catalog bar, item cards) · S22 audio stub (plop family) · S20 first ambient anims (windmill spins, banner sways) · S23 minimal settings.
**Content:** Tiers 1–2 (~22 items, CONTENT §2) · license audit + `ATTRIBUTIONS.md` (CONTENT §1.1) · particle atlas + UI kit v1 (ART §10).

**Playable result:** a free-build sandbox: place/move/remove 22 item types with pops, poofs and plops; windmill turns; island persists across reloads; export your island.
**Exit criteria:** F1 flow latency ≤ 50 ms (SYSTEMS F1); place-500-items script holds 60 fps & flat heap; save round-trip + kill-tab recovery green; **feel gate:** 3 external playtesters each spontaneously place > 50 items ("just one more flower" test).

## v0.3 — "Pops & Purpose" (The loop closes)
*Now it's a game: earn, spend, level, quest.*

**Build:** S13 economy (income/caps/offline/collect) · S14 XP/levels/tier gating · S15 quests (tutorial chain + postcards + milestones) · S21 full HUD (live wallets, level ring, mailbox, purchase flows, toasts, "New in Catalog" reveals) · `coin-arc`, `ripen-bubble`, `celebrate` presets (S11) · S6 focus-glide · S4 phased loading (`early`).
**Content:** Tiers 3–6 (~60 items total) incl. first authored prefabs (Bakery, Well, Scarecrow — pipeline `bake-prefabs` v1) · tutorial (12 steps) + 20 postcards + milestones v1 · opening economy numbers (CONTENT §6).

**Playable result:** the GDD's first-10-minutes contract *minus expansion*: tutorial guides to first stall, first collect, first Islander-house (house exists; Islander arrives in v0.5 — the tutorial step reads "…is getting ready to move in!" until then), leveling and catalog reveals pace the session.
**Exit criteria:** economy unit suite green (offline math!); L1→L6 in 25–40 relaxed minutes with zero dead-time (no-grind covenant checklist); Playwright smoke (boot→place→collect→save→reload); tutorial completable AND ignorable.

## v0.4 — "New Horizons" (The island grows — the money shot)
*Chunk purchase + arrival set piece + secrets. The brand moment ships here.*

**Build:** S8 expansion (surveys, offers, pricing, themes plumbing) · **S11 `chunk-arrival` choreography** (clouds, rise, dock-bounce, ripple, confetti, fanfare, skip) · S19 secrets v1 (dig sparkles, chests, forced tutorial secret) · Stardust wallet & sources · S5 shadow refit + S6 auto-reframe on growth · S10 instancing hardening (pool growth, bulk rebuild) · skirt auto-generation for arbitrary chunk shapes.
**Content:** Tiers 7–8 (~75 items; river tiles, watermill) · +10 postcards incl. chain paying the first chunk · survey balloon prefab · tutorial steps 11–12 complete.

**Playable result:** the full core loop forever: earn → survey → **watch land rise from the cloud sea** → discover its secret → decorate it. The complete first-10-minutes contract is now live.
**Exit criteria:** chunk-arrival hits ART spec at 60 fps (10-arrivals torture test, S12 DoD); 36-chunk scripted soak passes draw/tri budgets (TECH §6.5); secrets distribution test green; **feel gate:** playtesters buy a chunk and immediately want the next (ask them).

## v0.5 — "Little Neighbors" (The island comes alive)
*Islanders move in, Pals scamper, day turns to night. The diorama breathes.*

**Build:** S16 Islanders (move-ins, vibe-AI, A*, interactions, re-home) · S17 agent animation controller · S18 Pals + adoption crates + petting · S7 day-night cycle (+freeze setting) with lantern/window glow · S19 ambient events (shooting stars, balloon flyby) · S22 full audio pass (music/ambience layers, zoom mix, ducking) · S12 full particle set (hearts, fireflies) · liveliness bonus (S13).
**Content:** 16 Islanders + 6 Pals (CONTENT §5) · +10 life postcards (incl. observe-quests) · audio assets sourced & attributed (CONTENT §8).

**Playable result:** windows glow at dusk while Mo waters your flowers and a cat naps by the fountain — the screenshot that markets the game takes itself.
**Exit criteria:** 12 wanderers + 6 Pals at 60 fps, 1-hour no-stuck soak (S16 DoD); move-in moment lands (external playtest "aww" rate — target: audible); night beauty shot passes ART §3.2; audio has zero machine-gun artifacts (S22 DoD).

## v0.6 — "Living Canvas" (Breadth: themes, album, photo mode)
*The mid/late game gets its content and the tools to love it.*

**Build:** themed chunks (Sandbar/Spooky/Snowcap: ground, skirts, border blending, theme secrets & ambient emitters) · river/path auto-tiling upgrade · edge-anchor placement rule (docks, moored boats) · Island Album (collections, milestones surfacing, Pal/Islander bios) · Photo mode (free cam, UI hide, DoF "Diorama" toggle, PNG export) · S23 complete settings/accessibility (reduced motion, colorblind cues, UI scale, fps cap) · S4 `themed` lazy loading.
**Content:** Tiers 9–14 (~105 items; Harbor/Spooky/Snowcap sets incl. Lighthouse, ghost Pal chain) · +15 postcards · +6 Pals (12 total).

**Playable result:** distinct districts across biomes, an album to complete, and a photo mode that produces share-bait.
**Exit criteria:** theme beauty shots ×3 pass ART review; lazy tiers load invisibly (no hitch > 30 ms); album/collection state survives export/import; accessibility pass (reduced-motion full coverage audit against S11 presets).

## v0.7 → v1.0 — "Grand Opening" (Depth, balance, launch)
*Finish the arc, tune everything, open the doors.*

**Build:** Tiers 15–20 content (Castle, Wonders, Dreamer, Pop Post, **The Wonder** capstone w/ aurora) · full-arc balance pass (L1→L20 pacing sim + 3 full external playthroughs) · performance hardening vs worst-case island on min-spec + browser matrix (Chrome/FF/Safari/Edge) · onboarding polish (first-session telemetry-by-observation) · error/edge sweep (context loss, storage full, clock tamper) · deploy pipeline (Pages + itch.io zip, og-image, favicon) · trailer GIF captures · docs sync (all 8 docs updated to as-built).
**Release gates (v1.0):** GDD §14 scope checklist 100% · all milestone exit criteria still green on min-spec · zero known save-loss bugs · no-grind covenant verified across the whole arc · CHANGELOG complete · ATTRIBUTIONS complete & accurate.

---

## Post-1.0 Backlog (parked, in rough priority)
Elevation/terraces (cliff kit is ready for it) · weather (rain sparkle, rainbows) · seasons & events (12 reserve Pals, Graveyard/Snow packs go seasonal) · fishing pond minigame · island-code sharing (URL-encoded save) · touch/mobile tuning · Suburbia/Tinker novelty tiers (City/Factory/Market/Space packs) · ambient hop-over-fence NPC moment (S16 note) · Steam wrapper · localization framework.

## Standing Rhythm (every milestone)
Playtest with ≥ 3 outsiders → feel-gate honestly · perf check vs budgets on min-spec · docs & CHANGELOG updated · content added only via pipeline+manifest (never hand-copied files) · a 10-second "milestone beauty GIF" recorded for the log.

## Immediate Next Steps (upon user confirmation — see CLAUDE.md)
1. v0.1 scaffold: Vite + TS strict + ESLint/Prettier + Vitest + CI check.
2. Asset pipeline v1 + starter manifest (~20 models) + license audit kickoff.
3. Renderer/lighting/sky per ART §4 → first beauty screenshot for review.
4. Camera rig → the "orbit joy" checkpoint.
5. Static starter island → v0.1 exit review, then v0.2.
