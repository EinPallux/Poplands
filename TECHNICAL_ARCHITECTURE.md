# Poplands — Technical Architecture

> Browser-first, zero-backend, performance-by-design. Boring technology, exciting game.

| | |
|---|---|
| **Document** | Technical Architecture — engineering source of truth |
| **Status** | Planning |
| **Version** | 0.1.0-plan |
| **Last updated** | 2026-07-10 |
| **Related docs** | [SYSTEMS_BREAKDOWN](SYSTEMS_BREAKDOWN.md) (per-system detail) · [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) · [ROADMAP](ROADMAP.md) |

---

## 1. Stack & Guiding Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | **TypeScript, strict** (`strict: true`, no `any` escape hatches without justification comment) | correctness at scale, refactor safety |
| 3D | **three.js** (current release line; pinned exact version, upgraded deliberately per milestone) | mature, tree-shakeable, GLTF ecosystem |
| Build tool | **Vite** | instant dev loop, first-class TS, static output |
| UI | **DOM overlay (HTML/CSS) + tiny in-house signals lib** — *no React/Vue* | crisp text & a11y for free; one mental model; avoids double-framework tax on a small UI surface |
| Animation/tweening | **in-house tween + spring module** (~250 LOC, see SYSTEMS_BREAKDOWN S11) | juice is core IP; needs loop integration, batching, zero dep-bloat |
| State | **plain TS stores + typed event bus** — *no ECS, no Redux* | a decorating game is CRUD on a grid, not a battle sim; systems stay independently testable |
| Audio | **WebAudio wrapper** (in-house, sprite-capable) | tiny needs, no Howler dependency |
| Persistence | **localStorage** (JSON, versioned, migratable) + file/clipboard export | zero backend (design pillar); IndexedDB only if saves outgrow ~2 MB |
| Tests | **Vitest** (core logic), Playwright smoke test post-v0.3 | grid math / economy / migrations are the bug farms |
| Lint/format | ESLint (typescript-eslint) + Prettier, default-ish configs | consistency without bikeshedding |
| Package manager | npm (lockfile committed) | ubiquity, CI simplicity |
| Deploy | static bundle → GitHub Pages (Actions) and/or itch.io zip | free, cache-friendly |
| Backend | **none** for v1.0 | GDD anti-goal; save export covers device moves |

**Dependency policy:** runtime deps ≈ `three` only (+ `three/examples` loaders). Dev deps may include `@gltf-transform/*` for the asset pipeline. Every new runtime dependency needs a written justification in PR description.

## 2. Repository Layout

```
/                        # planning docs (this set), configs
├─ index.html
├─ public/
│  └─ assets/            # SHIPPED, optimized assets only (output of pipeline)
│     ├─ models/…        # curated+compressed GLBs, by category
│     ├─ textures/…      # particle atlas, decals
│     ├─ audio/…
│     └─ fonts/
├─ assets/               # RAW source packs (never shipped, never imported at runtime)
├─ scripts/
│  ├─ prepare-assets.mts # manifest-driven copy+optimize (gltf-transform)
│  └─ bake-prefabs.mts   # compose authored prefabs → single GLBs
├─ src/
│  ├─ main.ts            # entry: bootstraps App
│  ├─ app/               # App shell, game loop, scheduler, mode stack (Play/Build/Photo)
│  ├─ core/              # zero-three.js utilities: events, signals, tween/spring,
│  │                     # save, rng, grid math, object pool, asserts
│  ├─ render/            # renderer setup, camera rig, lights, sky, quality tiers, postFX
│  ├─ world/             # island model, chunks, skirt gen, ground, prop scene management
│  ├─ build/             # placement controller, ghost, validation, catalog runtime
│  ├─ sim/               # economy, progression, quests, npc, pets, secrets, ambient, daynight
│  ├─ content/           # DATA ONLY: catalog defs, postcards, islanders, pals, tuning tables
│  ├─ ui/                # DOM overlay: hud, panels, toasts; binds via signals + event bus
│  ├─ audio/             # WebAudio system, sfx registry, music/ambience layers
│  ├─ vfx/               # particles, decals, coin arcs, celebration compositions
│  └─ debug/             # stats overlay, inspector, cheat console (dev builds only)
└─ tests/                # vitest specs mirroring src/
```

