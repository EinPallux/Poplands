/**
 * Asset phase classification (S4, TECH §7) — content-as-data, three.js-free.
 *
 * The manifest pipeline stamps every model with a `phase`, and `AssetRegistry`
 * loads them in waves so first paint waits only on `boot`:
 *
 *   boot   — Tiers 1–4 catalog items + agents (npc./pal.) + fixed world fixtures
 *            (windmill, house kit walls) + auto-tile variant GLBs. Everything the
 *            tutorial can place before the background `early` wave finishes.
 *   early  — Tiers 5–14 that carry no biome (the Riverside/Harbor + Grand sets).
 *            Fetched on idle right after boot; player can't out-level the wait.
 *   themed:<biome> — biome-exclusive Tier 11–13 sets (Sandbar/Spooky/Snowcap).
 *            Fetched when that biome first unlocks (level-up) or arrives (chunk).
 *
 * A meadow-only island therefore never downloads the Spooky/Snowcap/Sandbar GLBs.
 */
import type { ChunkTheme } from '@/core/grid';
import { CATALOG, type ItemDef } from './catalog';
import { TILE_KITS } from './tileKits';

export type AssetPhase = 'boot' | 'early' | `themed:${ChunkTheme}`;

/** Catalog tiers at/under this ride the boot wave; above it, `early` (unless themed). */
const BOOT_TIER_MAX = 4;

/** Non-catalog fixture models built by StarterIsland/landmarks — always boot. */
const FIXTURES = new Set([
  'ground.grass-block',
  'building.windmill',
  'building.windmill-blade',
  'kit.roof-point',
  'kit.wall-wood',
  'kit.wall-wood-door',
  'kit.wall-wood-window',
]);

const modelToDef = new Map(CATALOG.map((d) => [d.model, d]));

/** The phase a catalog item rides: themed by biome, else by tier. */
function phaseOfDef(def: ItemDef): AssetPhase {
  if (def.theme) return `themed:${def.theme}`;
  return def.tier <= BOOT_TIER_MAX ? 'boot' : 'early';
}

/** Auto-tile variant GLBs carry no ItemDef of their own — they ride the phase of
 *  the catalog item that owns their kit (dirt/stone paths are Tier 1 → boot; the
 *  river is Tier 7 → early, so its variants must NOT get stranded on the boot wave). */
const variantPhase = new Map<string, AssetPhase>();
for (const [kitId, kit] of Object.entries(TILE_KITS)) {
  const owner = CATALOG.find((d) => d.tileKit === kitId);
  const phase: AssetPhase = owner ? phaseOfDef(owner) : 'boot';
  for (const model of [kit.fallback, ...Object.values(kit.variants)]) variantPhase.set(model, phase);
}

/** True when `phaseFor` had no catalog/override match and fell back to boot — the
 *  pipeline surfaces these so a newly-added, unclassified model is never silently
 *  shipped in the wrong wave. */
export function isUnclassified(id: string): boolean {
  return (
    !id.startsWith('npc.') &&
    !id.startsWith('pal.') &&
    !FIXTURES.has(id) &&
    !variantPhase.has(id) &&
    !modelToDef.has(id)
  );
}

/** The load phase for a manifest model id. Pure — derived from the catalog. */
export function phaseFor(id: string): AssetPhase {
  if (id.startsWith('npc.') || id.startsWith('pal.') || FIXTURES.has(id)) return 'boot';
  const variant = variantPhase.get(id);
  if (variant) return variant; // tile-kit fallback/variant GLB → its owning item's phase
  const def = modelToDef.get(id);
  if (!def) return 'boot'; // fail-safe: never drop a model; pipeline warns via isUnclassified
  return phaseOfDef(def);
}
