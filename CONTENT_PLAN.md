# Poplands — Content Plan

> What ships, when it unlocks, what it costs, and which file it comes from.

| | |
|---|---|
| **Document** | Content Plan — catalog, quests, NPCs, economy tuning, asset sourcing |
| **Status** | Planning |
| **Version** | 0.1.0-plan |
| **Last updated** | 2026-07-10 |
| **Related docs** | [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) · [ART_DIRECTION](ART_DIRECTION.md) · [ROADMAP](ROADMAP.md) |

All content below is **data, not code** — it will live in typed content modules (`src/content/*`) per TECHNICAL_ARCHITECTURE §7. Item stats here are opening values for playtesting, expected to be tuned.

---

## 1. Asset Inventory (what's in `/assets` today)

Audited 2026-07-10. **~2,100 GLB models** across 17 packs; all packs provide GLB (plus FBX/OBJ duplicates we ignore). Models are low-poly, flat-shaded, mostly sharing Kenney-style `colormap` palette textures; typical size 70–160 KB.

| Pack | Models | Contents (short) | Poplands role |
|---|---|---|---|
| **Nature Assets 2** | 329 | Kenney Nature Kit: trees (40+ variants incl. fall/dark), cliffs (rock+stone incl. waterfall pieces), bridges, fences, paths & river tiles, crops (carrot/melon/pumpkin/turnip/corn/wheat/bamboo stages), campfires, tents, rocks/stumps/logs, flowers, mushrooms, pots, statues, canoe | **Workhorse pack**: nature decor, farm tier, ground overlays, island skirt |
| **Nature Assets** | 68 | Larger stylized singles: trees, dead trees, bushes, clover, ferns, flower groups/petals, grass tufts, pebbles, mushrooms (incl. Laetiporus) | Hero nature props (bigger, chunkier read than Nature 2) |
| **Fantasy Town Assets** | 167 | Kenney Fantasy Town Kit: modular walls/roofs/stairs (stone+wood), fountains (modular), market stalls (red/green) + bench/stool, carts, lanterns, hedges, banners, roads, **watermill, windmill, waterwheel**, chimneys, trees | Village tier: stalls, fountains, lanterns; source kit for authored house prefabs |
| **Fantasy RTS Assets** | 105 | Complete buildings: Houses (7 variants), Huts, Small Farm, Farms, Mills/Windmill, Market Stalls, Village Market, Storage huts/sheds, Docks/Port, Watch/Stone towers, Castle/Fortress, Temples, Town Centers, Monuments, Wonder, Mine, Mountains, resource props (gold, logs, crops) | **Income & home buildings** (pre-assembled, big footprints) |
| **NPCS** | 44 | `character-a…r` (18, animated node-rigs) + `character-female/male-a…f` (12, skinned+animated: idle/walk/sprint/sit/pick-up/interact/emote-yes/no/crouch/jump…) + mobility aids (canes, wheelchairs — also animated) + glasses/masks | **Islanders** roster |
| **Cube Pets** | 24 | Animated animals (idle/walk/run/eat/dance/gesture±): cat, dog, bunny, fox, chick, cow, pig, deer, bee, beaver, caterpillar, crab, koala, panda, parrot, penguin, polar bear, tiger, lion, monkey, elephant, giraffe, hog, fish | **Pals** roster |
| **Platformer Assets** | 153 | `block-grass-*` & `block-snow-*` terrain blocks **with overhang/corner/slope variants**, coins (bronze/silver/gold), jewel/star/heart/key, chest, crates, doors, fences, hedges, flags, mushrooms, pipes, trees (+snow), ladders, levers | **Island ground/skirt blocks**, collect/VFX props (coins, chest, star), Snowcap tier |
| **Graveyard Assets** | 91 | Gravestones, crypts, iron fences, lanterns & lightposts, candles, pumpkins (carved), hay bales, **fall pines**, benches, stone walls, urns, altars, debris + characters: ghost, keeper, skeleton, vampire, zombie | **Spooky Grove tier** (cozy-spooky subset only), benches/lightposts reused everywhere |
| **Pirate Assets** | 72 | Ships (small→large, ghost), rowboats, dock platforms/structures, palms (4), cannons, chests, crates/barrels/bottles, flags, sand rocks, grass patches | **Harbor tier**: docks, moored boats, palms |
| **Castle Assets** | 76 | Modular towers (square/hexagon), walls, gates, drawbridge, flags/banners/pennants, siege props (skip), rocks | **Castle tier** |
| **City Assets** | 40 | `building-type-a…u` complete modern houses, driveways, paths, planters, fences | Held for post-1.0 ("Suburbia" novelty tier) |
| **Market Assets** | 20 | Supermarket kit: shelves, registers, freezers, displays, carts/baskets + employee | Post-1.0 novelty interiors; `display-fruit/bread` reusable at stalls |
| **Factory Assets** | 143 | Conveyors, cogs, catwalks, pipes, buttons, boxes | Post-1.0 "Tinker" tier (kinetic garden-art contraptions) |
| **Space Assets** | ~60 | Astronauts, aliens, rockets, terrain, corridors | Post-1.0 novelty (rocket garden folly) |
| **Street Assets** | ~40 | Race-track props: grandstands, billboards, flags, barriers, light posts | Mostly unused; light posts maybe |
| **Arena Assets** | 22 | Columns, statues, trophy, banners, weapon racks, soldier | Wonders tier statuary |
| **Coral Reef Assets** | 6 | Combined reef set-pieces | Post-1.0 (pond/aquarium dreams) |

