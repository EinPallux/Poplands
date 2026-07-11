/**
 * The Catalog — every Placeable, as data (CLAUDE.md: content is data, not code).
 * Ids are STABLE save-format contract: never rename after shipping; removal
 * requires a save migration. Costs are display-only until the economy lands
 * in v0.3 (S13). Tuning values start from CONTENT_PLAN §2.
 *
 * three.js-free by layering rule — render concerns are expressed as plain data
 * (renderTier, scale) interpreted by the presentation layer.
 */
import type { StringKey } from '@/core/strings';
import type { Footprint } from '@/core/grid';

export type Category = 'nature' | 'decor' | 'home' | 'income' | 'ground';

/** How the prop renderer draws this item (TECH §6.2 tiers). */
export type RenderTier = 'instanced' | 'unique';

export interface ItemDef {
  id: string;
  nameKey: StringKey;
  category: Category;
  /** Catalog tier — gated by level in v0.3 (Tier N unlocks at Level N). */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  footprint: Footprint;
  /** Pops charged on placement (100% refunded on remove). */
  cost: number;
  /** Optional Stardust cost (premium items). */
  costStardust?: number;
  /** Income buildings produce Pops over time (S13). ratePerMin is the canonical unit. */
  income?: { ratePerMin: number; cap: number };
  /** Homes house Islanders (consumed in v0.5; authored now as the single source). */
  houses?: number;
  /** Manifest model id. */
  model: string;
  /** Uniform import scale to hit the footprint (tuned against pipeline AABBs). */
  scale: number;
  yOffset?: number;
  renderTier: RenderTier;
  /** Ground overlays (paths) live on their own occupancy layer, under props. */
  groundOverlay?: boolean;
  /** Default true; false for radially symmetric items where rotation is noise. */
  rotatable?: boolean;
}

const def = (d: ItemDef): ItemDef => d;

