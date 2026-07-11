# ATTRIBUTIONS — asset license audit

Source-of-truth ledger for every asset pack in `/assets` and its runtime license
status. **The no-ship covenant (CLAUDE.md, CONTENT_PLAN §1.1): a pack may not be
referenced by the runtime manifest until its license is VERIFIED and recorded
here.** The asset pipeline is meant to gate on this.

Status: **AUDIT OPEN.** This document records the audit *so far* — evidence
gathered from the repo, plus source hypotheses — but the audit **cannot be closed
from the repository alone** (see the critical finding). Closing it needs one input
only the packs' downloader has: where each pack came from + its stated license.

## Legend
- ✅ **VERIFIED** — license confirmed (source URL + license recorded); safe to ship.
- 🟡 **PRESUMED** — strong evidence for a permissive license (naming/convention), but not yet confirmed by the downloader. **Not** shippable until confirmed.
- 🔴 **UNVERIFIED** — provenance unclear or evidence points to a non-CC0 source. Must be confirmed before ship.

## ⚠️ Critical finding (2026-07-11 audit pass)
**None of the 17 packs ships a license file.** A recursive scan of `/assets` finds
only model files (1,625 `.glb` + `.obj`/`.fbx`/`.stl`/`.dae`/`.png`) — **zero**
`LICENSE`/`README`/`CREDITS`/`.txt` files. So no pack's license can be verified
from the repo contents; provenance must come from the download source. Until then
**every pack is at best 🟡 PRESUMED**, and the packs already shipping since v0.1–v0.3
carry that risk retroactively.

Secondary evidence used below: **model-filename convention** (Kenney kits use
`snake_case`/`hyphen-case`; a `Title Case With Spaces` set is not Kenney) and
**hash-suffixed variants** (`House-k6tP5nFUd2.glb`) which indicate a poly.pizza /
aggregator re-export path where licenses are mixed per-model.

---

## Packs used at runtime (the ones that gate shipping)
These are referenced by `scripts/asset-manifest.json` (what actually ships). **All
must reach ✅ before 1.0.**

| Pack | Models shipped | Filename convention | Hash variants | Source hypothesis | Status |
|---|---|---|---|---|---|
| **Nature Assets 2** | ~30 (trees, flowers, crops, paths, decor) | `tree_default`, `flower_purpleA`, `crop_pumpkin` — Kenney Nature Kit style | 0 / 329 | Kenney *Nature Kit* (CC0) | 🟡 PRESUMED |
| **Fantasy Town Assets** | ~14 (lantern, stalls, windmill, wall kit, fountain, watermill) | `wall-wood-door`, `roof-high-point`, `stall-green` — Kenney Fantasy Town Kit style | 79 / 167 | Kenney *Fantasy Town Kit* (CC0) | 🟡 PRESUMED |
| **Graveyard Assets** | 3 (bench, hay-bale, lightpost) | `hay-bale`, `lightpost-single` — Kenney Graveyard Kit style | 19 / 91 | Kenney *Graveyard Kit* (CC0) | 🟡 PRESUMED |
| **Platformer Assets** | 1 (grass block) | `block-grass` — Kenney Platformer Kit style | 86 / 153 | Kenney *Platformer Kit* (CC0) | 🟡 PRESUMED |
| **Fantasy RTS Assets** | 5 (House, Hut, Small Farm, Business Building→Bakery, village-house) | `Small Farm.glb`, `Business Building.glb` — **Title Case + spaces, NOT Kenney** | 43 / 105 | Likely GDevelop free **"3D Fantasy RTS"** asset pack (128 assets) — license **not confirmed** | 🔴 UNVERIFIED |