**Layering rule (enforced by ESLint import boundaries):**
`core` imports nothing internal → `content` imports `core` types only → `sim`/`world` import `core`+`content` → `render`/`vfx`/`audio`/`build` may import all above → `ui` talks to game **only** via bus/stores → `app` wires everything. three.js types never leak into `core`, `content`, or `sim` (keeps game logic headless-testable).

## 3. Runtime Architecture

```
                 ┌────────────────────────────────────────────┐
                 │ App (bootstrap, mode stack, loop)          │
                 └──────┬─────────────────────────┬───────────┘
      fixed-step sim    │                         │ per-frame
   ┌────────────────────▼───────┐     ┌───────────▼────────────────┐
   │ Simulation (headless)      │     │ Presentation               │
   │ economy · quests · npc     │     │ render mgr · camera rig    │
   │ pets · secrets · daynight  │     │ world scene · vfx · audio  │
   │ progression                │     │ juice/tween · ui overlay   │
   └────────────┬───────────────┘     └───────────▲────────────────┘
                │        typed EventBus + stores  │
                └─────────────────►───────────────┘
                     (sim emits; presentation reacts)
```

- **Event-driven seam:** simulation emits domain events (`item:placed`, `income:collected`, `chunk:unlocked`, `npc:arrived`, `quest:completed`…); presentation (world meshes, VFX, audio, UI) subscribes. Presentation never mutates sim state directly — it dispatches **commands** (`cmd:place`, `cmd:collect`…). One-way data flow, replay-friendly, testable.
- **Game loop:** single rAF. Per frame: `input → mode update → sim accumulator (fixed 10 Hz for economy/AI decisions) → continuous updates (agents' movement, tweens, particles, camera) with clamped dt (≤ 50 ms) → render`. `document.visibilitychange` pauses rAF; on resume, elapsed wall time is fed to the offline-earnings path (no giant dt through physics of any kind).
- **Mode stack:** `PlayMode` (default) / `BuildMode` (ghost active) / `PhotoMode`. Modes own input interpretation; push/pop keeps Esc semantics trivial.
- **Determinism where it matters:** all *content* randomness (secrets rolls, starter props, name draws) uses seeded RNG (`mulberry32`) with per-save seed + stable stream ids. Cosmetic randomness (particles, anim offsets) uses unseeded RNG freely.

## 4. Data Model (save = source of truth)

```ts
// core/save/schema.ts (illustrative)
interface SaveV1 {
  v: 1;
  createdAt: number; lastSeenAt: number; seed: number;
  player: { pops: number; stardust: number; xp: number; level: number };
  island: {
    chunks: Array<{ id: ChunkId; cx: number; cz: number;        // chunk lattice coords
                    theme: 'meadow'|'sandbar'|'spooky'|'snowcap';
                    secret?: { kind: SecretKind; state: 'hidden'|'found' } }>;
    placements: Array<{ id: PlacementId; def: ItemDefId;
                        cx: number; cz: number; bx: number; bz: number; // chunk + block
                        rot: 0|1|2|3;
                        state?: { storedPops?: number; lastCollectAt?: number } }>;
  };
  life: { islanders: Array<{ id; model; name; homeId }>;
          pals: Array<{ id; species; name }> };
  quests: { tutorialStep: number; active: PostcardId[]; done: PostcardId[];
            counters: Record<MilestoneId, number> };
  settings: { volumes; quality; reducedMotion; dayNight; … };
}
```

- **Placements are the world.** Meshes are a *projection* of this array — rebuildable at any time (load, undo-ish operations, quality switch). No mesh is ever authoritative.
- **Save discipline:** autosave debounced 5 s after any mutating command + on `visibilitychange`/`pagehide`. Rolling 3-slot backup (`save`, `save.bak1`, `save.bak2`) guards against corrupt writes. Versioned migrations (`migrateV1toV2…`) with Vitest fixtures per version. Export/import = same JSON, base64-wrapped, via clipboard or `.poplands` file download.
- **Content definitions** (`content/`) are code-shipped data keyed by stable string ids (`itemDef:'flower.wild.red'`). Saves reference ids only — content can rebalance freely without migration; *removing* an id requires a migration mapping (policy documented in CLAUDE.md).