**Coverage verdict:** every v1.0 content tier is fully coverable from existing packs. Gaps are only VFX sprites, UI, audio, fonts (see §7–8).

### ⚠️ 1.1 License audit — REQUIRED before public release
The repo contains **no license files** (confirmed by the 2026-07-11 audit pass — a full scan finds zero LICENSE/README/txt files across all 17 packs). Most packs are Kenney (CC0) by filename convention, but several use poly.pizza-style export names (hash suffixes like `House-RSwoYSLblu.glb` — typically Quaternius CC0 or Google Poly CC-BY, **attribution may be required**). **The structured ledger now lives in [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)** — every pack, its runtime status, filename/variant evidence, and a source hypothesis.
- **Key finding:** the audit **can't be closed from the repo** (no license files); it needs the downloader to confirm each pack's source + license.
- **🔴 Priority:** **Fantasy RTS Assets** is *already shipping* (Hut/Farm/Bakery/village-house) yet its `Title Case With Spaces` naming is **not Kenney** — it matches GDevelop's free "3D Fantasy RTS" pack, license unconfirmed. Confirm it first.

Action items (tracked in ROADMAP v0.2 → carried to v0.4):
1. Identify origin of each pack (Kenney page / poly.pizza entry / itch / GDevelop) — `ATTRIBUTIONS.md` has the hypotheses.
2. Record per-pack license + author in `ATTRIBUTIONS.md` (shipped in the game's credits panel).
3. Any pack that can't be license-confirmed gets quarantined out of the build manifest.

---

## 2. Catalog — Placeables by Tier

~120 items at v1.0. Format: **Item — footprint — cost — source model(s)**. Categories: 🌿 Nature · 🪑 Decor · 🏠 Home · 💰 Income · 🛤 Ground · ✨ Special. Income items show `rate/min → cap`. (Pricing rules §6.)

### Tier 1 · "Sprout" — Level 1 (available from the first click)
*Theme: bare-essentials meadow charm. ~14 items, everything ≤ 40 ●.*

| Item | Cat | Size | Cost ● | Source |
|---|---|---|---|---|
| Little Tree | 🌿 | 1×1 | 25 | Nature2 `tree_default` (+ `_dark`/`_fall` variants as free skins) |
| Round Bush | 🌿 | 1×1 | 15 | Nature2 `plant_bush` / Nature `Bush` |
| Wildflowers (3 colors) | 🌿 | 1×1 | 12 | Nature2 `flower_purpleA/redA/yellowA` |
| Grass Tuft | 🌿 | 1×1 | 8 | Nature2 `grass` / Nature `Grass Wispy` |
| Mushroom | 🌿 | 1×1 | 15 | Nature2 `mushroom_red` / Nature `Mushroom` |
| Pebble Cluster | 🌿 | 1×1 | 10 | Nature `Pebble Round` variants |
| Small Rock | 🌿 | 1×1 | 12 | Nature2 `rock_smallA…F` (random variant) |
| Wooden Fence | 🪑 | 1×1 | 10 | Nature2 `fence_simple` (+ `fence_gate`) |
| Dirt Path | 🛤 | 1×1 | 5 | Nature2 `ground_pathTile` family |
| Stone Path | 🛤 | 1×1 | 8 | Nature2 `path_stone` family |
| Garden Bench | 🪑 | 1×2 | 30 | Graveyard `bench` |
| Flower Pot | 🪑 | 1×1 | 18 | Nature2 `pot_small`/`pot_large` |
| Log Seat | 🪑 | 1×1 | 14 | Nature2 `stump_round` |
| Signpost | 🪑 | 1×1 | 12 | Nature2 `sign` |

### Tier 2 · "First Neighbors" — Level 2
*First income + first home. The tutorial rides this tier.*

| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| **Flower Stall** | 💰 | 2×2 | 100 ● | **2 ●/min → 60**. FantasyTown `stall-green` + `display` dressing |
| **Cozy Hut** | 🏠 | 3×3 | 150 ● | houses 1 Islander. RTS `Hut` |
| Lantern | 🪑 | 1×1 | 25 ● | FantasyTown `lantern`; glows at night |
| Picket Gate | 🪑 | 1×1 | 15 ● | Nature2 `fence_gate` |
| Clover Patch | 🌿 | 1×1 | 10 ● | Nature `Clover` |
| Fern | 🌿 | 1×1 | 14 ● | Nature `Fern` |
| Tall Pine | 🌿 | 1×1 | 30 ● | Nature2 `tree_pineTallA…D` |
| Hedge | 🪑 | 1×1 | 16 ● | FantasyTown `hedge` (+curved/gate) |

### Tier 3–4 · "Homestead" — Levels 3–4
*Farm fantasy. Crops are decorative-productive: planted beds that ripen visually.*

| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| **Veggie Patch** | 💰 | 2×2 | 220 ● | 4 ●/min → 150. Nature2 `crops_dirtRow` + crop stage models (carrot/pumpkin/turnip/melon — visual ripening!) |
| **Wheat Field** | 💰 | 2×3 | 300 ● | 5 ●/min → 200. Nature2 `crops_wheatStageA/B` |
| **Small Farmhouse** | 🏠 | 3×4 | 400 ● | houses 2. RTS `House` variants |
| Scarecrow | 🪑 | 1×1 | 40 ● | assembled prefab (pole + crossbar + pumpkin head) |
| Hay Bale | 🪑 | 1×1 | 22 ● | Graveyard `hay-bale` (+bundled) |
| Apple Tree | 🌿 | 1×1 | 45 ● | Nature2 `tree_oak` recolored fruit dots (prefab) |
| Log Pile | 🪑 | 1×2 | 26 ● | Nature2 `log_stack`/`log_stackLarge` |
| Well | 🪑 | 1×1 | 60 ● | RTS or FantasyTown `fountain-round` cut-down prefab |
| Campfire | ✨ | 1×1 | 55 ● | Nature2 `campfire_logs`; flickers, Islanders gather at night |
| Wooden Cart | 🪑 | 1×2 | 38 ● | FantasyTown `cart` / `cart-high` |
| Berry Bush | 🌿 | 1×1 | 20 ● | Nature `Bush with Flowers` |

### Tier 5–6 · "Village" — Levels 5–6
*The island becomes a town. First 2-Islander interactions (stall browsing).*

| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| **Market Stall (red/green)** | 💰 | 2×2 | 500 ● | 8 ●/min → 350. FantasyTown `stall`, `stall-red/green` + bench/stool |
| **Bakery** | 💰 | 3×3 | 800 ● | 12 ●/min → 500. Authored prefab from FantasyTown kit (chimney smokes!) |
| **Village House** | 🏠 | 3×4 | 900 ● | houses 2. RTS `House` other variants / FantasyTown prefab |
| **Windmill** | 💰 | 3×3 | 1,200 ● | 15 ●/min → 700. FantasyTown `windmill` — **blades spin** (Tier-3 ambient anim) |
| Fountain | 🪑 | 2×2 | 350 ● | FantasyTown modular fountain prefab; water shimmer + Islander gather point |
| Street Lantern | 🪑 | 1×1 | 45 ● | Graveyard `lightpost-single/double` |
| Town Banner | 🪑 | 1×1 | 30 ● | FantasyTown `banner-red/green` — sways |
| Stone Stairs/Bridge | 🪑 | 1×2 | 60 ● | Nature2 `bridge_stone` (decorative over paths) |
| Statue | 🪑 | 1×1 | 150 ● | Nature2 `statue_head/column/obelisk` |
| Flower Bed | 🌿 | 1×2 | 55 ● | Nature `Flower Group` variants |

### Tier 7–8 · "Riverside" — Levels 7–8
| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| River Tile (straight/bend/end) | 🛤 | 1×1 | 20 ● | Nature2 `ground_river*` — hand-picked pieces v0.2; auto-tiling v0.6 |
| **Watermill** | 💰 | 3×3 | 2,000 ● | 20 ●/min → 900. FantasyTown `watermill(-wide)` — **wheel turns**; +25% if touching river tiles (gentle synergy, not a puzzle) |
| Wooden Bridge | 🪑 | 1×2 | 70 ● | Nature2 `bridge_wood(Round)` |
| Lily Pond Kit | 🌿 | 1×1 | 35 ● | Nature2 `lily_large/small` on water tile |
| Canoe | 🪑 | 1×2 | 90 ● | Nature2 `canoe` (+paddle) |
| **Fishing Hut** | 🏠 | 3×3 | 1,600 ● | houses 1 + fishing-rod dressing. RTS `Shack` |
| Reed Cluster | 🌿 | 1×1 | 18 ● | Nature2 `grass_leafsLarge` |

### Tier 9–10 · "Harbor" — Levels 9–10 · unlocks **Sandbar chunks**
| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| **Dock** | 🛤/🪑 | 1×2 | 80 ● | Pirate `structure-platform-dock(-small)` — extends off island edge! (edge-anchor placement rule) |
| **Moored Sloop** | ✨ | 3×2 | 2,400 ● | decorative ship floating beside island, gentle bob. Pirate `ship-small/medium` |
| **Harbor Market** | 💰 | 3×3 | 3,000 ● | 26 ●/min → 1,200. RTS `Docks`/`Shipping Port` |
| Palm Tree | 🌿 | 1×1 | 50 ● | Pirate `palm-*` (4 variants) |
| Crate Stack / Barrel | 🪑 | 1×1 | 25/20 ● | Pirate `crate`, `barrel` |
| Pirate Flag | 🪑 | 1×1 | 60 ● | Pirate `flag-*` — waves |
| Beach Rocks | 🌿 | 1×1 | 15 ● | Pirate `rocks-sand-a/b/c` |
| **Lighthouse** | 💰 | 2×2 | 4,000 ● | 30 ●/min → 1,400. Prefab from Pirate `tower-*` pieces; light sweeps at night ✦ moment |

### Tier 11–12 · "Spooky Grove" — Levels 11–12 · unlocks **Spooky chunks**
*Cozy-spooky: pumpkins & lanterns, no gore. Friendly Ghost Pal quest lives here.*

| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| Pumpkin (+carved) | 🌿 | 1×1 | 30/45 ● | Graveyard `pumpkin(-carved/tall)` — carved glows at night |
| Fall Pine | 🌿 | 1×1 | 40 ● | Graveyard `pine-fall(-crooked)` |
| Iron Fence | 🪑 | 1×1 | 20 ● | Graveyard `iron-fence*` |
| Candle Cluster | 🪑 | 1×1 | 25 ● | Graveyard `candle-multiple` |
| **Haunted-ish House** | 🏠 | 3×4 | 5,500 ● | houses 2. Prefab: Graveyard `crypt-large` + FantasyTown roof, friendly windows |
| **Cocoa Cauldron Stand** | 💰 | 2×2 | 6,000 ● | 38 ●/min → 1,800. Graveyard `altar-stone` + cauldron dressing |
| Raven Statue / Urn | 🪑 | 1×1 | 70 ● | Graveyard `urn-*`, `statue` pieces |

### Tier 13–14 · "Snowcap" — Levels 13–14 · unlocks **Snowcap chunks**
| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| Snow Pine | 🌿 | 1×1 | 45 ● | Platformer `tree-pine-snow(-small)` |
| Snowman | 🪑 | 1×1 | 80 ● | prefab (stacked spheres + props) |
| Ice Crystal | 🪑 | 1×1 | 90 ● | Platformer `jewel` recolored, sparkles |
| **Ski Chalet** | 🏠 | 3×4 | 8,000 ● | houses 3. Prefab: FantasyTown wood walls + snow roof recolor |
| **Cocoa Stand** | 💰 | 2×2 | 9,000 ● | 48 ●/min → 2,200. Stall re-dress with steam particles |
| String Lights | 🪑 | 1×2 | 60 ● | custom mini-mesh; glow line at night |

### Tier 15–16 · "Castle" — Levels 15–16
| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| Castle Tower (round/square) | 🪑 | 2×2 | 4,000 ● | Castle `tower-hexagon/square` stacks (authored 2–3 height prefabs) |
| Castle Wall / Gate | 🪑 | 1×1 / 2×1 | 300/800 ● | Castle `wall`, `gate`, `metal-gate` |
| **Keep** | 🏠 | 4×5 | 15,000 ● | houses 3 + banner anim. Castle prefab / RTS `Castle` |
| **Tavern** | 💰 | 3×4 | 12,000 ● | 60 ●/min → 3,000. FantasyTown prefab, chimney + lantern |
| Drawbridge | 🪑 | 2×3 | 900 ● | Castle `bridge-draw` |
| **Pop Post** | ✨ | 1×1 | 10,000 ● + 10 ✦ | auto-collects income within 5 blocks (GDD §7.2 convenience unlock) |

### Tier 17–18 · "Wonders" — Levels 17–18
| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| **Temple** | 💰 | 4×4 | 20,000 ● | 75 ●/min → 4,000. RTS `Temple` variants |
| **Town Hall** | 💰/✨ | 5×5 | 30,000 ● | 100 ●/min → 5,000 + island-wide +5% liveliness. RTS `Town Center` |
| Marble Column / Statue | 🪑 | 1×1 | 400 ● | Arena `column`, `statue`, `trophy` |
| Monument | 🪑 | 2×2 | 2,500 ● | RTS `Wooden Monument`/`Monuments` |
| Grand Fountain | 🪑 | 3×3 | 3,000 ● | FantasyTown fountain modular, tall prefab |

### Tier 19–20 · "Dreamer" — Levels 19–20 (whimsy finale)
| Item | Cat | Size | Cost | Notes / Source |
|---|---|---|---|---|
| **The Wonder** | ✨ | 5×5 | 50,000 ● + 30 ✦ | v1.0 capstone. RTS `Wonder First Age` — permanent gentle aurora above it |
| Rocket Garden Folly | 🪑 | 2×2 | 5,000 ● | Space pack rocket, decorative, occasional steam puff |
| Cog Fountain (kinetic art) | 🪑 | 2×2 | 4,000 ● | Factory `cog-a…e` slow-turning sculpture |
| Golden Tree | 🌿 | 1×1 | 8,000 ● + 5 ✦ | recolored `tree_detailed`, drops sparkle motes |

### Special / non-catalog placeables
- **Adoption Crate** (Pal delivery, quest/✦ triggered) — Platformer `crate-item`.
- **Treasure Chest** (secret spawn only) — Platformer `chest` (lid-pop).
- **Survey Balloon** (system prop) — custom mini hot-air balloon prefab.
- **Album collectibles** (Golden Mushroom = Nature `Mushroom Laetiporus` gilded, etc.) — placed as trophies once found.

---

## 3. Authored Prefabs (multi-model composites)

Some "items" are hand-assembled groups of kit pieces, authored **in data** (piece id + local transform, baked to a single GLB by the asset pipeline's `bake-prefabs` step — TECHNICAL_ARCHITECTURE §7.2): Bakery, Haunted-ish House, Ski Chalet, Lighthouse, Castle Towers/Keep, Grand Fountain, Scarecrow, Snowman, Well, Apple Tree, Survey Balloon. **Budget: ~15 prefabs for v1.0**, authored during the tier's milestone (ROADMAP). This is the main "content labor" line item besides tuning.

---

## 4. Quests

### 4.1 Tutorial — "Welcome to the Drift" (12 steps, v0.3)
1. Plant 3 wildflowers → 30 ●
2. Place a path (3 tiles) → 25 ●
3. Place the Garden Bench → 40 ●
4. Build the **Flower Stall** → 60 ●
5. Collect your first Pops → 25 ● (+teaches ripen bubble)
6. Build the **Cozy Hut** → *Mo moves in!* → 80 ●
7. Say hi to Mo (click) → 20 ●, Mo waves
8. Place 2 lanterns → 40 ●
9. Reach Level 2 → 3 ✦ (first Stardust, explained)
10. Collect 150 ● total → 50 ●
11. **Call your first chunk** (survey balloon highlighted; chain has granted exactly enough ✦+●) → set piece!
12. Investigate the sparkle on the new chunk → dig secret → 2 ✦ + 100 ● → *"The Drift is waking up. Keep growing."* → unlocks free-play postcards

### 4.2 Postcard pool (~60 authored, unlocked in level bands; v0.3–v0.6)
Shapes & samples (full list authored per-milestone in `content/postcards.ts`):
- **Placement:** "Plant 5 trees" · "A cozy corner: bench + lantern within 2 blocks" · "Line a 6-tile path with flowers" · "Place 3 Harbor items on a Sandbar chunk"
- **Economy:** "Collect 500 ● " · "Have 3 income buildings ripe at once" · "Save 1,000 ● (don't spend!)"
- **Life:** "Reach 4 Islanders" · "Pet 3 Pals" · "Watch an Islander sit at the fountain" (passive-observe quests = cozy genius: reward for *watching*)
- **Explore:** "Find a chunk secret" · "Catch a shooting star" · "Orbit the island fully zoomed out" (teaches camera joy)
- Chain-enders pay 2–5 ✦; standard postcards pay ● + XP.

### 4.3 Milestones (lifetime, v0.3+)
Items placed (10/50/150/400) · Pops collected (1k/10k/100k) · Chunks called (1/6/12/24/36) · Pals petted (10/100/500) · Secrets found (3/10/25) · Postcards done (10/30/60). Each tier: 2–8 ✦.

---

## 5. Islanders & Pals rosters

### 5.1 Islanders (v0.5)
18 base models (`character-a…r`) + 12 skinned (`character-female/male-a…f`) = visual pool of 30; v1.0 uses 16 curated + name pool. Naming tone: soft two-syllable — Mo, Pia, Bram, Lulu, Fen, Nix, Oda, Juno, Taro, Wren, Sol, Mika, Posy, Gus, Ivy, Remy. Each: model + palette variant, favorite-category (flavors postcards), tiny bio line for Album.
Move-in order is authored for the first four (Mo → Pia → Bram → Lulu, tutorial/early postcards reference them), random afterward. Mobility-aid props (`wheelchair`, `aid-*` models + baked wheelchair clips) included in the pool from the start — representation by default.

### 5.2 Pals (v0.5, 12 at v1.0)
| Pal | Unlock |
|---|---|
| Cat, Dog, Bunny | early postcards (one each, levels 4–7) |
| Chick, Pig, Cow | Homestead milestones |
| Fox, Deer | secrets (chunk chest exclusive) |
| Crab, Parrot | Harbor tier postcards |
| Friendly Ghost *(uses Graveyard `character-ghost`)* | Spooky Grove chain finale |
| Penguin | Snowcap chain finale |
Remaining 12 animals reserved for post-1.0 (seasonal events). Each Pal: favorite-spot behavior + Album entry.

---

## 6. Economy Tuning Tables (opening values)

**Rules recap (GDD §7):** income caps ≈ 30 min of production early, up to ~50 min for grand buildings; refunds 100%; `XP_to_next(L) = round₁₀(60·L^1.55)`; chunk purchase k: `250·1.32^(k-1)` ● for k ≤ 8 then ×1.13 per chunk, + `2+⌊k/4⌋` ✦ (themed +25%).

### 6.1 Level curve (cumulative XP, friendly-rounded)
| L | XP to next | L | XP to next | L | XP to next | L | XP to next |
|---|---|---|---|---|---|---|---|
| 1 | 60 | 6 | 970 | 11 | 2,450 | 16 | 4,400 |
| 2 | 180 | 7 | 1,220 | 12 | 2,800 | 17 | 4,850 |
| 3 | 330 | 8 | 1,500 | 13 | 3,170 | 18 | 5,300 |
| 4 | 520 | 9 | 1,800 | 14 | 3,560 | 19 | 5,800 |
| 5 | 730 | 10 | 2,110 | 15 | 3,970 | 20 | — (cap) |

### 6.2 Chunk price ladder (chunks 5–16 shown; starter = 4 free; k = purchase index = chunk# − 4)
| # | ● | ✦ | # | ● | ✦ |
|---|---|---|---|---|---|
| 5 | 250 | 2 | 11 | 1,350 | 3 |
| 6 | 330 | 2 | 12 | 1,750 | 4 |
| 7 | 440 | 2 | 13 | 2,000 | 4 |
| 8 | 580 | 3 | 14 | 2,250 | 4 |
| 9 | 760 | 3 | 15 | 2,550 | 4 |
| 10 | 1,000 | 3 | 16 | 2,900 | 5 |
…×1.32 through chunk 12 (k=8), then ×1.13: chunk 24 ≈ 7,300 ● + 7 ✦, chunk 36 ≈ 33,000 ● + 10 ✦. Stardust faucet is tuned so ✦, not ●, is the binding constraint mid-game (keeps income buildings from trivializing expansion).

### 6.3 Income sanity check (is the curve cozy?)
Early game (2 stalls + patch ≈ 8 ●/min + postcards ≈ 15 ●/min effective) → chunk 5 in ~8 min, chunk 6 in ~15 more: matches GDD pacing target. Mid-game (L10, ~6 income buildings ≈ 60 ●/min + caps banked while away): a session buys 1–2 chunks + a tier's shopping. **Playtest checkpoint at every milestone:** "always something affordable within 5 minutes" (the no-grind covenant, GDD §7.5).

### 6.4 Stardust budget (v1.0 bounded faucets ≈ 260 ✦ + uncapped trickle; sinks ≈ 230 ✦)
Faucets: tutorial 5 · chain-enders ~70 · milestones ~60 · secrets ~45 · level-ups (5/level from L5) ~80 · shooting stars uncapped trickle (~1/night). Sinks: all 32 purchasable chunks ≈ 184 · Pop Post 10 · The Wonder 30 · Golden Tree 5. Bounded surplus + trickle is intentional (players can never softlock expansion, and completionists always have a star to catch).

---

## 7. Custom Assets To Create (non-pack; also listed in ART_DIRECTION §10)
Particle atlas (dust/poof/confetti/heart/sparkle/leaf) · sky+cloud-sea shaders · puffball clouds ×5 · skirt root/vine meshes ×3 · ground decals (ring/blob/cookie/soil) · survey balloon · snowman/scarecrow/string-lights mini-meshes · UI SVG kit (~24 icons) · app icon/og-image · ~15 prefab GLBs (§3).

## 8. Audio Shopping List (all CC0-preferred; v0.5 pass)
- **Kenney audio packs** (kenney.nl, CC0): *Interface Sounds*, *UI Audio*, *Impact Sounds* — covers plops, clicks, thunks, pickups.
- **Music:** 2–3 warm lo-fi/acoustic loops — source from CC0 (Pixabay Music / FreePD) or commission later; license recorded in ATTRIBUTIONS.md. Placeholder: none (silence + ambience is acceptable until v0.5).
- **Ambience:** wind bed, songbirds, night crickets, soft flag flutter (freesound CC0 picks, each logged).
- **Bespoke (last resort):** chunk-arrival fanfare may need a custom 3-note motif — synthesize with a soft marimba/kalimba patch.

## 9. Content by Milestone (what ships when — mirrors ROADMAP)
| Milestone | Catalog | Quests | Life | Themes |
|---|---|---|---|---|
| v0.2 Builder's Joy | Tiers 1–2 (~22 items) | — | — | Meadow |
| v0.3 Pops & Purpose | + Tiers 3–6 (~60 total) | Tutorial + 20 postcards + milestones v1 | — | Meadow |
| v0.4 New Horizons | + Tiers 7–8 (~75 total) | + 10 postcards, secrets v1 | — | Meadow |
| v0.5 Little Neighbors | (no new tiers — life milestone) | + 10 life postcards | 16 Islanders, 6 Pals | — |
| v0.6 Living Canvas | + Tiers 9–14 (~105 total) | + 15 postcards | + 6 Pals | Sandbar, Spooky, Snowcap |
| v0.7 → 1.0 | + Tiers 15–20 (~120 total) | + chain finales | polish | — |
