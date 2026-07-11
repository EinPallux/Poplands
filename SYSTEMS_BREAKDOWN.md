# Poplands — Systems Breakdown

> Every system: what it owns, what it emits, what "done" means.

| | |
|---|---|
| **Document** | Systems Breakdown — per-system specification |
| **Status** | Planning |
| **Version** | 0.1.0-plan |
| **Last updated** | 2026-07-10 |
| **Related docs** | [TECHNICAL_ARCHITECTURE](TECHNICAL_ARCHITECTURE.md) (global rules) · [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) (intent) · [ROADMAP](ROADMAP.md) (sequencing) |

Conventions: each system lists **Purpose · Owns · Interface sketch · Events (▸ emits / ◂ consumes) · Depends on · Perf & edge notes · Milestone · DoD**. Event names and interfaces are illustrative contracts, finalized at implementation. Systems marked 🎨 are presentation-side, 🧠 simulation-side, 🧰 infrastructure (per the sim/presentation seam, TECH §3).

---

## S1 🧰 App Shell & Game Loop
**Purpose:** bootstrap, own the rAF loop, fixed-step sim accumulator, mode stack, pause/visibility.
**Owns:** `App`, `GameClock` (wall time, sim time, dt clamp 50 ms), `ModeStack` (Play/Build/Photo), system registry with ordered `update(dt)` phases: `input → mode → simTick(10 Hz) → continuous → juice → render`.
**Interface:** `interface GameSystem { init(ctx); update?(dt); simTick?(); dispose() }`.
**Events:** ▸ `app:ready`, `app:pause/resume`, `mode:changed` ◂ none.
**Depends on:** everything registers into it; it knows only the interface.
**Perf/edge:** visibility pause; on resume emit `app:resumed{elapsedMs}` (consumed by Economy for offline accrual). Never tick sim with giant dt.
**Milestone:** v0.1. **DoD:** loop runs 60 fps empty-scene; mode push/pop works; hidden-tab burns 0 CPU.

## S2 🧰 Event Bus & Stores
**Purpose:** typed pub/sub seam between sim and presentation; small reactive stores for UI.
**Owns:** `EventBus<EventMap>` (compile-time event names/payloads), `signal/computed/effect` primitives, domain stores (`PlayerStore`, `IslandStore`, `QuestStore`, `SettingsStore`) exposing signals.
**Interface:** `bus.emit('item:placed', p)`, `bus.on('item:placed', h)` (returns unsubscribe; auto-scope helper for systems).
**Events:** the registry itself. Command events (`cmd:*`) flow UI→sim; domain events flow sim→presentation.
**Perf/edge:** high-frequency events use pooled payloads (TECH §8); dev-mode listener-leak detector (warn if count grows across mode pops).
**Milestone:** v0.1. **DoD:** event map fully typed; unsubscribing verified; UI counter binds to a signal end-to-end.

## S3 🧰 Save/Load & Migrations
**Purpose:** persist/restore the entire game from `SaveV1` (TECH §4); autosave; export/import.
**Owns:** schema types, serializer (stores → JSON), hydrator (JSON → stores + world rebuild command), migration registry, 3-slot rolling backup, save-size guard (warn > 1 MB).
**Events:** ▸ `save:written`, `save:loaded`, `save:failed` ◂ any mutating domain event (debounced 5 s), `app:pause`.
**Depends on:** stores (S2); world rebuild is performed by S8/S10 reacting to `save:loaded`.
**Perf/edge:** corrupt JSON → fall back through backups → else fresh island + apologetic toast (never a blank crash). Unknown item ids on load → placement quarantined into save's `attic` array (content removed in an update), never dropped silently.
**Milestone:** v0.2 (v1 schema), migrations from v0.3 on. **DoD:** round-trip test green; kill-tab-mid-save recovers; export → fresh browser → import → identical island.

