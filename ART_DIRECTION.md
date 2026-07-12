# Poplands — Art Direction

> A sunlit toy diorama floating in a watercolor sky.

| | |
|---|---|
| **Document** | Art Direction — visual & animation source of truth |
| **Status** | Planning |
| **Version** | 0.1.0-plan |
| **Last updated** | 2026-07-10 |
| **Related docs** | [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) · [CONTENT_PLAN](CONTENT_PLAN.md) · [TECHNICAL_ARCHITECTURE](TECHNICAL_ARCHITECTURE.md) |

---

## 1. Visual Pillars

1. **Toy diorama.** The island should read like a hand-crafted miniature you could pick up: crisp low-poly silhouettes, chunky proportions, a clearly visible rocky underside "skirt" that says *this is an object, not terrain*.
2. **Sunlit softness.** One warm sun, gentle shadows, sky-blue ambient fill. Nothing harsh: soft contrast, no pure black, no pure white.
3. **Saturated pastels.** Colors are cheerful and clean but never neon. The Kenney-style palette textures already nail this — we curate around them rather than fight them.
4. **Motion everywhere, noise nowhere.** Constant tiny motion (banners, windmills, clouds, bobbing balloons) at low amplitude; big motion is reserved for player-triggered moments.
5. **Readable at arm's length.** At default zoom the player must instantly distinguish: buildable vs occupied, income-ready vs producing, interactive vs decorative. Silhouette + color + one glyph — never text-in-world.

**North-star references:** Tiny Glade (softness), Townscaper (diorama clarity), Animal Crossing: NH (prop charm & UI warmth), Bad North (island-as-object framing), LEGO Builder's Journey (material restraint).

## 2. The Asset Foundation (what we have and how we use it)

The repo ships 17 low-poly packs (~2,100 GLB models, Kenney / kenney.nl style — flat-shaded, shared palette "colormap" textures, ~70–160 KB per model). This is a *feature*: one consistent art style across all content tiers. Full pack-by-pack usage mapping in [CONTENT_PLAN §2](CONTENT_PLAN.md).

Style rules for using them:
- **Never mix scales.** 1 pack unit ≈ 1 block. Every catalog item gets a per-item scale factor tuned once at import (verified against a reference character 0.9 blocks tall) so a door is always Islander-sized.
- **Palette harmony over variety.** When a pack's colors clash (e.g., Factory's industrial greys in a meadow), we recolor via material overrides (swap to our palette ramp) rather than exclude the model.
- **Silhouette first.** Choose models with strong single-read silhouettes for interactive items; ambiguous ones become filler decor.
- Character/animal models come **pre-animated** (idle/walk/sit/interact/emote clips baked in the GLBs) — animation style is therefore consistent by default; custom code animation must match its snappy, bouncy timing.

## 3. Color Script

### 3.1 World palette (day, the default beauty shot)

| Role | Color | Notes |
|---|---|---|
| Sky zenith | `#7EC8F5` | clear cheerful blue |
| Sky horizon | `#EAF7FF` → `#FFE9C9` | warm cream band where the cloud sea glows |
| Cloud sea / clouds | `#FFFFFF` → shadow `#D9E8F5` | never grey |
| Sunlight | `#FFF3D6` @ ~3.2 intensity | warm but not orange |
| Ambient/sky fill | `#BFDFFF` (hemi sky) / `#8C7A6B` (ground bounce) | keeps shadows lively blue-warm |
| Grass top | `#7FD63F` base, `#99E558` highlight (jitter checker) | vivid, happy lawn *(saturation confirmed by user review 2026-07-11)* |
| Grass lip side | `#67C433` | the overhanging fringe band |
| Base: sand band | `#E3BD85` | light, warm |
| Base: rock band | `#C06F45` → `#8E5132` toward the bottom | saturated terracotta |
| Water (later) | `#5FC9E8`, foam `#EAFBFF` | flat with sparkle |
| UI cream | `#FFF6E8` | panels |
| UI ink | `#4A3F5E` | text — soft plum, never black |
| Accent coral | `#FF8A70` | buttons, invalid ghost |
| Accent mint | `#7FDCA4` | valid ghost, confirmations |
| Accent gold | `#FFC94B` | Pops, ripeness, celebrations |
| Accent star | `#B9A6FF` | Stardust, night magic |

