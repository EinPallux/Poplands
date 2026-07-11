# Poplands — Game Design Document

> *Grow a cozy island in the sky, one pop at a time.*

| | |
|---|---|
| **Document** | Game Design Document (GDD) — design source of truth |
| **Status** | Planning — approved scope for v1.0 |
| **Version** | 0.1.0-plan |
| **Last updated** | 2026-07-10 |
| **Related docs** | [ROADMAP](ROADMAP.md) · [TECHNICAL_ARCHITECTURE](TECHNICAL_ARCHITECTURE.md) · [SYSTEMS_BREAKDOWN](SYSTEMS_BREAKDOWN.md) · [ART_DIRECTION](ART_DIRECTION.md) · [CONTENT_PLAN](CONTENT_PLAN.md) |

---

## 1. High Concept

**Poplands** is a single-player, browser-first, 3D low-poly cozy building game. You tend a small floating island drifting through an endless warm sky. You place buildings, plants, and decorations on a block grid, earn **Pops** (the island's currency) from the things you build, complete gentle quests, and spend your earnings to unlock new **Chunks** of land — watching your island physically *grow* outward, piece by piece, until it becomes a sprawling, living diorama full of Islanders, pets, windmills, and secrets.

There is no failure, no timer pressure, no combat, and no grind wall. The game's identity is **the pop**: every meaningful interaction lands with a springy, satisfying animation. Placing a mushroom pops. Collecting coins pops. A newly purchased chunk *rises out of the cloud sea and docks against your island with a bounce*. If it feels good to touch, players will keep touching it.

- **Genre:** Cozy island builder / idle-lite decoration sandbox
- **Platform:** Modern desktop browsers first (Chrome/Firefox/Safari/Edge, WebGL2); touch-friendly later
- **Session shape:** 5–40 minute relaxed sessions; meaningful progress in any of them
- **Player fantasy:** *"This little world is mine. I made it, it's alive, and it's adorable."*
- **Audience:** Fans of Townscaper, Tiny Glade, Animal Crossing, Islanders, Fae Farm decoration mode — players who build for joy, not optimization
- **Business model:** Free web game. No monetization systems planned; "premium currency" (Stardust) is earned in-game only.

## 2. Design Pillars

Every feature must serve at least one pillar. When two features compete, the higher pillar wins.

1. **Cozy above all.** No fail states, no punishments, no FOMO timers, no energy systems. Removing a building refunds 100%. The player can never make an irreversible mistake. The island always looks pleasant, even neglected.
2. **Juice *is* the game feel.** Every interaction has a hand-tuned animation, particle, and sound. The "pop" placement animation and the chunk-arrival set piece are brand moments — they get disproportionate polish budget. (See [ART_DIRECTION §7](ART_DIRECTION.md) for the animation language.)
3. **A living diorama.** The island is a real 3D place, always fully visible, always moving: windmills turn, banners sway, clouds drift below, Islanders wander and sit and wave. The player is a gardener-god looking down into a snow-globe world.
4. **Steady little goals.** There is always something small and pleasant to do next: a quest one click away, a building almost affordable, a chunk survey balloon hovering at the island's edge. Progression is generous and front-loaded; depth comes from breadth of content, not steepness of curve.
5. **Runs beautifully everywhere.** 60 fps on a mid-range laptop is a feature. Performance decisions are made at design time (block grid, instancing-friendly content, capped agent counts), not patched in later.

### Anti-goals (what Poplands is deliberately NOT)
- Not a survival/resource-management game — no hunger, no durability, no storage tetris.
- Not an idle/clicker optimizer — numbers stay small and readable; no prestige resets.
- Not a UI-only management sim — every system manifests physically in the 3D world.
- Not multiplayer, not account-based — no backend at all for v1.0 (see [TECHNICAL_ARCHITECTURE §2](TECHNICAL_ARCHITECTURE.md)).

## 3. The World & Fiction (light-touch lore)

Your island floats in **The Drift** — an endless, sunlit sky above a sea of soft clouds. Long ago, islands like yours dotted the whole sky; over time they sank into the cloud sea. When you (the unseen caretaker) plant life and build homes, dormant land beneath the clouds *wakes up* and rises to join you — that's the fiction behind purchasing chunks: you aren't buying land, you're **calling it back**.

- **Pops (●)** are warm golden droplets of "island joy" — the currency shed by happy buildings and Islanders.
- **Stardust (✦)** falls from the night sky and collects in rare places — the rarer currency that calls new chunks.
- **Islanders** are round little folk who move in when homes are built. They don't speak in text walls; they emote, wave, and leave postcards (quests).
- **Pals** are the island's animals — pettable, collectible, useless in the best way.

Tone: wholesome, a little whimsical, never saccharine. Lore is delivered ambiently (quest flavor lines, secret descriptions), never in cutscenes.

### In-game vocabulary (canonical terms — use everywhere: UI, code, docs)

| Term | Meaning |
|---|---|
| **Block** | 1×1 grid cell, the atomic unit of placement (~1 m) |
| **Chunk** | An 8×8-block plot of island land; the unit of expansion |
| **Survey** | A candidate chunk slot offered at the island edge (marked by a balloon) |
| **Pops ●** | Primary currency |
| **Stardust ✦** | Rare currency (chunks, special items) |
| **Islander** | Villager NPC |
| **Pal** | Pet/animal NPC |
| **Postcard** | A small optional quest sent by an Islander |
| **Catalog** | The build menu of all placeable items |
| **Placeable** | Any item placed on the grid (prop, building, ground overlay) |

## 4. Core Gameplay Loop

```
        ┌────────────────────────────────────────────────┐
        │                                                │
        ▼                                                │
   BUILD & DECORATE ──► island becomes prettier & more alive
        │                                                ▲
        │ income buildings produce Pops over time        │
        ▼                                                │
   COLLECT POPS  ◄── quests/postcards & secrets also pay │
        │                                                │
        ▼                                                │
   SPEND: new placeables ── or save up for ──► UNLOCK CHUNK
        │                                                ▲
        ▼                                                │
   EARN XP → LEVEL UP → new catalog tiers ───────────────┘
```

**Minute-to-minute:** hover the island, collect ripe Pops from buildings (satisfying coin-arc), place a few new items, check a postcard, pet a Pal, nudge the camera and just watch.

**Session-to-session:** finish a postcard chain, hit the next level, unlock a catalog tier, buy the next chunk and watch it arrive, discover its secret, plan the next district.

**Long arc (v1.0):** grow from 4 starter chunks to a ~30+ chunk island across 6 themed content tiers (Meadow → Farm → Village → Harbor → Spooky Grove → Snowcap → Castle → Wonders), fill the Island Album collections, adopt every Pal, and reach Level 20's final Wonder building.

### The first 10 minutes (onboarding contract)
The first session must deliver the whole loop in miniature, on the pre-built 2×2-chunk starter island:

1. **0:00** — Loading screen (< 4 s) → camera swoops down through clouds to the island (skippable). No menus first; the game IS the menu.
2. **0:30** — First postcard: *"Plant 3 flowers anywhere."* Teaches build mode + the pop animation. Reward pays for more.
3. **2:00** — Place the **Flower Stall** (first income building). It immediately blooms coins; player collects → coin-arc to HUD. Loop revealed.
4. **4:00** — Postcard chain leads to building the **Cozy Hut** → first **Islander moves in** (walks out the front door, waves). Island is now alive.
5. **7:00** — A **survey balloon** appears off the island edge. The chain grants enough ✦ + ● to afford the first new chunk.
6. **8:30** — **Chunk arrival set piece** (the game's money shot). The new chunk has a visible **dig sparkle** on it → first secret → Stardust reward.
7. **10:00** — Player has: built, collected, leveled to 2, expanded, discovered. All future play is "more of this, wider."

## 5. The Grid, Chunks & Expansion

### 5.1 Spatial model
- The world is a horizontal grid of **blocks** (1 block = 1 world unit ≈ 1 m). The island's top surface is flat in v1.0 (elevation/terraces are a post-1.0 stretch goal, see ROADMAP).
- A **chunk** is **8×8 blocks**. Chunks attach edge-to-edge on a global chunk lattice, so the island is a connected set of chunk cells that can grow into organic, non-rectangular shapes.
- The **starter island** is 2×2 chunks (16×16 blocks), pre-decorated lightly so it photographs well from second zero; the tutorial encourages editing it immediately (everything is movable).
- v1.0 soft cap: **36 chunks** (comfortably within performance budget; see TECHNICAL_ARCHITECTURE §8). The cap is invisible — chunk prices and the content arc naturally land there.

### 5.2 Why 8×8 (design rationale)
- Large enough that one chunk fits a meaningful vignette (a 3×4 house + path + garden).
- Small enough that a new chunk is affordable often (every 20–40 min early on) — expansion *is* the heartbeat of progression.
- 64 blocks × 36 chunks = 2,304 buildable blocks at endgame — big island feel, bounded perf.

### 5.3 Expansion flow ("calling land back")
1. At any time, up to **3 Surveys** (candidate chunk slots) are offered on free edges of the island, marked by dashed outlines and a small hovering **survey balloon**. Offers refresh when one is purchased; the player can re-roll positions for a token Pop fee (never a timer).
2. Clicking a Survey opens the purchase card: price (● + ✦), theme preview, and — if it's a **themed chunk** — its biome (see §5.4).
3. On purchase: **chunk-arrival set piece** — clouds swirl beneath the slot, the chunk rises from the cloud sea with its rocky underside skirt, overshoots, settles with a spring-bounce; a grass ripple runs across neighboring chunks; confetti; short fanfare. Duration ~2.2 s, skippable, never blocks input afterward.
4. New chunks may carry a **secret** (dig sparkle, buried chest, rare flora — rolled from a seeded table, see §10) and 2–4 charming starter props (a rock, a tuft of grass) the player can keep or remove.

### 5.4 Chunk themes (biomes)
Standard chunks are **Meadow** (grass). From mid-game, some Surveys offer themed chunks at +25% price, with unique ground look, skirt style, ambient props, and theme-exclusive secrets:

| Theme | Unlocks at | Ground / mood | Content synergy (see CONTENT_PLAN) |
|---|---|---|---|
| **Meadow** | start | lush grass, daisies | everything |
| **Sandbar** | Level 9 (Harbor tier) | warm sand, shells | docks, palms, boats moored at edge |
| **Spooky Grove** | Level 11 | dark teal grass, fallen leaves | pumpkins, lanterns, fall pines, friendly ghost |
| **Snowcap** | Level 13 | snow, ice sparkle | snow pines, igloo props, cocoa stand |

Themes are cosmetic + content-flavor only — no mechanical restrictions (any item can be placed on any chunk; themed items simply *look best* at home).

## 6. Building & Placement

### 6.1 Placeables
Every placeable is data-defined (see SYSTEMS_BREAKDOWN §9) with:
- **Footprint** — W×D in blocks (e.g., flower 1×1, bench 1×2, Cozy Hut 3×3, House 3×4, Windmill 3×3, Town Center 5×5). Footprints are always full blocks; no half-block placement in v1.0.
- **Category** — Nature · Decoration · Home · Income · Ground · Special (drives catalog tabs and quest triggers).
- **Rotation** — 4 steps (0/90/180/270°).
- **Cost & refund** — Pops (some special items: Stardust). Refund is always 100% (pillar 1).
- **Behavior hooks** — income rate, home capacity, ambient animation (windmill spin, chimney smoke), walkability (paths), seat/interaction points for Islanders.

### 6.2 Build mode flow
- Open Catalog (bottom bar) → pick item → **ghost preview** follows the cursor snapped to the grid: mint-green + soft ring when valid, coral-red when blocked (occupied, off-island, or insufficient funds — the price tag shakes).
- **R** / scroll-click rotates. Click places: cost deducted, **pop-in animation** (scale overshoot + dust poof + soft "plop"), XP floats up. Placement stays in build mode for chaining (shift-click in v1 = same; explicit "stay in mode" behavior).
- **Move tool** — pick up any placed item (it lifts and gently bobs on the cursor), replace anywhere; free.
- **Remove tool** — pop-out animation (squash → poof), 100% refund coin-arc. Buildings housing Islanders show a gentle confirm ("Mo will move to another home").
- **Ground overlays** (paths, later rivers) are 1×1 placeables painted in drag-strokes; they underlay other placeables and are walk-preferred by Islanders.

### 6.3 Placement feel checklist (definition of "juicy enough")
- Ghost eases toward the cursor (never teleports); rotation is a 90° spring, not a snap.
- Pop-in: ~280 ms, back-out overshoot to 112%, dust ring, 1–3 grass blades flutter.
- Invalid placement attempt: ghost shakes 2×, soft "uh-uh" thock — communicates without punishing.
- Placing the *same* item repeatedly subtly pitch-shifts the plop sound upward (combo feel), resetting after 2 s.

## 7. Economy & Progression

Design intent: **generous, legible, un-grindy.** Numbers stay small (a flower costs 15 ●, not 15,000). The full tuning tables live in [CONTENT_PLAN §6](CONTENT_PLAN.md); this section defines the *rules*.

### 7.1 Currencies
| | Pops ● | Stardust ✦ |
|---|---|---|
| **Role** | everyday spending | expansion & specials |
| **Earned from** | income buildings, postcards, secrets, petting bonuses, level-ups | postcard chains, secrets, level-ups, collections, night shooting stars |
| **Spent on** | most placeables | chunks (primary sink), premium decor, some Pal adoptions |
| **Feel** | flows constantly | small treasured amounts (single digits) |

### 7.2 Income buildings
- Each produces Pops in real time into an internal store, **capped** (~30 minutes of production for early buildings, stretching toward ~50 for grand late-game ones — bigger banks greet returning players) — shown as a ripening bubble over the building (small ● … full golden ●!). Click to collect → coin-arc.
- Caps mean the game never demands check-ins: whatever accrued while away (computed from timestamps, capped) is there to collect — **offline earnings included, no penalty, no decay**.
- A gentle **liveliness bonus**: +2% income per Islander (cap +20%) and +1% per Pal — makes population feel valuable without being a system to optimize.
- Collection is deliberately manual (it's a joyful interaction, pillar 2), but a late-game placeable (**Pop Post**, Level 16) auto-collects nearby buildings for players who've earned convenience.

### 7.3 XP & Levels
- XP sources: placing items (≈ cost/10), completing postcards (fixed), discoveries, collections.
- **Level curve:** `XP_to_next(L) = round₁₀(60 × L^1.55)` — Levels 1→20 for v1.0. Early levels minutes apart, late levels a relaxed session apart.
- Each level: celebration burst + rewards (● + ✦) + **new catalog tier** content reveal ("New in Catalog!" showcase with 3D turntable of the new items).

### 7.4 Chunk pricing
- Let *k* = the k-th chunk *purchased* (starter four are free). `Pops(k) = 250 × 1.32^(k-1)` for the first 8 purchases, then easing to `× 1.13` per chunk thereafter (fast early ramp for meaningful purchases; gentle late growth so the final chunk lands ≈ 33,000 ● — five digits max, per §11.3's "numbers stay human"). `Stardust(k) = 2 + ⌊k/4⌋` (single digits until the very end). Themed chunks +25%. All values friendly-rounded; full ladder in CONTENT_PLAN §6.2.
- Tuning target: first purchase ~8 min in; steady mid-game cadence of one chunk per 20–40 relaxed minutes; late chunks are savings goals but never day-gates.

### 7.5 The no-grind covenant (hard design rules)
- Nothing is time-locked behind more than ~1 session of relaxed play.
- No daily-reset mechanics; postcards queue and wait forever.
- Prices never require selling/undoing previous work (refunds are 100% anyway).
- If playtesting finds any moment where the player has *nothing* affordable and *nothing* to do — that's a balancing bug, fix the curve.

**Accepted self-grind (place→remove churn).** Because refunds are 100% (pillar 1) and placement XP + milestone counters are never revoked, a player *can* spam place→remove of one building to grind XP → levels → Stardust at zero net Pops cost. This is an accepted consequence of the covenant, not a bug: it is self-inflicted, tedious (nobody enjoys 300 clicks), affects no one else (single-player, no leaderboards, no FOMO), and is left **unpoliced** — the cozy-genre norm (Stardew/Animal Crossing don't police self-grind either). It was surfaced and deliberately accepted in the v0.3 review (2026-07-11). Revisit *only* if the v0.4+ Stardust **sink** (chunk pricing) shows in playtests that the shortcut actually distorts expansion pacing — the available fixes (net-growth XP / net counters) trade against the satisfying per-placement XP "tick", so any change is deferred until the sink it would protect actually exists.

## 8. Quests — Postcards & Milestones

### 8.1 Tutorial chain — "Welcome to the Drift" (12 steps)
Hand-authored, delivers the first-10-minutes contract (§4). Each step is one action with one reward; the chain ends with the first chunk purchase + first secret. Never modal — the player can ignore it and sandbox freely (it waits).

### 8.2 Postcards (rolling optional quests)
- Up to **2 active** at once, drawn from a hand-authored pool filtered by level/content (no procedural blandness in v1.0 — ~60 authored postcards, see CONTENT_PLAN §4).
- Shapes: *place X of category Y* · *collect N Pops* · *have N Islanders* · *pet 3 Pals* · *place a lantern within 2 blocks of a bench* (adjacency joy) · *find this chunk's secret* · *own N items from the Harbor tier*.
- Delivered diegetically: a paper plane flies in and lands in the mailbox HUD slot with a flutter. Rewards: ● always, ✦ for chain-enders, XP always.
- Skippable (slide away, a new one arrives after a few minutes) — never a wall.

### 8.3 Milestones (achievements)
Lifetime counters (items placed, Pops collected, chunks called, Pals petted, secrets found) with 3–5 tiers each, paying ✦. Surfaced in the Island Album, never as popups mid-play (queued to session end or menu visit).

## 9. Islanders & Pals (ambient life)

### 9.1 Islanders
- **Move-in:** each Home placeable has capacity (Hut 1, House 2, Fancy House 3). Population = min(total capacity, 20); up to **12 Islanders visibly out and about** at once (perf + readability), others are "indoors" (their homes glow / emit chimney smoke).
- **Behavior (needs-free, vibe-driven AI):** wander (grid pathfinding, strongly prefers paths), pause & look at pretty things (recently placed items!), sit on benches, stand at stalls and mime shopping, water flowers, wave at each other, at Pals, and *at the camera* occasionally. At night (day-night cycle, v0.5+) they head home; windows light up.
- **Identity-lite:** each Islander gets a name, a color variant (asset packs provide 18+ character models + texture variants), a favorite thing (flavor for postcards). No moods, no needs meters — Islanders are always content; they're *evidence of coziness, not a system to manage*.
- Clicking an Islander: they face the camera, emote (wave/heart/happy hop), maybe drop a flavor line ("Mo loves the new windmill.").

### 9.2 Pals (pets)
- Adopted via postcards/milestones or ✦ (adoption crate placeable → crate pops open, Pal hops out — a set-piece mini-moment). v1.0 roster ~12 of the 24 available animal models (see CONTENT_PLAN §5).
- Behaviors: wander, follow a random Islander for a while, nap in favorite spots (assignable bed placeables later), react to petting: **click to pet → heart burst + happy wiggle** (uses the packs' baked `gesture-positive`/`dance` clips) + small chance of a Pop bonus.
- Pals are pure joy objects — zero economy impact beyond the tiny liveliness bonus (§7.2).

## 10. Secrets & Discoveries

Seeded per-chunk on arrival (deterministic per save — see TECHNICAL_ARCHITECTURE §7):

| Secret | Chance/chunk | What happens |
|---|---|---|
| **Dig sparkle** | 35% | Glittering spot; 3 clicks with escalating poofs → reward burst (●, sometimes ✦) |
| **Buried chest** | 10% | Chest emerges, lid-pop animation → jackpot (●●, ✦, sometimes exclusive decor item) |
| **Rare flora** | 5% | e.g., Golden Mushroom — collectible for the Island Album, glows at night |
| *(nothing visible)* | 50% | chunk may still host fireflies at night — beauty, not loot |

**Island-wide ambient events** (all optional, all clickable, none missable-forever):
- **Shooting stars** (night): streak across the sky; click → ✦ sprinkle. Recur naturally.
- **Balloon flyby** (rare, day): a hot-air balloon drifts past; click → it drops a postcard.
- **Cloud whale** (very rare): a giant gentle silhouette passes below the island. Does nothing. Album entry. People will screenshot it.

## 11. Camera, Controls & UX

### 11.1 Camera (the player's hands)
- **Rig:** perspective (FOV 35°) orbiting the island's center of mass. Azimuth: free 360°. Polar: clamped 30–65° (default ~50° — the signature oblique "diorama" angle). Distance: 12–70 units with smooth dolly (default frames the whole island; auto-eases outward as the island grows).
- **Damped everything:** critically-damped spring smoothing on orbit/pan/zoom — the camera never jerks. Double-click a building/Islander to focus-glide onto it; **Home/R** resets framing.
- **Pan** clamped to island bounds + margin, so players can't get lost in the sky.

### 11.2 Input map (desktop v1.0)
| Action | Primary | Notes |
|---|---|---|
| Select / place / interact | LMB | context-aware |
| Orbit | RMB-drag (or MMB) | |
| Pan | WASD / arrows / LMB-drag on empty sky | edge-scroll optional, off by default |
| Zoom | wheel / +− | zoom-to-cursor |
| Rotate ghost | R / scroll-click | springy 90° |
| Rotate camera 45° snap | Q / E | |
| Build menu | B / bottom bar | |
| Move tool / Remove tool | M / X | also in radial on selected item |
| Cancel / close | Esc | universal |
| Photo mode (v0.6) | P | hides UI, free camera |

Touch is **planned-for** architecturally (pointer events, no hover-critical interactions, ≥44 px targets) but tuned post-1.0.

### 11.3 UI principles
- **Diegetic-first:** income bubbles over buildings, survey balloons at edges, paper-plane postcards — the world advertises the systems. Screen UI is a thin, rounded, cream-colored frame: currencies (top-left), level ring (top-right), postcards mailbox (left), catalog bar (bottom). Detailed UI spec in ART_DIRECTION §8.
- **One panel at a time**, everything dismissible with Esc, nothing modal during play except the (skippable) chunk arrival.
- **Numbers stay human:** no 1.2e6 — the economy is tuned so 5 digits is the ceiling.
- **Accessibility (v1.0):** reduced-motion mode (disables screen-space flourishes, keeps functional feedback), colorblind-safe valid/invalid ghost cues (icon + pattern, not color alone), UI scale option, no flashing content.

## 12. Day-Night & Atmosphere (v0.5+)

- A slow, gentle cycle (~20 real minutes/day; adjustable or freezable in settings — "always golden hour" is a valid cozy choice).
- Dawn/dusk tint the whole scene; lanterns and windows glow at night; fireflies over lush chunks; stars + shooting stars appear.
- Weather is post-core stretch (v0.6+): drifting cloud-shadow patterns, rare soft rain with sparkle-after. Never gloomy for long.

## 13. Audio Direction (summary — full plan in CONTENT_PLAN §8)

- **Music:** warm lo-fi acoustic loops (2–3 tracks v1.0), shuffled with long silences of pure ambience — silence is cozy too.
- **Ambience bed:** soft wind, distant birds, cloth flutters, chimes near certain decor.
- **SFX identity:** the **plop** (placement), **coin-glitter** (collect), **whoosh-thunk-bounce** (chunk arrival), paper flutter (postcards), happy chirps (Islanders/Pals). All short, soft-attack, low-mid heavy — never sharp.
- Everything mixable in settings (music/SFX/ambience sliders), remembers choices.

## 14. Scope Summary for v1.0 (what "done" means)

**In:** 36-chunk expansion arc · ~120 placeables across 8 catalog tiers · 4 chunk themes · economy (●/✦/XP/L20) · tutorial + ~60 postcards + milestones · Islanders (≤12 visible) + 12 Pals · secrets (4 types) + 3 ambient events · day-night · save/load + export · photo mode · full juice & audio pass · settings/accessibility · 60 fps on mid hardware.

**Out (post-1.0 backlog, see ROADMAP §Post-1.0):** elevation/terraces · weather · fishing pond minigame · seasons/events · island-code sharing · crafting · touch/mobile tuning · Steam wrapper.

## 15. Risks & Design Mitigations

| Risk | Mitigation |
|---|---|
| Decoration fatigue ("placed everything, now what?") | content tiers pace reveals; postcards direct attention; collections give completionist pull; chunk arc gives a spatial goal |
| Economy feels either trivial or grindy | tuning tables centralized (CONTENT_PLAN §6), telemetry-free playtest checklist per milestone (ROADMAP), the no-grind covenant is testable |
| Juice becomes noise | animation language doc (ART_DIRECTION §7) defines *hierarchy* — set pieces > interactions > ambient; reduced-motion mode as forcing function |
| Ambient AI reads as random/robotic | behaviors weighted toward *reacting to the player's recent actions* (visit new placements) — cheap trick, huge perceived intelligence |
| Browser perf variance | quality tiers + hard content caps designed in from day one (TECHNICAL_ARCHITECTURE §8) |

---

*This GDD is the design source of truth. Mechanical details of implementation live in SYSTEMS_BREAKDOWN.md; if the two ever disagree, the GDD states intent and SYSTEMS_BREAKDOWN must be corrected to match (or this doc explicitly amended).*
