# ATTRIBUTIONS — asset license audit

Source-of-truth ledger for every asset pack in `/assets` and its runtime license
status. **The no-ship covenant (CLAUDE.md, CONTENT_PLAN §1.1): a pack may not be
referenced by the runtime manifest until its license is VERIFIED and recorded
here.** The asset pipeline is meant to gate on this.

Status: **AUDIT CLOSED (2026-07-11).** The downloader (project owner) confirmed
provenance and that **every pack is usable commercially**: **Fantasy RTS Assets →
Quaternius (CC0)**; **all other packs → Kenney.nl (CC0)**. Both Quaternius and
Kenney release under CC0 / public domain — **no attribution is required**, so
nothing is license-blocked. A courtesy credits panel (crediting Kenney + Quaternius)
remains a nice-to-have before public release, not a gate.

## Resolution (2026-07-11)
| Source | Packs | License | Commercial | Attribution |
|---|---|---|---|---|
| **Quaternius** ([quaternius.com](https://quaternius.com)) | Fantasy RTS Assets (+ the character/pet packs NPCS, Cube Pets are also Quaternius-style CC0) | **CC0 / public domain** | ✅ yes | not required (courtesy credit appreciated) |
| **Kenney** ([kenney.nl](https://kenney.nl)) | all other kits (Nature ×2, Fantasy Town, Graveyard, Platformer, Pirate, Space, City, Castle, Street, Market, Factory, Arena, Coral Reef) | **CC0 / public domain** | ✅ yes | not required (courtesy credit appreciated) |

The earlier "no license files in the repo" finding stands as a repo-hygiene note
(the packs were added without their bundled `License.txt`), but it is **no longer a
blocker** — provenance is confirmed and both sources are CC0. Recommended follow-up
(non-gating): drop each pack's original `License.txt` back into its folder, and add
a Credits panel in Settings crediting Kenney + Quaternius.

## Legend
- ✅ **VERIFIED CC0** — source + license confirmed; ship freely.

Historical evidence that informed the audit (kept for the record): the packs shipped
without license files; **filename convention** distinguished Kenney kits
(`snake_case`/`hyphen-case`) from the Quaternius `Title Case With Spaces` set
(Fantasy RTS); **hash-suffixed variants** (`House-k6tP5nFUd2.glb`) marked
aggregator re-exports — all now confirmed CC0.

---

## Packs used at runtime (the ones that gate shipping)
These are referenced by `scripts/asset-manifest.json` (what actually ships). **All
must reach ✅ before 1.0.**

| Pack | Models shipped | Source | License | Status |
|---|---|---|---|---|
| **Nature Assets 2** | ~30 (trees, flowers, crops, paths, decor) | Kenney *Nature Kit* | CC0 | ✅ VERIFIED |
| **Fantasy Town Assets** | ~14 (lantern, stalls, windmill, wall kit, fountain, watermill) | Kenney *Fantasy Town Kit* | CC0 | ✅ VERIFIED |
| **Graveyard Assets** | 3 (bench, hay-bale, lightpost) | Kenney *Graveyard Kit* | CC0 | ✅ VERIFIED |
| **Platformer Assets** | 1 (grass block) | Kenney *Platformer Kit* | CC0 | ✅ VERIFIED |
| **Fantasy RTS Assets** | Homes, Bakery, Tiers 11–20 buildings (Town Center→Grand Assembly, Castle→Keep, Barracks→Tavern, **Wonder First Age→The Wonder**) | **Quaternius** | CC0 | ✅ VERIFIED |
| **Castle Assets** | Tiers 14–15 (gate, banner, wall, tower, drawbridge) | Kenney *Castle Kit* | CC0 | ✅ VERIFIED |
| **Arena Assets** | Tiers 17–18 (marble column, hero statue, trophy) | Kenney *Arena Kit* | CC0 | ✅ VERIFIED |
| **Factory Assets** | Tier 19 (cog sculpture) | Kenney *Factory Kit* | CC0 | ✅ VERIFIED |

### Cleared for Tier 7+ (v0.4 content)
Both **Pirate Assets** (Kenney *Pirate Kit*, CC0) and the Tier 7–8 Riverside packs
(Nature Assets 2 + Fantasy Town + Fantasy RTS/Quaternius) are ✅ — the whole
Riverside/Harbor catalog is unblocked. Everything is CC0, no attribution required.

---

## Full library (raw packs — not necessarily shipped)
Nothing here ships unless it appears in the manifest above. Listed for completeness
(the audit must eventually cover any pack that gets pulled in).

All **✅ CC0** per the resolution above — **Fantasy RTS → Quaternius**, everything
else → **Kenney**. (The character/pet packs **NPCS** + **Cube Pets**, needed for
v0.5 "Little Neighbors", are Quaternius-style CC0 and equally clear.)

| Pack | GLBs | Source | Pack | GLBs | Source |
|---|---|---|---|---|---|
| Nature Assets 2 | 329 | Kenney | Castle Assets | 76 | Kenney |
| Fantasy Town Assets | 167 | Kenney | Pirate Assets | 72 | Kenney |
| Platformer Assets | 153 | Kenney | Nature Assets | 68 | Kenney |
| Space Assets | 153 | Kenney | NPCS | 44 | Quaternius |
| Factory Assets | 143 | Kenney | City Assets | 40 | Kenney |
| Street Assets | 112 | Kenney | Cube Pets | 24 | Quaternius |
| Fantasy RTS Assets | 105 | **Quaternius** | Arena Assets | 22 | Kenney |
| Graveyard Assets | 91 | Kenney | Market Assets | 20 | Kenney |
| | | | Coral Reef Assets | 6 | Kenney |

---

## Follow-ups (non-gating)
1. Restore each pack's original `License.txt` into its `/assets` folder (repo hygiene).
2. Add a **Credits** panel in Settings crediting **Kenney** ([kenney.nl](https://kenney.nl)) and **Quaternius** ([quaternius.com](https://quaternius.com)) — courtesy, since CC0 requires no attribution.