export const CATALOG: readonly ItemDef[] = [
  // ——— Tier 1 · "Sprout" ———
  def({ id: 'nature.tree', nameKey: 'item.nature.tree', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 25, model: 'nature.tree', scale: 1.3, renderTier: 'instanced' }),
  def({ id: 'nature.bush', nameKey: 'item.nature.bush', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 15, model: 'nature.bush', scale: 1.8, renderTier: 'instanced' }),
  def({ id: 'nature.flower.purple', nameKey: 'item.nature.flower.purple', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 12, model: 'nature.flower-purple', scale: 2.0, renderTier: 'instanced' }),
  def({ id: 'nature.flower.red', nameKey: 'item.nature.flower.red', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 12, model: 'nature.flower-red', scale: 2.0, renderTier: 'instanced' }),
  def({ id: 'nature.flower.yellow', nameKey: 'item.nature.flower.yellow', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 12, model: 'nature.flower-yellow', scale: 2.0, renderTier: 'instanced' }),
  def({ id: 'nature.grass', nameKey: 'item.nature.grass', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 8, model: 'nature.grass', scale: 1.5, renderTier: 'instanced' }),
  def({ id: 'nature.mushroom', nameKey: 'item.nature.mushroom', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 15, model: 'nature.mushroom', scale: 1.9, renderTier: 'instanced' }),
  def({ id: 'nature.pebble', nameKey: 'item.nature.pebble', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 10, model: 'nature.pebble', scale: 1.6, renderTier: 'instanced' }),
  def({ id: 'nature.rock', nameKey: 'item.nature.rock', category: 'nature', tier: 1, footprint: { w: 1, d: 1 }, cost: 12, model: 'nature.rock-small', scale: 1.4, renderTier: 'instanced' }),
  def({ id: 'decor.fence', nameKey: 'item.decor.fence', category: 'decor', tier: 1, footprint: { w: 1, d: 1 }, cost: 10, model: 'deco.fence', scale: 1, renderTier: 'instanced' }),
  def({ id: 'ground.path.dirt', nameKey: 'item.ground.path.dirt', category: 'ground', tier: 1, footprint: { w: 1, d: 1 }, cost: 5, model: 'ground.path-dirt', scale: 1, yOffset: 0.002, renderTier: 'instanced', groundOverlay: true, rotatable: false }),
  def({ id: 'ground.path.stone', nameKey: 'item.ground.path.stone', category: 'ground', tier: 1, footprint: { w: 1, d: 1 }, cost: 8, model: 'ground.path-stone', scale: 1, yOffset: 0.002, renderTier: 'instanced', groundOverlay: true }),
  def({ id: 'decor.bench', nameKey: 'item.decor.bench', category: 'decor', tier: 1, footprint: { w: 2, d: 1 }, cost: 30, model: 'deco.bench', scale: 1.6, renderTier: 'unique' }),
  def({ id: 'decor.pot', nameKey: 'item.decor.pot', category: 'decor', tier: 1, footprint: { w: 1, d: 1 }, cost: 18, model: 'deco.pot', scale: 1.5, renderTier: 'instanced' }),
  def({ id: 'decor.stump', nameKey: 'item.decor.stump', category: 'decor', tier: 1, footprint: { w: 1, d: 1 }, cost: 14, model: 'deco.stump', scale: 1.8, renderTier: 'instanced' }),
  def({ id: 'decor.sign', nameKey: 'item.decor.sign', category: 'decor', tier: 1, footprint: { w: 1, d: 1 }, cost: 12, model: 'deco.sign', scale: 1.6, renderTier: 'instanced' }),

  // ——— Tier 2 · "First Neighbors" ———
  def({ id: 'income.stall', nameKey: 'item.income.stall', category: 'income', tier: 2, footprint: { w: 2, d: 2 }, cost: 100, income: { ratePerMin: 2, cap: 60 }, model: 'building.stall', scale: 1.9, renderTier: 'unique' }),
  def({ id: 'home.hut', nameKey: 'item.home.hut', category: 'home', tier: 2, footprint: { w: 3, d: 3 }, cost: 150, houses: 1, model: 'building.hut', scale: 3.4, renderTier: 'unique' }),
  def({ id: 'home.house', nameKey: 'item.home.house', category: 'home', tier: 2, footprint: { w: 3, d: 4 }, cost: 400, houses: 2, model: 'building.house', scale: 3.0, renderTier: 'unique' }),
  def({ id: 'decor.lantern', nameKey: 'item.decor.lantern', category: 'decor', tier: 2, footprint: { w: 1, d: 1 }, cost: 25, model: 'deco.lantern', scale: 1, renderTier: 'instanced' }),
  def({ id: 'decor.fence.gate', nameKey: 'item.decor.fence.gate', category: 'decor', tier: 2, footprint: { w: 1, d: 1 }, cost: 15, model: 'deco.fence-gate', scale: 1, renderTier: 'instanced' }),
  def({ id: 'nature.clover', nameKey: 'item.nature.clover', category: 'nature', tier: 2, footprint: { w: 1, d: 1 }, cost: 10, model: 'nature.clover', scale: 2.2, renderTier: 'instanced' }),
  def({ id: 'nature.fern', nameKey: 'item.nature.fern', category: 'nature', tier: 2, footprint: { w: 1, d: 1 }, cost: 14, model: 'nature.fern', scale: 1.7, renderTier: 'instanced' }),
  def({ id: 'nature.pine', nameKey: 'item.nature.pine', category: 'nature', tier: 2, footprint: { w: 1, d: 1 }, cost: 30, model: 'nature.pine', scale: 1.6, renderTier: 'instanced' }),
  def({ id: 'decor.hedge', nameKey: 'item.decor.hedge', category: 'decor', tier: 2, footprint: { w: 1, d: 1 }, cost: 16, model: 'deco.hedge', scale: 1, renderTier: 'instanced' }),

  // ——— Tier 3 · "Homestead" (unlocks at Level 3) ———
  def({ id: 'income.pumpkin-patch', nameKey: 'item.income.pumpkin-patch', category: 'income', tier: 3, footprint: { w: 2, d: 2 }, cost: 220, income: { ratePerMin: 4, cap: 150 }, model: 'crop.pumpkin', scale: 2.6, renderTier: 'unique' }),
  def({ id: 'income.wheat-field', nameKey: 'item.income.wheat-field', category: 'income', tier: 3, footprint: { w: 2, d: 3 }, cost: 300, income: { ratePerMin: 5, cap: 200 }, model: 'crop.wheat', scale: 2.6, renderTier: 'unique' }),
  def({ id: 'nature.apple-tree', nameKey: 'item.nature.apple-tree', category: 'nature', tier: 3, footprint: { w: 1, d: 1 }, cost: 45, model: 'nature.oak', scale: 1.3, renderTier: 'instanced' }),
  def({ id: 'nature.berry-bush', nameKey: 'item.nature.berry-bush', category: 'nature', tier: 3, footprint: { w: 1, d: 1 }, cost: 20, model: 'nature.berry-bush', scale: 1.5, renderTier: 'instanced' }),
  def({ id: 'nature.corn', nameKey: 'item.nature.corn', category: 'nature', tier: 3, footprint: { w: 1, d: 1 }, cost: 18, model: 'crop.corn', scale: 1.2, renderTier: 'instanced' }),
  def({ id: 'decor.hay-bale', nameKey: 'item.decor.hay-bale', category: 'decor', tier: 3, footprint: { w: 1, d: 1 }, cost: 22, model: 'deco.hay-bale', scale: 1.3, renderTier: 'instanced' }),
  def({ id: 'decor.campfire', nameKey: 'item.decor.campfire', category: 'decor', tier: 3, footprint: { w: 1, d: 1 }, cost: 55, model: 'deco.campfire', scale: 1.6, renderTier: 'instanced' }),

  // ——— Tier 4 · "Homestead+" (unlocks at Level 4) ———
  def({ id: 'home.farmhouse', nameKey: 'item.home.farmhouse', category: 'home', tier: 4, footprint: { w: 3, d: 4 }, cost: 400, houses: 2, model: 'building.farm', scale: 1.6, renderTier: 'unique' }),
  def({ id: 'decor.cart', nameKey: 'item.decor.cart', category: 'decor', tier: 4, footprint: { w: 1, d: 2 }, cost: 38, model: 'deco.cart', scale: 1.1, renderTier: 'unique' }),
  def({ id: 'decor.log-pile', nameKey: 'item.decor.log-pile', category: 'decor', tier: 4, footprint: { w: 1, d: 2 }, cost: 26, model: 'deco.log-pile', scale: 1.4, renderTier: 'instanced' }),
  def({ id: 'nature.carrot', nameKey: 'item.nature.carrot', category: 'nature', tier: 4, footprint: { w: 1, d: 1 }, cost: 18, model: 'crop.carrot', scale: 1.5, renderTier: 'instanced' }),

  // ——— Tier 5 · "Village" (unlocks at Level 5) ———
  def({ id: 'income.market-stall', nameKey: 'item.income.market-stall', category: 'income', tier: 5, footprint: { w: 2, d: 2 }, cost: 500, income: { ratePerMin: 8, cap: 350 }, model: 'building.market-stall', scale: 1.9, renderTier: 'unique' }),
  def({ id: 'income.bakery', nameKey: 'item.income.bakery', category: 'income', tier: 5, footprint: { w: 3, d: 3 }, cost: 800, income: { ratePerMin: 12, cap: 500 }, model: 'building.bakery', scale: 1.6, renderTier: 'unique' }),
  def({ id: 'home.village-house', nameKey: 'item.home.village-house', category: 'home', tier: 5, footprint: { w: 3, d: 4 }, cost: 900, houses: 2, model: 'building.village-house', scale: 1.8, renderTier: 'unique' }),
  def({ id: 'decor.fountain', nameKey: 'item.decor.fountain', category: 'decor', tier: 5, footprint: { w: 2, d: 2 }, cost: 350, model: 'deco.fountain', scale: 1.0, renderTier: 'unique' }),
  def({ id: 'decor.lightpost', nameKey: 'item.decor.lightpost', category: 'decor', tier: 5, footprint: { w: 1, d: 1 }, cost: 45, model: 'deco.lightpost', scale: 1.0, renderTier: 'instanced' }),
  def({ id: 'decor.banner', nameKey: 'item.decor.banner', category: 'decor', tier: 5, footprint: { w: 1, d: 1 }, cost: 30, model: 'deco.banner', scale: 1.3, renderTier: 'instanced' }),

  // ——— Tier 6 · "Grand" (unlocks at Level 6) ———
  def({ id: 'income.watermill', nameKey: 'item.income.watermill', category: 'income', tier: 6, footprint: { w: 3, d: 3 }, cost: 2000, income: { ratePerMin: 20, cap: 900 }, model: 'building.watermill', scale: 1.6, renderTier: 'unique' }),
  def({ id: 'decor.statue', nameKey: 'item.decor.statue', category: 'decor', tier: 6, footprint: { w: 1, d: 1 }, cost: 150, model: 'deco.statue', scale: 1.4, renderTier: 'instanced' }),
  def({ id: 'decor.stone-bridge', nameKey: 'item.decor.stone-bridge', category: 'decor', tier: 6, footprint: { w: 1, d: 1 }, cost: 60, model: 'deco.bridge', scale: 1.0, renderTier: 'instanced' }),
] as const;

const byId = new Map(CATALOG.map((d) => [d.id, d]));

export function itemDef(id: string): ItemDef | undefined {
  return byId.get(id);
}

/** All items whose tier gate is `tier` — used for the level-up "New in Catalog" reveal. */
export function itemsInTier(tier: number): ItemDef[] {
  return CATALOG.filter((d) => d.tier === tier);
}

export const CATEGORIES: readonly Category[] = ['nature', 'decor', 'home', 'income', 'ground'];

/** Highest tier present in the catalog (drives the progression unlock table). */
export const MAX_TIER = CATALOG.reduce((m, d) => Math.max(m, d.tier), 1);