### ⛔ Highest priority: Fantasy RTS Assets
This pack is **already shipping** (the Cozy Hut, farm, and the v0.3 Bakery/village
house all come from it) and its naming/variant pattern does **not** match a Kenney
kit. Web search points to GDevelop's free **"3D Fantasy RTS"** pack as the likely
origin, whose asset-store license must be read directly (the page 403s to
automated fetches). **Until its license is confirmed CC0/permissive-with-attribution,
the already-shipped content that depends on it is at risk, and the Tier 7+ Riverside/
Harbor items that want more of it (Port→Fish Market, Shack→Fishing Hut, Docks→Harbor
Market) stay blocked.**

### Pending for Tier 7+ (v0.4 content, not yet in the manifest)
- **Pirate Assets** (dock, crate, barrel, pennant, sloop, palm, beach-rock, chest) — Kenney *Pirate Kit* naming (`crate.glb`, `palm-straight.glb`, `structure-platform-dock.glb`); 18/72 hash variants → 🟡 PRESUMED (Kenney CC0). Needed for Tier 9–10 "Harbor".
- The Tier 7–8 "Riverside" items lean mostly on Nature Assets 2 + Fantasy Town (both 🟡 above) — lower risk than Harbor.

---

## Full library (raw packs — not necessarily shipped)
Nothing here ships unless it appears in the manifest above. Listed for completeness
(the audit must eventually cover any pack that gets pulled in).

| Pack | GLBs | Hash variants | Convention → hypothesis | Status |
|---|---|---|---|---|
| Nature Assets 2 | 329 | 0 | Kenney Nature Kit | 🟡 |
| Fantasy Town Assets | 167 | 79 | Kenney Fantasy Town Kit | 🟡 |
| Platformer Assets | 153 | 86 | Kenney Platformer Kit | 🟡 |
| Space Assets | 153 | 0 | Kenney Space Kit | 🟡 |
| Factory Assets | 143 | 79 | Kenney (Factory/Conveyor Kit) | 🟡 |
| Street Assets | 112 | 0 | Kenney City/Street Kit | 🟡 |
| Fantasy RTS Assets | 105 | 43 | **GDevelop "3D Fantasy RTS" — non-Kenney** | 🔴 |
| Graveyard Assets | 91 | 19 | Kenney Graveyard Kit | 🟡 |
| Castle Assets | 76 | 43 | Kenney Castle Kit | 🟡 |
| Pirate Assets | 72 | 18 | Kenney Pirate Kit | 🟡 |
| Nature Assets | 68 | 41 | Kenney Nature Kit (v1) | 🟡 |
| NPCS | 44 | 6 | animated characters — **source unclear** (Kenney? Quaternius?) | 🔴 |
| City Assets | 40 | 3 | Kenney City Kit | 🟡 |
| Cube Pets | 24 | 1 | animated pets — **source unclear** | 🔴 |
| Arena Assets | 22 | 1 | Kenney (Sports/Arena?) | 🔴 |
| Market Assets | 20 | 2 | Kenney (Market/Food Kit) | 🟡 |
| Coral Reef Assets | 6 | 0 | **source unclear** (Kenney Underwater? other) | 🔴 |

*(“Kenney CC0” hypotheses rest on kenney.nl’s standing policy of releasing all kits
under CC0 / public domain — but that only helps a pack that is genuinely a Kenney
kit obtained from Kenney. A re-upload of the same models elsewhere may carry a
different license, which is exactly why the downloader must confirm the source.)*

---

## How to close the audit (the one blocking input)
For each pack **used at runtime** (the 5 above, + Pirate before Tier 9–10), the
person who downloaded it confirms:
1. **Where it came from** (the exact store/page URL), and
2. **Its stated license** (CC0 / CC-BY / other), and
3. If CC-BY or similar, **the required attribution string**.

Then I record it here (status → ✅ with the URL + license), and — if any pack turns
out non-permissive — swap the affected models for a verified equivalent before it
ships. **Start with 🔴 Fantasy RTS: it already ships, so it's both the biggest risk
and the fastest win.**

Character/agent packs (**NPCS**, **Cube Pets**) block v0.5 "Little Neighbors", not
v0.4 — but they're 🔴 and should be confirmed on the same pass.