## 5. Coordinates & Grid Math (canonical)

- World: three.js right-handed, **Y-up**; ground plane at `y = 0`; 1 block = 1 world unit.
- Chunk lattice: integer `(cx, cz)`; chunk origin at its **min corner**; world position of block `(bx, bz)` in chunk = `(cx*8 + bx + 0.5, 0, cz*8 + bz + 0.5)` (blocks addressed by min corner, meshes centered).
- Island occupancy: `Map<packed cx,cz → Chunk>`, each chunk holds a 64-cell occupancy array of `PlacementId | null` (+ layer flags: ground-overlay vs prop — a path and a bench can share a cell).
- Footprint placement validates all covered cells across chunk borders (multi-chunk footprints allowed and expected).
- Rotation `rot ∈ {0..3}` rotates footprint W×D → D×W for odd rotations. All this lives in `core/grid.ts` as **pure functions — the most unit-tested file in the repo**.

## 6. Rendering Architecture

### 6.1 Scene composition
```
Scene
├─ SkyRig (dome shader, sun+glow sprite, cloud sea planes, stars)     [static-ish]
├─ AtmosphereProps (puffball clouds, distant islets, birds)           [drifting]
├─ Island
│  ├─ per-chunk GroundMesh (merged blocks + skirt, 1–2 draws/chunk)
│  ├─ StaticProps (InstancedMesh pools, per item-type)                [Tier A]
│  ├─ UniqueProps (buildings w/ animated parts, ≤ ~80 live)           [Tier B]
│  └─ Agents (Islanders/Pals, skinned/keyframed, ≤ ~18 live)          [Tier C]
├─ FX (particles ×2 pooled systems, decals, coin arcs)
└─ Lights (1 directional + 1 hemisphere; ≤3 transient points at night)
```

### 6.2 The three render tiers (the core perf strategy)
- **Tier A — instanced statics.** High-count small placeables (flowers, fences, rocks, paths, bushes…) render via `InstancedMesh` pools per item-def (pre-sized, grow-by-double). Place/remove = write matrix + bump instance count with free-list. **Placement pop animation on an instance:** the item is temporarily promoted to a real Object3D for its 300 ms pop-in, then baked into the pool (promote-animate-demote pattern; also used for move-tool lifts).
- **Tier B — unique props.** Buildings and anything with ambient animation (windmill blades, banners, chimney smoke emitters, ripen bubbles). Cloned from cached GLTF scenes with `SkeletonUtils.clone`; sub-node animations driven by the Juice/ambient systems. Static Tier B meshes set `matrixAutoUpdate = false`.
- **Tier C — agents.** Skinned characters + node-animated pets, one `AnimationMixer` each, clip actions cross-faded (0.2 s). Hard cap (12 Islanders + 6 Pals visible) is a *design* number sized to keep skinning + mixer cost trivial.

### 6.3 Materials & textures
Kenney packs share tiny palette textures → aggressive material reuse: a **MaterialCache** dedupes by (map, flags), targeting **< 25 unique materials** live. `MeshStandardMaterial` as authored (metalness 0, roughness ~0.9); no per-item material tweaks — recolors happen via cloned materials from the cache only. Ghost previews use 2 dedicated shared materials (valid/invalid). Palette + particle atlas + UI = **< 20 MB GPU texture memory** total.

### 6.4 Shadows & lights
One directional caster, shadow camera ortho box refitted to island AABB on chunk changes (not per-frame), map 2048² High / 1024² Med / off Low (hemi-only + blob decals still ground everything). Agents get blob-shadow decals always (cheap contact). Night "lights" are emissive+bloom fakes per ART_DIRECTION §4.