## S4 🧰 Asset Registry & Loader
**Purpose:** runtime access to optimized GLBs/clips/textures per the pipeline (TECH §7); phased loading.
**Owns:** manifest, GLTFLoader(+meshopt), parse cache, clip registry (`modelId/clipName`), phase loader (`boot/early/themed`), progress signals, dispose sweeps.
**Interface:** `assets.getModel(id): CachedModel` (geometry+material refs for Tier A, cloneable scene for Tier B/C), `assets.getClip(modelId, name)`.
**Events:** ▸ `assets:phaseLoaded('boot')`, `assets:progress{phase,0..1}`.
**Perf/edge:** missing asset id → dev panic / prod placeholder mesh (pink mushroom of shame) + log; double-load races guarded by promise cache.
**Milestone:** v0.1 (boot phase), phases v0.3+. **DoD:** boot < 3 MB; loading bar honest; zero duplicate GPU uploads (verified via renderer.info).

## S5 🎨 Render Manager & Quality
**Purpose:** renderer/scene/lights/postFX setup per TECH §6 & ART §4; quality tiers; resize/context-loss.
**Owns:** `WebGLRenderer`, scene graph roots, sun+hemi rig, shadow-frustum fitter (on `chunk:unlocked`), bloom/vignette composer (quality-gated), `QualityConfig` + auto-probe.
**Events:** ◂ `chunk:unlocked` (refit shadows), `settings:qualityChanged` ▸ `render:contextLost/Restored`.
**Perf/edge:** frame budget counters exposed to debug HUD; context-loss → S3-backed rebuild.
**Milestone:** v0.1. **DoD:** beauty-shot parity with ART §3 palette on all 3 tiers; context-loss recovery demoable.

## S6 🎨 Camera Rig & Input
**Purpose:** the diorama camera (GDD §11) + unified pointer/keyboard input routed through modes.
**Owns:** azimuth/polar/distance/target springs + clamps, `frameIsland()`, focus-glide, input gesture recognizer (click vs drag), keymap, picking service (ground-plane math + throttled raycast + instanceId hover, TECH §9).
**Events:** ▸ `input:cellHover{cell}`, `input:cellClick`, `input:objectClick{id}`, `camera:moved` ◂ `cmd:focus{target}`, `chunk:unlocked` (auto-reframe).
**Perf/edge:** raycast only on pointer-move frames; picking sets rebuilt on placement changes, not per frame. Camera clamps must feel like cushions (spring past-limit resistance), not walls.
**Milestone:** v0.1 (orbit/zoom/pan), focus-glide v0.3. **DoD:** blindfold test — camera never snaps, never clips island, reset always recovers; 30-min idle drift = none.