### 3.2 Time-of-day grading (v0.5+)
Cycle tints only three things — sun color/angle, hemisphere colors, fog color — through 4 keyframes: **Dawn** (rose `#FFD2C2`), **Day** (above), **Dusk** (amber `#FFB37E`, long shadows — the screenshot hour), **Night** (indigo `#3B4A7A` ambient, `#9FB8FF` moon sun, windows/lanterns bloom warmly). Saturation *rises* slightly at dusk — cozy, not moody. Night is short (~15% of cycle) and always star-speckled.

### 3.3 Chunk theme palettes
- **Meadow** — palette above.
- **Sandbar** — sand `#F2DCA0`, sun-bleached props, teal accents.
- **Spooky Grove** — desaturated teal grass `#5E8A6E`, plum shadows, pumpkin `#FF9D45` + candle glow (cozy-spooky, zero horror).
- **Snowcap** — snow `#F4F8FF` with blue shadow `#C9DAF2`, warm wood + string-light accents to keep it snug.

## 4. Lighting & Rendering Recipe (the "look" in three.js terms)

Target: the whole look from **one directional sun + one hemisphere light + tone mapping** — cheap, consistent, controllable. (Implementation detail in TECHNICAL_ARCHITECTURE §6.)

- Renderer: WebGL2, `ACESFilmicToneMapping`, exposure ≈ 1.15, sRGB output, antialias on, pixel ratio ≤ 2.
- **Sun:** single `DirectionalLight`, warm (§3.1), elevation ~50°, azimuth NW of default camera so facades facing the default view are lit. Shadow map 2048² (High) with tight ortho frustum auto-fitted to island bounds; `shadow.radius` for soft edges; subtle bias tuning to avoid acne on flat roofs.
- **Hemisphere light** sky/ground (§3.1) ≈ 0.9 — this does the heavy "cozy fill" lifting.
- **No baked lightmaps** (everything moves/changes too often); contact grounding via a blob shadow decal under dynamic agents and micro AO darkening baked into the ground tile edges.
- **Fog:** very light `Fog` matched to horizon cream — melts the island edges into the sky, sells altitude.
- **Post stack (quality-gated):** subtle bloom (high threshold — only lanterns, gold coins, stardust bloom) + gentle vignette. **Optional "Diorama" toggle:** tilt-shift depth-of-field for screenshots/photo mode (off by default; it's expensive and disorienting during play).
- **Night additions:** lantern/window `PointLight`s are faked — emissive textures + bloom + a fake light-cookie decal on the ground beneath. Real point lights: max 2–3 (e.g., following a festival item), everything else emissive. Non-negotiable perf rule.
- **Selection/hover:** no postprocess outlines; hover = slight lift + emissive tint pulse; selection = animated dashed ring decal on the ground (shader, one draw call).

## 5. World Dressing (the sky stage)

The island never floats in a void:
- **Sky dome:** large inverted sphere with a 3-stop vertical gradient shader (zenith/horizon/cream band). Sun disc + soft glow sprite.
- **Cloud sea** far below: two slowly-scrolling overlapping planes of soft cloud-noise shader — reads as an infinite fluffy ocean.
- **Drifting clouds:** 8–14 low-poly puffball clusters (merged icosphere blobs, flat white, slight vertical bob) drifting on two depth layers — some *below* the island (crucial altitude cue), an occasional one above casting a soft moving shadow patch (fake: a blurred dark decal, not a shadowcaster).
- **Distant islets:** 3–5 tiny non-interactive rock islets with a single tree, parallax-orbiting far away — the world feels bigger than your island.
- **Birds** (v0.4+): tiny 2-triangle flappers in occasional V-formations. **Falling leaves / pollen motes** drift over lush areas; **fireflies** at night; **snow motes** on Snowcap chunks.
- **The base slab** *(user-approved direction, 2026-07-11 — supersedes the earlier "crag skirt" idea)*: the island underside is a chunky layered slab — overhanging grass lip → light sand band → tall saturated terracotta rock band tapering to a rounded bottom — with an organically wobbling silhouette (procedural, from the traced block outline, deterministic as chunks are added). Reads like a slice of cake you could pick up; players WILL orbit low to look. The slab is part of the brand silhouette; distant islets reuse it in miniature.

## 6. Scale, Composition & Grid Readability

- 1 block = 1 m; Islander height ≈ 0.9 blocks; single-story buildings ≈ 2.2–3 blocks tall; the tallest v1.0 item (Wonder/Castle tower) ≤ 8 blocks — keeps the diorama's "snow-globe" proportions and avoids shadow-frustum blowout.
- **Grid display philosophy:** the grid is invisible until relevant. Entering build mode fades in a soft grid vignette only within ~6 blocks of the cursor; valid cells breathe gently. Never a full-island hard grid (kills the organic look).
- Ground blocks get **edge-softening**: a subtle darker rim + occasional grass tuft overhang so chunk seams read as lawn, not tiles; themed chunks blend at borders with a 1-block dithered transition strip.
- Composition guidance (used by starter island & marketing shots): default camera 50° polar shows roof faces + one facade; place tall items island-center, small items near edges — the tutorial's pre-built island *demonstrates* good composition players naturally imitate.

## 7. Animation Language — "Everything Pops"

The motion identity. All UI + world motion uses this shared vocabulary (implemented once in the Juice system, SYSTEMS_BREAKDOWN §11).

### 7.1 Motion rules
1. **Anticipation → overshoot → settle.** Nothing linearly appears. Standard easings: `backOut` for arrivals, `backIn` for departures, critically-damped springs for follows/camera.
2. **Squash & stretch, subtle.** Max ±12% scale deformation, always volume-preserving. Cute, not cartoon-rubber.
3. **Fast attack, soft decay.** Interactions respond in ≤ 100 ms; settles may take 300–500 ms. The pop-in reads *instant* even though it's 280 ms because impact frame is at ~60 ms.
4. **Cascade, don't sync.** Multi-object reactions (grass ripple, catalog items appearing) stagger 20–40 ms per item — waves feel alive, sync feels robotic.
5. **Motion hierarchy — budget attention:**
   - **Tier 1 · Set pieces** (chunk arrival, level-up, chest opening): screen-dominating, 1.5–2.5 s, particles + sound + light. Rare by design.
   - **Tier 2 · Interactions** (place/remove/collect/pet): 150–450 ms, localized.
   - **Tier 3 · Ambient** (banners, windmills, bobbing, idle blinks): amplitude so low you only notice when it's gone.
6. **Reduced-motion mode:** Tier 1 becomes a short crossfade + particles-lite; Tier 2 keeps functional feedback at 50% amplitude; Tier 3 largely persists (it's calm). No screen-space shakes ever (we don't use camera shake at all — the camera is sacred).

### 7.2 Canonical animation specs (tuning table)

| Name | Trigger | Spec (initial values, tune by feel) |
|---|---|---|
| `pop-in` | item placed | scale 0→1.12→1.0, `backOut` 280 ms; dust ring sprite 400 ms; 3 grass-blade flutters; plop SFX pitch-laddered on repeat |
| `pop-out` | item removed | squash (1.15w, 0.85h) 80 ms → scale-to-0 `backIn` 120 ms; poof cloud; refund coin-arc |
| `ghost-hover` | build mode | ghost lerps to cursor @ 18 Hz spring; valid: mint 55% opacity + breathing ring; invalid: coral + 2× shake on click attempt |
| `chunk-arrival` | chunk purchased | 0–0.4 s cloud swirl under slot → 0.4–1.5 s chunk rises (`backOut`, slight tilt & yaw correction) → 1.5–1.9 s dock-bounce (spring ζ≈0.55, 2 visible bounces) → grass ripple radiates 3 chunks (staggered per-block y-bumps) → confetti burst + fanfare. Total ≈ 2.2 s, skippable after 0.8 s |
| `coin-arc` | income collected | 3–7 coin sprites launch on randomized beziers → HUD counter; counter does spring-scale tick; glitter trail |
| `ripen-bubble` | building store fills | bubble grows in 3 steps with tiny bounce; at full: slow golden pulse + occasional sparkle (visible from max zoom-out) |
| `move-lift` | move tool pickup | item lifts 0.4 blocks, gentle 1.5° sway bob while held; drop = mini pop-in |
| `pet-love` | Pal petted | Pal plays `gesture-positive`/`dance` clip; 3–5 heart particles; squeak |
| `move-in` | Islander arrives | door opens, Islander walks out, stretches, waves at camera; house does a 4% happy squash |
| `level-up` | XP threshold | radial gold burst from island center, HUD ring completes & blooms, "New in Catalog" card slides in with spring |
| `postcard-in` | quest arrives | paper plane swoops a bezier across screen corner → folds into mailbox icon, mailbox wiggles |
| `star-pickup` | shooting star clicked | star zips to counter leaving stardust trail; night sky twinkle burst |

### 7.3 Character & Pal animation usage
Character GLBs ship with `idle, walk, sprint, sit, pick-up, interact-left/right, emote-yes/no, die, drive` clips; animals with `idle, walk, run, eat, dance, gesture-positive/negative`. Rules:
- Locomotion blends idle↔walk by speed; arrival at a point of interest triggers a purposeful clip (`sit` on benches, `interact-right` at stalls/flowers = "shopping/watering").
- Emotes are *reactions*, triggered by proximity events (new placement nearby, camera click, Pal encounter) — never on a visible timer.
- All clip playback gets ±10% random time-scale and randomized start offsets — twelve Islanders must never sync-step (rule 7.1.4).

## 8. UI Art Direction

- **Shape language:** everything rounded (16 px radius family), pill buttons, sticker-like icons with 2 px cream outline. Panels are cream (`#FFF6E8`) with soft drop shadow + 1 px warm border; feels like paper tags on a gift.
- **Typography:** one friendly rounded sans for everything — **Baloo 2** (headings) + **Nunito** (body), self-hosted WOFF2 (OFL license). Ink color `#4A3F5E`. Numerals tabular for counters.
- **Iconography:** custom minimal SVG set (~24 icons: Pops, Stardust, XP, hammer/build, mailbox, camera, gear…), 2.5 px rounded strokes, filled with palette accents. Style-matched to the sticker aesthetic; no emoji, no mixed icon sets.
- **Motion:** panels slide+spring (never fade-only), buttons depress 4% and bounce back, counters tick with spring-scale. All via the same Juice system as the world — one motion language.
- **HUD layout** (see GDD §11.3): center screen stays clear; everything auto-hides in photo mode. *Amended (post-1.0, user 2026-07-12): the original "corners only, ≤12% footprint" minimalism read as too empty for a management-style game — the HUD now uses framed, grouped panels for a more game-like feel (still corner-anchored, center clear).* The frame: a **top status bar** (island crest + name, level ring + XP, wallet pills, day/season/weather cluster) top-left; a **Tasks** card below it; an **island-stats strip** (neighbours/Pals/chunks/crops/stamps) bottom-left; a **feature dock** (Album/Journal/Stamp Book/Photo, panels flyout-left) top-right below the settings gear; the build bar bottom-centre.
- **Cursor & feedback:** default arrow; build mode gets a soft circular cursor; interactive world objects get hover-lift, not cursor swaps (readable on touch later).

## 9. Audio-Visual Cohesion Notes

Sound completes the look (asset shopping list in CONTENT_PLAN §8): plop/pluck UI family in a warm pentatonic space; celebration = layered chime + confetti crackle; ambience follows camera zoom (zoom in → more birdsong detail; zoom out → more wind). Music ducks −6 dB during Tier-1 set pieces so the fanfare owns the moment.

## 10. Deliverables & Asset-Creation Guidelines

Custom assets we must author (everything else comes from the packs — full list CONTENT_PLAN §7):

| Asset | Spec |
|---|---|
| Sky dome shader | 3-stop gradient + sun glow, day-night keyframes |
| Cloud sea shader | 2-layer scrolling noise, cream-tinted |
| Puffball clouds | 4–6 merged-sphere variants, < 300 tris each |
| Chunk skirt kit | assembled from pack cliff pieces + 3 custom root/vine meshes |
| Particle sprites | dust ring, poof, confetti (6 colors), heart, sparkle, glitter, leaf — single 512² atlas, hand-drawn soft shapes |
| Ground decals | selection ring (shader), blob shadow, light cookie, soil patch |
| UI kit | 9-slice panels, buttons, ring meter, mailbox, survey balloon icon — SVG source |
| Fonts | Baloo 2 + Nunito subset WOFF2 |
| App icon / favicon / og-image | island silhouette on sky gradient |

**Guidelines for any new 3D asset:** match Kenney density (≈ 100–800 tris/prop), flat-shaded, palette-texture UV-snapped (single 64–256 px colormap), Y-up, origin at footprint center, front = −Z, real-world block scale, one material, no transparency except dedicated foliage/glass materials, exported GLB (see TECHNICAL_ARCHITECTURE §7 pipeline).

**Review ritual:** every new content tier gets a "beauty shot" check — placed on a test island at default camera, dawn/day/dusk/night screenshots, verified against pillars §1 before merging.