### 6.5 Frame budget (Med tier, 36-chunk endgame island, 1080p)
| Bucket | Budget |
|---|---|
| Draw calls | ≤ 400 (ground ~70, Tier A ~60 pools, Tier B ~200, agents+fx+sky ~70) |
| Triangles | ≤ 1.2 M |
| JS main thread | ≤ 6 ms sim+juice, ≤ 4 ms three.js overhead |
| GPU | ≤ 8 ms |
| Texture mem | ≤ 120 MB |
Enforced by the debug overlay's live counters + a scripted "worst-case island" scene checked at every milestone (ROADMAP exit criteria).

### 6.6 Quality tiers
`high | medium | low`, auto-probed on first launch (device pixel ratio, a 2 s fps sample) and user-overridable. Tiers gate: pixel ratio (2 / 1.5 / 1), shadow map size, bloom on/off, cloud count, particle density, DoF availability. One `QualityConfig` object consumed everywhere — no scattered `if (isLow)`.

## 7. Asset Pipeline

### 7.1 Principles
Raw packs (~300 MB, 2,100 files) stay in `/assets` as the library; **the game ships only what the catalog references** (~15–25 MB before compression). No runtime file discovery — everything flows from a manifest.

### 7.2 Flow
```
content/catalog.ts ──references──► asset ids
scripts/prepare-assets.mts:
  reads manifest (id → source path in /assets)
  → gltf-transform: dedup, prune, weld, quantize, meshopt compress
  → writes public/assets/models/<category>/<id>.glb + manifest.json (+ hashes)
scripts/bake-prefabs.mts:
  reads prefab recipes (piece ids + transforms) → composes → same output path
Runtime AssetRegistry:
  loads manifest.json → GLTFLoader (+MeshoptDecoder)
  → caches parsed scenes/clips → hands out clones/geometries to render tiers
```
- **Load phases:** `boot` (sky, ground blocks, tier-1 items, UI/fonts — target < 3 MB critical) → `early` (tiers 2–6, characters) in background → `themed` tiers lazy-load on tier unlock. Loading screen only for `boot`; later loads are invisible (predictive prefetch on level-up approach).
- Animation clips are extracted once per model into an `AnimRegistry` keyed `modelId/clipName` (`idle`, `walk`, `sit`, `gesture-positive`…), validated at pipeline time (build fails if a required clip is missing — catches pack surprises early).
- Textures: KTX2/basis considered post-v0.6 only if texture memory becomes real pressure (palette textures are tiny; unlikely).

### 7.3 Licensing gate
`prepare-assets` refuses to include any pack not marked license-verified in `ATTRIBUTIONS.md` (see CONTENT_PLAN §1.1) — mechanical enforcement of the legal checklist.

## 8. Performance Engineering (beyond rendering)