## S7 🎨 Sky, Atmosphere & Day-Night
**Purpose:** the stage: sky dome, cloud sea, drifting clouds, islets, birds, stars; day-night grading (ART §3.2, §5).
**Owns:** dome+cloud-sea shaders (time uniforms), puffball/islet/bird drift controllers, `DayNightClock` (sim-side 20-min cycle, freezable) driving sun angle/colors/fog + emissive night states.
**Events:** ▸ `time:phaseChanged('dawn'|'day'|'dusk'|'night')` (consumed by NPC bedtime, lantern glow, secrets' night events) ◂ `settings:dayNightMode`.
**Perf/edge:** all sky elements exempt from shadow pass; cloud count quality-gated; night phase short per ART.
**Milestone:** v0.1 (static golden day), cycle v0.5. **DoD:** dusk screenshot passes ART beauty check; phase events fire reliably (drives 3 downstream systems).

## S8 🧠 Island & Chunk System
**Purpose:** authoritative island model: chunk set, occupancy, themes, adjacency, survey slots.
**Owns:** chunk map + 64-cell occupancy layers (prop/ground), pure grid math (`core/grid`), survey-slot generator (3 offers on free edges, re-roll), chunk price ladder evaluation, theme assignment.
**Interface:** `canPlace(def, anchor, rot): Placeable | BlockReason`, `place/remove/move`, `freeEdges(): Slot[]`.
**Events:** ▸ `chunk:offered[slots]`, `chunk:unlocked{chunk}`, `island:occupancyChanged` ◂ `cmd:buyChunk{slot}`, `cmd:rerollSurveys`.
**Depends on:** content defs (footprints), PlayerStore (afford checks via Economy).
**Perf/edge:** all queries O(footprint); cross-chunk footprints first-class (tested); surveys never offered where they'd exceed the 36-chunk soft cap or detach from the lattice.
**Milestone:** v0.1 (static 2×2), full expansion v0.4. **DoD:** grid unit suite green (the big one); island grows organically to 36 chunks in a scripted soak test.

## S9 🧠 Placement/Build System
**Purpose:** the build-mode brain: catalog state, ghost validity, transactional place/move/remove.
**Owns:** `BuildSession` (selected def, rot, ghost cell, validity incl. funds), transaction orchestration (validate → charge → occupy → emit), refund logic (100%), stay-in-mode chaining.
**Events:** ▸ `item:placed{placement}`, `item:removed`, `item:moved`, `build:ghostChanged{valid,reason}` ◂ `cmd:place/move/remove`, `input:cellHover/Click`, catalog selection from UI.
**Depends on:** S8 (validity), Economy (charge/refund), content defs.
**Perf/edge:** double-click races idempotent (transaction checks funds+occupancy atomically in sim tick); removing an occupied Home triggers Islander re-home flow (S16) before finalize.
**Milestone:** v0.2. **DoD:** place/move/remove/refund all juiced & save-persistent; invalid reasons are specific (occupied vs funds vs off-island) for UI messaging.

## S10 🎨 Prop Renderer (three tiers)
**Purpose:** project placements → meshes per the Tier A/B/C strategy (TECH §6.2); own the promote-animate-demote trick.
**Owns:** InstancedMesh pools + free-lists (Tier A), cloned-scene registry (Tier B), pop-in/out choreography hooks, hover-lift transforms, per-item import transforms (scale/pivot fixes from catalog).
**Events:** ◂ `item:placed/removed/moved`, `save:loaded` (bulk rebuild), `build:ghostChanged` (ghost mesh) ▸ `props:rebuilt` (for picking sets S6).
**Perf/edge:** pool growth by doubling; bulk rebuild path skips animations (load = instant island); ghost is its own always-alive object (never allocated per hover).
**Milestone:** v0.2 (A+B), instancing hardening v0.4. **DoD:** worst-case island hits draw budget (TECH §6.5); place/remove 500 items in a script without leak (heap flat).

## S11 🎨 Juice System (tween/spring/choreography) — *the brand system*
**Purpose:** one home for all motion: easing/spring engine + the canonical animation presets (ART §7.2) + celebration compositions.
**Owns:** `tween(target, props, {ease,duration})` & `spring(target, props, {stiffness,damping})` batched updaters (zero-alloc), preset library (`popIn(obj)`, `popOut`, `coinArc(from,to,n)`, `chunkArrival(chunk)`, `celebrate(kind)`…), stagger/cascade helpers, reduced-motion switchboard.
**Events:** ◂ nearly every domain event (it's the biggest subscriber) ▸ `juice:setPieceStarted/Ended` (input soft-lock for chunk arrival's first 0.8 s).
**Depends on:** works on any setter — three.js objects, DOM styles, audio params (one motion language).
**Perf/edge:** active-tween cap with graceful shedding (oldest ambient first); all presets interruptible & idempotent (re-trigger restarts cleanly); reduced-motion swaps presets, callers never branch.
**Milestone:** engine v0.2 · chunk-arrival v0.4 · full preset table by v0.7. **DoD:** every ART §7.2 row implemented & tunable live in debug panel; 100 concurrent tweens < 0.3 ms/frame.

## S12 🎨 VFX (particles & decals)
**Purpose:** pooled particle systems (poof, dust ring, confetti, hearts, sparkle, leaves, fireflies, snow) + ground decals (selection ring, blob shadows, light cookies, soil).
**Owns:** 2 GPU particle pools (world quads / screen-space UI arcs) fed by emitter descriptors; decal quad manager.
**Events:** ◂ triggered by Juice presets only (single choke point keeps effects consistent).
**Perf/edge:** budget 2,000 live particles Med (quality-gated); atlas from ART §10; zero allocation on emit.
**Milestone:** v0.2 basics, full set v0.5. **DoD:** confetti torture test (10 chunk-arrivals queued) holds frame budget.

## S13 🧠 Economy System
**Purpose:** Pops/Stardust wallets, income accrual (online+offline, capped), collection, purchases/refunds, pricing curves.
**Owns:** wallet mutations (single write path), per-building accrual state (`storedPops`, `lastCollectAt`), liveliness bonus calc, chunk/catalog price evaluation, offline-earnings resolution on `app:resumed`/load.
**Events:** ▸ `income:ripe{placementId}`, `income:collected{amount,at}`, `wallet:changed`, `purchase:denied{reason}` ◂ `cmd:collect`, `cmd:collectAll(PopPost)`, `simTick`, `app:resumed{elapsed}`.
**Perf/edge:** accrual computed lazily from timestamps (no per-second loops over buildings — ripeness checked on 10 Hz tick against next-ripe heap); clock-tamper tolerance: negative elapsed clamps to 0, huge elapsed clamps to caps (caps make cheating pointless — cozy).
**Milestone:** v0.3. **DoD:** economy unit suite green incl. offline math; tuning tables hot-reloadable in dev; no-grind covenant checklist passes at L1–L10 playtest.

## S14 🧠 Progression (XP/Levels/Tiers)
**Purpose:** XP intake, level curve, catalog tier gating, level-up reward payout.
**Owns:** XP ledger, curve function (CONTENT §6.1), tier-unlock table, "New in Catalog" reveal queue.
**Events:** ▸ `xp:gained{amount,source}`, `level:up{level,rewards,unlockedTier}` ◂ `item:placed`, `quest:completed`, `secret:found`.
**Perf/edge:** XP sources centrally rate-sane; the idempotence ledger grants placement XP at most once per *unique* placement id (so hydration/move-return never double-count, and the ledger is GC'd to live ids each save — note ids recur across reloads as `IslandModel.nextId` recomputes from live placements, which the GC accounts for). A remove-then-place is a NEW id and legitimately re-grants: the resulting place→remove churn is an **accepted, unpoliced self-grind** (100%-refund consequence, see GDD §7.5), not a bug.
**Milestone:** v0.3. **DoD:** L1→L20 simulated script matches pacing targets ±20%; tier reveals fire once each, persist correctly.

## S15 🧠 Quest System (Postcards & Milestones)
**Purpose:** tutorial chain, rolling postcards (2 active), milestone counters; progress tracking via domain events only.
**Owns:** quest defs runtime (predicate DSL over events/stores: counts, adjacency checks, observe-quests), active/done state, reward payout, postcard queue/skip logic, paper-plane delivery scheduling.
**Interface:** predicates like `{type:'placeCategory', cat:'nature', n:5}` | `{type:'adjacency', a:'lantern', b:'bench', dist:2}` | `{type:'observe', event:'npc:satAt', filter:{kind:'fountain'}}` — data-driven, no per-quest code.
**Events:** ▸ `quest:offered/progress/completed{rewards}` ◂ broad domain subscription.
**Perf/edge:** adjacency predicates evaluate only on placement events near candidates (not global scans); tutorial steps gate on completion, never on modal locks (sandbox always allowed).
**Milestone:** v0.3 (tutorial + 20), pool grows per CONTENT §9. **DoD:** trigger-matrix tests green; skipping/backlog behavior per GDD §8.2; tutorial completable AND ignorable.

## S16 🧠 Islander (NPC) System
**Purpose:** move-ins, ambient vibe-AI, pathfinding, interactions (GDD §9.1).
**Owns:** roster state (model/name/home), population & visibility caps (12 out), behavior selector (weighted: wander / visit-recent-placement / sit / stall-browse / water-flowers / greet / go-home-at-night), A* on walkable grid (paths preferred ×0.5 cost), interaction-point registry from placed items (seats, stalls), re-home flow on home removal.
**Events:** ▸ `npc:arrived{who}` (move-in set piece), `npc:satAt{kind}`, `npc:waved`, `npc:clicked` ◂ `item:placed` (visit magnet + interaction points), `time:phaseChanged`, `cmd:clickNpc`.
**Depends on:** S8 occupancy (walkability = unoccupied or ground-overlay cells), S17 agents for playback.
**Perf/edge:** 1 path/tick budget, paths cached & repaired locally on occupancy change (agents politely walk around new placements — or hop-pop over a fence *once* with a surprised emote… backlog idea, not v1); zero-path fallback = idle at home porch. Behavior weights favor *recently placed* items (perceived intelligence, GDD risk table).
**Milestone:** v0.5. **DoD:** 12 wanderers at 60 fps; no stuck agent in 1-hour soak; move-in moment lands (door → walk out → wave).

## S17 🎨 Agent Animation Controller
**Purpose:** clip playback for Islanders/Pals: mixers, cross-fades, locomotion blending, emote one-shots, desync rules (ART §7.3).
**Owns:** per-agent `AnimationMixer` + action cache, `play(clip, {loop|once, fade})`, speed-synced walk playback, ±10% timescale jitter, facing/turn springs.
**Events:** ◂ requests from S16/S18 (`agent:playClip`) ▸ `agent:clipEnded` (behavior sequencing).
**Perf/edge:** mixers update only when on-screen-ish (island always is — but cap ensures cost); clip presence validated at pipeline time (TECH §7.2).
**Milestone:** v0.5. **DoD:** idle↔walk blend invisible; 18 mixers < 0.5 ms; no synchronized-step uncanny valley.

## S18 🧠 Pal (Pet) System
**Purpose:** adoption, wander/follow/nap behaviors, petting interaction with rewards (GDD §9.2).
**Owns:** pal roster, adoption-crate flow (crate placeable → pop-open set piece), behavior selector (wander/follow-islander/nap-at-favorite), pet-response (clip + hearts + rare Pop bonus w/ pity timer).
**Events:** ▸ `pal:adopted`, `pal:petted{bonus?}` ◂ `cmd:clickPal`, quest/milestone unlock grants.
**Milestone:** v0.5 (6 Pals), 12 by v0.6. **DoD:** petting feels instant (< 100 ms to clip+hearts); follow never blocks paths (pals yield).

## S19 🧠 Secrets & Discoveries
**Purpose:** per-chunk seeded secrets + island ambient events (GDD §10).
**Owns:** seeded roll on `chunk:unlocked` (deterministic per save seed + chunk coords), dig-spot 3-click state machine, chest jackpot table, rare-flora album hooks, schedulers for shooting stars (night), balloon flyby, cloud whale.
**Events:** ▸ `secret:spawned{kind,chunk}`, `secret:found{rewards}`, `event:shootingStar` … ◂ `chunk:unlocked`, `time:phaseChanged`, clicks.
**Perf/edge:** ambient schedulers are poisson-ish with caps (max 1 concurrent); everything click-race-safe; nothing expires unfound (dig spots wait forever).
**Milestone:** v0.4 (digs+chests), ambient events v0.5–0.6. **DoD:** distribution test over 1,000 simulated chunks matches table ±2%; first-chunk tutorial secret always spawns (forced roll).

## S20 🎨 Ambient Life (building anims & environment ticks)
**Purpose:** the Tier-3 constant-motion layer: windmill/watermill/waterwheel spins, banner sway, chimney smoke, ripen-bubble visuals, campfire flicker, lantern night glow, fireflies/leaves emitters per chunk theme.
**Owns:** ambient-behavior registry keyed by item def (`spin(node,axis,rpm)`, `sway`, `smoke(emitter)`, `glowAtNight`), applied on Tier-B spawn.
**Events:** ◂ `item:placed` (attach), `time:phaseChanged` (glow states), `income:ripe` (bubble).
**Perf/edge:** all ambient driven by a single time uniform / shared updater where possible; amplitude tiny per ART motion rule 5-Tier-3.
**Milestone:** v0.2 (windmill first!), grows with content. **DoD:** zoomed-out island visibly *alive* in a 10 s screen recording with zero player input.

## S21 🎨 UI System (HUD, panels, catalog, toasts)
**Purpose:** the DOM overlay per GDD §11.3 / ART §8: currencies, level ring, mailbox, catalog bar, item cards, purchase card, settings, Island Album, toasts/celebrations, world-anchored floaters.
**Owns:** component tree (plain TS + signals), panel router (one open panel), catalog browsing (tier tabs, affordability states live via signals), toast queue, world-anchor projector (TECH §10).
**Events:** ▸ `cmd:*` (all user intents) ◂ domain events + store signals.
**Perf/edge:** catalog renders 120 items as virtualized-ish list (simple: only active tier tab in DOM); anchors capped at 30 with priority (ripe > floaters > names).
**Milestone:** skeleton v0.2, full v0.3+, album v0.6. **DoD:** every interaction reachable by mouse-only; Esc always closes; reduced-motion & UI-scale settings honored; no layout shift on counter updates.

## S22 🎨 Audio System
**Purpose:** WebAudio graph: SFX registry (pitch-laddering, round-robin variants), music/ambience layers with zoom-responsive mix, ducking during set pieces (ART §9).
**Owns:** buffer cache, `sfx.play(id,{pitch,pos?})` (light stereo pan by screen x), bus gains (music/sfx/ambience) bound to settings, autoplay-policy unlock on first gesture.
**Events:** ◂ Juice presets & domain events; `camera:moved` (mix); `juice:setPieceStarted` (duck).
**Perf/edge:** all buffers decoded at load-phase; graceful no-audio mode if context denied.
**Milestone:** stub v0.2 (plops!), full pass v0.5. **DoD:** mute-everything toggle instant; no click/pop artifacts; 20 rapid placements sound pleasant (ladder + variation), not machine-gun.

## S23 🧰 Settings & Accessibility
**Purpose:** quality tier, volumes, day-night mode (cycle/golden-hour), reduced motion, UI scale, colorblind-safe cues, fps cap, key rebinds (v1.0 minimal: pan/rotate).
**Owns:** `SettingsStore` (persisted inside save), settings panel data, `prefers-reduced-motion`/`prefers-color-scheme` bootstrapping.
**Events:** ▸ `settings:*Changed` (consumed by S5/S7/S11/S22…).
**Milestone:** v0.2 minimal (quality+volumes), complete v0.6. **DoD:** every setting applies live, persists, and has a sane default.

## S24 🧰 Debug & Tuning Tools (dev-only)
**Purpose:** make tuning joyful: stats HUD, free-currency/level cheats, worst-case island builder, chunk-arrival replay, juice preset live-tuner (sliders for the ART §7.2 table), event log, quest fast-forward.
**Owns:** `?debug=1` gate, code-split bundle.
**Milestone:** grows every milestone from v0.1. **DoD:** a designer can retune pop-in and chunk-arrival without touching code.

---

## Cross-System Flows (the three moments that must be flawless)

### F1 · Placing an item (the 60×/session flow)
`UI cataloghover → S9 BuildSession → S6 cellHover → S8 canPlace → ghost (S10+S11 mint/coral) → click → S9 cmd:place → S13 charge → S8 occupy → item:placed → S10 spawn(TierA promote|TierB clone) → S11 popIn + S12 dust + S22 plop(pitch↑) → S14 xp → S15 progress → S3 autosave(debounced)`
**Latency budget: input→visible pop start ≤ 50 ms.**

### F2 · Chunk purchase (the set piece)
`survey click → UI purchase card → cmd:buyChunk → S13 charge(●+✦) → S8 addChunk+theme+S19 secret roll → chunk:unlocked → S11 chunkArrival choreography (S12 clouds/confetti, S22 fanfare+duck, soft input lock 0.8 s) → S5 shadow refit → S6 frameIsland ease → S8 new surveys → S15/S14 progress → autosave`
**The single most-polished 2.2 seconds in the product.**

### F3 · Returning player (cold load)
`boot assets (S4) → S3 load+migrate → stores hydrate → S10 bulk rebuild (no anims) → S13 offline accrual vs caps → ripe bubbles bloom in staggered cascade (S11 — the island greets you) → pending postcards flutter in → play`
**Target: click-to-island < 4 s desktop; the greeting cascade makes loading feel like a hello, not a spreadsheet.**

## Build Order & Dependency Spine (mirrors ROADMAP)
`S1→S2→S5→S6→S7(static) [v0.1] → S4+S8+S9+S10+S11(engine)+S3+S21(skeleton)+S22(stub)+S12(basic)+S20(first) [v0.2] → S13+S14+S15+S21(full) [v0.3] → S8(expansion)+S11(set piece)+S19 [v0.4] → S16+S17+S18+S7(cycle)+S22(full) [v0.5] → S23+S24 continuous, themes/album/photo [v0.6] → polish [v0.7→1.0]`