- **Zero steady-state allocation:** object pools for particles, vectors, events (pooled payload objects for high-frequency events); no per-frame closures in hot paths; profiling ritual per milestone (Chrome perf + `debug/` overlay: draws, tris, heap delta, fps 1% lows).
- **Sim is cheap by construction:** 10 Hz decision tick for ≤ 18 agents + ≤ 60 income buildings is microseconds; pathfinding is A* on ≤ 2,304 walkable cells with early-out and per-tick budget (1 path/tick max, results cached — agents stroll, they don't swarm).
- **Startup:** Vite code-splits `debug/`, `PhotoMode`, and themed content data; three.js tree-shaken via ES imports; target TTI < 4 s on desktop broadband, < 8 s on slow wifi.
- **Memory:** dispose discipline centralized in AssetRegistry & pools (`.dispose()` sweeps on quality change); no leaked geometries on remove (Tier A never disposes — pools shrink lazily).
- **Battery/politeness:** rAF pauses when hidden; optional 30 fps cap setting; no busy-wait anywhere.

## 9. Input, Picking & Camera (implementation notes)

- **Pointer events** unified (mouse/touch/pen ready), small gesture recognizer distinguishes click vs drag (5 px / 150 ms threshold).
- **Picking:** raycast against an invisible ground plane for grid cells (O(1) math, no octree needed) + `Raycaster` against interactive sets only (Tier B/C + secrets), throttled to pointer-move frames; Tier A instanced picking via `instanceId` for hover-lift.
- **Camera rig:** own module (no OrbitControls dependency) — azimuth/polar/distance/target with critically-damped springs, clamps per GDD §11, focus-glide tweens, and a `frameIsland()` helper that eases distance as the island AABB grows. Camera is read-only input to rendering; nothing else may move it (juice never shakes the camera — ART_DIRECTION rule).

## 10. UI Overlay Architecture

- Single `#ui` root over the canvas; pointer events pass through except on interactive elements (`pointer-events: none` root, `auto` leaves).
- **Signals:** ~80-LOC reactive primitive (`signal/computed/effect`) — stores expose signals (`popsSignal`, `activePostcards`…); DOM components are plain TS classes/functions binding via effects. No virtual DOM; updates are surgical (a counter text node, a meter width).
- **World-anchored UI** (ripen bubbles, name tags, "+15 ●" floaters): a `WorldAnchors` layer projects 3D positions → CSS transforms each frame for ≤ 30 anchors; occlusion-fade by depth check against island AABB (cheap heuristic, not per-pixel).
- UI motion uses the same tween module (it accepts any setter — DOM or three.js), keeping one motion language (ART_DIRECTION §8).
- Accessibility: DOM = semantic buttons/labels for free screen-reader baseline; focus states; `prefers-reduced-motion` respected and mirrored in settings.

## 11. Error Handling, Debug & Telemetry

- **No silent catch.** Central `panic(err)` overlay in dev; in prod, an apologetic toast + auto-export of the last good save backup.
- WebGL context-loss handler: pause, show "un-fogging the sky…" card, restore + rebuild from save (placements-as-truth makes this nearly free).
- `debug/` (dev builds + `?debug=1`): stats HUD, free money buttons, level setter, "build worst-case island", chunk-arrival replay button (tuning the set piece will be a hobby), event log tail.
- **Telemetry: none.** No analytics, no network calls at runtime (privacy is cozy too). Playtesting feedback is collected the old way — watching people play.

## 12. Testing Strategy

| Layer | Tool | What |
|---|---|---|
| `core/grid` | Vitest | footprints, rotation, cross-chunk validation, packing — exhaustive |
| `core/save` | Vitest | round-trip, migration fixtures v1→vN, corrupt-input recovery |
| `sim/economy` | Vitest | accrual math incl. offline & caps, pricing curves, refunds |
| `sim/quests` | Vitest | trigger matrix (event → progress), reward payout |
| `core/tween` | Vitest | easing/spring numerics, completion callbacks |
| Smoke | Playwright (post-v0.3) | boot → place → collect → save → reload → assert island state |
Sim being three.js-free (layering rule §2) is what makes this cheap. Target: core+sim ≥ 80% line coverage by v0.5; rendering is verified visually per milestone instead.

## 13. Build, CI & Deploy

- `npm run dev` (Vite), `check` (tsc+eslint), `test`, `assets` (pipeline), `build` (assets → vite build → size report).
- GitHub Actions on PR: check + test + build with bundle-size budget gate (fail > 10% regression). On tag: deploy Pages (immutable hashed assets, correct base path) + zip artifact for itch.io.
- Version scheme mirrors ROADMAP milestones (`0.x.y`), shown bottom-left of the settings panel.

## 14. Key Technical Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Instance-pool animation complexity (Tier A pop-ins) | promote-animate-demote pattern isolated behind `PropRenderer` interface; worst case fallback = Tier A items become Tier B (measured, not feared) |
| Pack scale/pivot inconsistencies (17 packs, mixed exporters) | per-item import transform in catalog def + pipeline-time bounding-box lint (build fails if item's footprint wildly mismatches its AABB) |
| Save corruption / schema drift | 3-slot rolling backups, versioned migrations with fixtures, export/import escape hatch |
| Draw-call creep as content grows | per-milestone worst-case-island budget check (§6.5) is a hard exit criterion, not a hope |
| three.js version churn | exact pin; upgrades are dedicated PRs with visual-diff pass |
| Browser variance (Safari!) | test matrix per milestone: Chrome/Firefox/Safari/Edge on the playtest checklist; WebGL2-only simplifies (Safari ≥ 15.4 covered) |
