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
  /** Catalog tier — gated by level (Tier N unlocks at Level N; Tiers 1–2 at L1). */
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
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

  // ——— Tier 7 · "Riverside" (unlocks at Level 7). Scales tuned against pipeline AABBs. ———
  def({ id: 'income.fish-market', nameKey: 'item.income.fish-market', category: 'income', tier: 7, footprint: { w: 3, d: 3 }, cost: 2600, income: { ratePerMin: 24, cap: 1100 }, model: 'building.fish-market', scale: 1.4, renderTier: 'unique' }),
  def({ id: 'ground.river', nameKey: 'item.ground.river', category: 'ground', tier: 7, footprint: { w: 1, d: 1 }, cost: 20, model: 'ground.river', scale: 1, yOffset: 0.002, renderTier: 'instanced', groundOverlay: true }),
  def({ id: 'decor.wooden-bridge', nameKey: 'item.decor.wooden-bridge', category: 'decor', tier: 7, footprint: { w: 1, d: 1 }, cost: 70, model: 'deco.bridge-wood', scale: 1.0, renderTier: 'instanced' }),
  def({ id: 'nature.lily-pad', nameKey: 'item.nature.lily-pad', category: 'nature', tier: 7, footprint: { w: 1, d: 1 }, cost: 35, model: 'nature.lily', scale: 2.4, renderTier: 'instanced', rotatable: false }),
  def({ id: 'nature.reeds', nameKey: 'item.nature.reeds', category: 'nature', tier: 7, footprint: { w: 1, d: 1 }, cost: 18, model: 'nature.reeds', scale: 2.2, renderTier: 'instanced' }),

  // ——— Tier 8 · "Riverside" (unlocks at Level 8) ———
  def({ id: 'income.cider-mill', nameKey: 'item.income.cider-mill', category: 'income', tier: 8, footprint: { w: 3, d: 3 }, cost: 3400, income: { ratePerMin: 28, cap: 1300 }, model: 'building.cider-mill', scale: 1.5, renderTier: 'unique' }),
  def({ id: 'home.fishing-hut', nameKey: 'item.home.fishing-hut', category: 'home', tier: 8, footprint: { w: 3, d: 3 }, cost: 1900, houses: 1, model: 'building.fishing-hut', scale: 2.3, renderTier: 'unique' }),
  def({ id: 'decor.canoe', nameKey: 'item.decor.canoe', category: 'decor', tier: 8, footprint: { w: 1, d: 2 }, cost: 90, model: 'deco.canoe', scale: 1.5, renderTier: 'unique' }),

  // ——— Tier 9 · "Harbor" (unlocks at Level 9) ———
  def({ id: 'income.harbor-market', nameKey: 'item.income.harbor-market', category: 'income', tier: 9, footprint: { w: 3, d: 3 }, cost: 4200, income: { ratePerMin: 32, cap: 1500 }, model: 'building.harbor-market', scale: 0.95, renderTier: 'unique' }),
  def({ id: 'decor.dock', nameKey: 'item.decor.dock', category: 'decor', tier: 9, footprint: { w: 2, d: 2 }, cost: 80, model: 'deco.dock', scale: 0.85, renderTier: 'instanced' }),
  def({ id: 'nature.palm', nameKey: 'item.nature.palm', category: 'nature', tier: 9, footprint: { w: 1, d: 1 }, cost: 50, model: 'nature.palm', scale: 0.42, renderTier: 'instanced' }),
  def({ id: 'nature.beach-rock', nameKey: 'item.nature.beach-rock', category: 'nature', tier: 9, footprint: { w: 1, d: 1 }, cost: 15, model: 'nature.beach-rock', scale: 0.22, renderTier: 'instanced' }),
  def({ id: 'decor.crate', nameKey: 'item.decor.crate', category: 'decor', tier: 9, footprint: { w: 1, d: 1 }, cost: 25, model: 'deco.crate', scale: 0.75, renderTier: 'instanced' }),
  def({ id: 'decor.barrel', nameKey: 'item.decor.barrel', category: 'decor', tier: 9, footprint: { w: 1, d: 1 }, cost: 20, model: 'deco.barrel', scale: 0.7, renderTier: 'instanced' }),

  // ——— Tier 10 · "Harbor" (unlocks at Level 10) ———
  def({ id: 'income.lighthouse', nameKey: 'item.income.lighthouse', category: 'income', tier: 10, footprint: { w: 2, d: 2 }, cost: 5600, income: { ratePerMin: 38, cap: 1800 }, model: 'building.lighthouse', scale: 0.5, renderTier: 'unique' }),
  def({ id: 'decor.moored-sloop', nameKey: 'item.decor.moored-sloop', category: 'decor', tier: 10, footprint: { w: 3, d: 2 }, cost: 2400, costStardust: 2, model: 'deco.sloop', scale: 0.3, renderTier: 'unique' }),
  def({ id: 'decor.pennant', nameKey: 'item.decor.pennant', category: 'decor', tier: 10, footprint: { w: 1, d: 1 }, cost: 60, model: 'deco.pennant', scale: 0.55, renderTier: 'instanced' }),
  // ——— Tiers 11-14 (v0.6 Living Canvas: Harbor/Spooky/Winter/Grand) ———
  // ——— Tier 11 ———
  def({ id: 'nature.palm-leaning', nameKey: 'item.nature.palm-leaning', category: 'nature', tier: 11, footprint: { w: 1, d: 1 }, cost: 55, model: 'nature.palm-bend', scale: 0.42, renderTier: 'instanced' }),
  def({ id: 'nature.coconut-palm', nameKey: 'item.nature.coconut-palm', category: 'nature', tier: 11, footprint: { w: 1, d: 1 }, cost: 60, model: 'nature.palm-coconut', scale: 0.47, renderTier: 'instanced' }),
  def({ id: 'nature.beach-grass', nameKey: 'item.nature.beach-grass', category: 'nature', tier: 11, footprint: { w: 1, d: 1 }, cost: 14, model: 'nature.beach-grass', scale: 0.8, renderTier: 'instanced' }),
  def({ id: 'nature.sea-boulder', nameKey: 'item.nature.sea-boulder', category: 'nature', tier: 11, footprint: { w: 2, d: 2 }, cost: 40, model: 'nature.sea-boulder', scale: 0.43, renderTier: 'instanced' }),
  def({ id: 'nature.tropical-brush', nameKey: 'item.nature.tropical-brush', category: 'nature', tier: 11, footprint: { w: 2, d: 2 }, cost: 26, model: 'nature.tropical-brush', scale: 0.42, renderTier: 'instanced' }),
  def({ id: 'decor.rowboat', nameKey: 'item.decor.rowboat', category: 'decor', tier: 11, footprint: { w: 2, d: 2 }, cost: 130, model: 'deco.rowboat', scale: 0.84, renderTier: 'unique' }),
  def({ id: 'decor.jetty', nameKey: 'item.decor.jetty', category: 'decor', tier: 11, footprint: { w: 2, d: 2 }, cost: 70, model: 'deco.jetty', scale: 0.9, renderTier: 'instanced' }),
  def({ id: 'decor.raft', nameKey: 'item.decor.raft', category: 'decor', tier: 11, footprint: { w: 2, d: 2 }, cost: 55, model: 'deco.raft', scale: 0.89, renderTier: 'instanced' }),
  def({ id: 'decor.treasure-chest', nameKey: 'item.decor.treasure-chest', category: 'decor', tier: 11, footprint: { w: 1, d: 1 }, cost: 220, costStardust: 2, model: 'deco.treasure-chest', scale: 0.82, renderTier: 'unique' }),
  def({ id: 'decor.bottle-crate', nameKey: 'item.decor.bottle-crate', category: 'decor', tier: 11, footprint: { w: 1, d: 1 }, cost: 30, model: 'deco.bottle-crate', scale: 0.76, renderTier: 'instanced' }),
  def({ id: 'decor.cannon', nameKey: 'item.decor.cannon', category: 'decor', tier: 11, footprint: { w: 1, d: 2 }, cost: 110, model: 'deco.cannon', scale: 0.98, renderTier: 'unique' }),
  def({ id: 'decor.harbor-flag', nameKey: 'item.decor.harbor-flag', category: 'decor', tier: 11, footprint: { w: 1, d: 1 }, cost: 50, model: 'deco.harbor-flag', scale: 0.75, renderTier: 'instanced' }),
  def({ id: 'decor.oar', nameKey: 'item.decor.oar', category: 'decor', tier: 11, footprint: { w: 1, d: 1 }, cost: 18, model: 'deco.oar', scale: 0.68, renderTier: 'instanced' }),
  def({ id: 'decor.shipwreck', nameKey: 'item.decor.shipwreck', category: 'decor', tier: 11, footprint: { w: 3, d: 4 }, cost: 2600, costStardust: 3, model: 'deco.shipwreck', scale: 0.38, renderTier: 'unique' }),
  def({ id: 'income.boathouse', nameKey: 'item.income.boathouse', category: 'income', tier: 11, footprint: { w: 3, d: 3 }, cost: 6800, income: { ratePerMin: 44, cap: 2100 }, model: 'building.boathouse', scale: 0.93, renderTier: 'unique' }),
  // ——— Tier 12 ———
  def({ id: 'nature.dead-pine', nameKey: 'item.nature.dead-pine', category: 'nature', tier: 12, footprint: { w: 1, d: 1 }, cost: 130, model: 'nature.dead-pine', scale: 0.9, renderTier: 'instanced' }),
  def({ id: 'nature.dead-trunk', nameKey: 'item.nature.dead-trunk', category: 'nature', tier: 12, footprint: { w: 1, d: 1 }, cost: 60, model: 'nature.dead-trunk', scale: 1.66, renderTier: 'instanced' }),
  def({ id: 'decor.gravestone-round', nameKey: 'item.decor.gravestone-round', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 120, model: 'deco.gravestone-round', scale: 1.6, renderTier: 'instanced' }),
  def({ id: 'decor.gravestone-cross', nameKey: 'item.decor.gravestone-cross', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 140, model: 'deco.gravestone-cross', scale: 1.4, renderTier: 'instanced' }),
  def({ id: 'decor.gravestone-decorative', nameKey: 'item.decor.gravestone-decorative', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 160, model: 'deco.gravestone-decorative', scale: 1.5, renderTier: 'instanced' }),
  def({ id: 'decor.gravestone-broken', nameKey: 'item.decor.gravestone-broken', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 100, model: 'deco.gravestone-broken', scale: 1.6, renderTier: 'instanced' }),
  def({ id: 'decor.obelisk', nameKey: 'item.decor.obelisk', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 220, model: 'deco.obelisk', scale: 1.55, renderTier: 'instanced' }),
  def({ id: 'decor.wooden-cross', nameKey: 'item.decor.wooden-cross', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 110, model: 'deco.wooden-cross', scale: 1.3, renderTier: 'instanced' }),
  def({ id: 'decor.coffin', nameKey: 'item.decor.coffin', category: 'decor', tier: 12, footprint: { w: 1, d: 2 }, cost: 170, model: 'deco.coffin', scale: 1.5, renderTier: 'instanced' }),
  def({ id: 'decor.jack-o-lantern', nameKey: 'item.decor.jack-o-lantern', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 90, model: 'deco.jack-o-lantern', scale: 1.6, renderTier: 'instanced' }),
  def({ id: 'decor.candles', nameKey: 'item.decor.candles', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 70, model: 'deco.candles', scale: 2, renderTier: 'instanced' }),
  def({ id: 'decor.brazier', nameKey: 'item.decor.brazier', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 150, model: 'deco.brazier', scale: 1.68, renderTier: 'instanced' }),
  def({ id: 'decor.spirit-lantern', nameKey: 'item.decor.spirit-lantern', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 120, costStardust: 1, model: 'deco.spirit-lantern', scale: 1.9, renderTier: 'instanced' }),
  def({ id: 'decor.iron-fence', nameKey: 'item.decor.iron-fence', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 90, model: 'deco.iron-fence', scale: 1, renderTier: 'instanced' }),
  def({ id: 'decor.iron-gate', nameKey: 'item.decor.iron-gate', category: 'decor', tier: 12, footprint: { w: 1, d: 1 }, cost: 130, model: 'deco.iron-gate', scale: 1, renderTier: 'instanced' }),
  def({ id: 'income.mausoleum', nameKey: 'item.income.mausoleum', category: 'income', tier: 12, footprint: { w: 3, d: 3 }, cost: 3000, costStardust: 2, income: { ratePerMin: 46, cap: 2100 }, model: 'building.mausoleum', scale: 1.25, renderTier: 'unique' }),
  def({ id: 'home.keepers-crypt', nameKey: 'item.home.keepers-crypt', category: 'home', tier: 12, footprint: { w: 2, d: 2 }, cost: 2600, costStardust: 2, houses: 1, model: 'building.keepers-crypt', scale: 1.43, renderTier: 'unique' }),
  // ——— Tier 13 ———
  def({ id: 'nature.snow-pine', nameKey: 'item.nature.snow-pine', category: 'nature', tier: 13, footprint: { w: 1, d: 1 }, cost: 42, model: 'nature.snow-pine', scale: 1.4, renderTier: 'instanced' }),
  def({ id: 'nature.blue-spruce', nameKey: 'item.nature.blue-spruce', category: 'nature', tier: 13, footprint: { w: 1, d: 1 }, cost: 48, model: 'nature.spruce', scale: 1.7, renderTier: 'instanced' }),
  def({ id: 'nature.little-pine', nameKey: 'item.nature.little-pine', category: 'nature', tier: 13, footprint: { w: 1, d: 1 }, cost: 26, model: 'nature.pine-small', scale: 1.7, renderTier: 'instanced' }),
  def({ id: 'nature.ice-rock', nameKey: 'item.nature.ice-rock', category: 'nature', tier: 13, footprint: { w: 1, d: 1 }, cost: 22, model: 'nature.ice-rock', scale: 1.02, renderTier: 'instanced' }),
  def({ id: 'nature.snow-boulder', nameKey: 'item.nature.snow-boulder', category: 'nature', tier: 13, footprint: { w: 1, d: 1 }, cost: 20, model: 'nature.snow-boulder', scale: 1.13, renderTier: 'instanced' }),
  def({ id: 'decor.firewood', nameKey: 'item.decor.firewood', category: 'decor', tier: 13, footprint: { w: 1, d: 1 }, cost: 30, model: 'deco.firewood', scale: 1.34, renderTier: 'instanced' }),
  def({ id: 'decor.snow-log', nameKey: 'item.decor.snow-log', category: 'decor', tier: 13, footprint: { w: 2, d: 1 }, cost: 26, model: 'deco.snow-log', scale: 1.9, renderTier: 'instanced' }),
  def({ id: 'decor.warming-fire', nameKey: 'item.decor.warming-fire', category: 'decor', tier: 13, footprint: { w: 1, d: 1 }, cost: 55, model: 'deco.warming-fire', scale: 1.48, renderTier: 'instanced' }),
  def({ id: 'decor.frost-stump', nameKey: 'item.decor.frost-stump', category: 'decor', tier: 13, footprint: { w: 1, d: 1 }, cost: 16, model: 'deco.frost-stump', scale: 1.89, renderTier: 'instanced' }),
  def({ id: 'decor.camp-tent', nameKey: 'item.decor.camp-tent', category: 'decor', tier: 13, footprint: { w: 1, d: 1 }, cost: 60, costStardust: 1, model: 'deco.camp-tent', scale: 1.81, renderTier: 'unique' }),
  def({ id: 'ground.frozen-pond', nameKey: 'item.ground.frozen-pond', category: 'ground', tier: 13, footprint: { w: 1, d: 1 }, cost: 25, model: 'ground.frozen-pond', scale: 1, groundOverlay: true, renderTier: 'instanced' }),
  def({ id: 'home.log-cabin', nameKey: 'item.home.log-cabin', category: 'home', tier: 13, footprint: { w: 3, d: 3 }, cost: 2600, houses: 2, model: 'building.log-cabin', scale: 2.56, renderTier: 'unique' }),
  def({ id: 'home.alpine-chalet', nameKey: 'item.home.alpine-chalet', category: 'home', tier: 13, footprint: { w: 3, d: 3 }, cost: 3200, costStardust: 1, houses: 2, model: 'building.chalet', scale: 2.26, renderTier: 'unique' }),
  def({ id: 'income.warm-lodge', nameKey: 'item.income.warm-lodge', category: 'income', tier: 13, footprint: { w: 3, d: 3 }, cost: 4800, costStardust: 2, income: { ratePerMin: 44, cap: 2100 }, model: 'building.warm-lodge', scale: 2.37, renderTier: 'unique' }),
  def({ id: 'income.cocoa-stall', nameKey: 'item.income.cocoa-stall', category: 'income', tier: 13, footprint: { w: 2, d: 2 }, cost: 2200, income: { ratePerMin: 34, cap: 1600 }, model: 'building.cocoa-stall', scale: 1.9, renderTier: 'unique' }),
  // ——— Tier 14 ———
  def({ id: 'income.town-hall', nameKey: 'item.income.town-hall', category: 'income', tier: 14, footprint: { w: 3, d: 3 }, cost: 8500, costStardust: 3, income: { ratePerMin: 58, cap: 2400 }, model: 'building.town-hall', scale: 1.61, renderTier: 'unique' }),
  def({ id: 'income.grand-market', nameKey: 'item.income.grand-market', category: 'income', tier: 14, footprint: { w: 3, d: 3 }, cost: 5500, costStardust: 1, income: { ratePerMin: 48, cap: 2100 }, model: 'building.grand-market', scale: 1.42, renderTier: 'unique' }),
  def({ id: 'income.grain-mill', nameKey: 'item.income.grain-mill', category: 'income', tier: 14, footprint: { w: 2, d: 2 }, cost: 4800, costStardust: 1, income: { ratePerMin: 44, cap: 1950 }, model: 'building.grain-mill', scale: 1.49, renderTier: 'unique' }),
  def({ id: 'income.guildhall', nameKey: 'item.income.guildhall', category: 'income', tier: 14, footprint: { w: 2, d: 2 }, cost: 4200, income: { ratePerMin: 42, cap: 1850 }, model: 'building.guildhall', scale: 1.21, renderTier: 'unique' }),
  def({ id: 'income.mine', nameKey: 'item.income.mine', category: 'income', tier: 14, footprint: { w: 2, d: 2 }, cost: 3800, income: { ratePerMin: 40, cap: 1750 }, model: 'building.mine', scale: 1.47, renderTier: 'unique' }),
  def({ id: 'home.manor', nameKey: 'item.home.manor', category: 'home', tier: 14, footprint: { w: 3, d: 3 }, cost: 6000, costStardust: 2, houses: 2, model: 'building.manor', scale: 2.05, renderTier: 'unique' }),
  def({ id: 'home.townhouse', nameKey: 'item.home.townhouse', category: 'home', tier: 14, footprint: { w: 2, d: 2 }, cost: 4400, houses: 2, model: 'building.townhouse', scale: 1.46, renderTier: 'unique' }),
  def({ id: 'decor.castle', nameKey: 'item.decor.castle', category: 'decor', tier: 14, footprint: { w: 3, d: 3 }, cost: 7000, costStardust: 3, model: 'deco.castle', scale: 1.41, renderTier: 'unique' }),
  def({ id: 'decor.temple', nameKey: 'item.decor.temple', category: 'decor', tier: 14, footprint: { w: 2, d: 2 }, cost: 5000, costStardust: 2, model: 'deco.temple', scale: 1.02, renderTier: 'unique' }),
  def({ id: 'decor.grand-fountain', nameKey: 'item.decor.grand-fountain', category: 'decor', tier: 14, footprint: { w: 2, d: 2 }, cost: 2600, costStardust: 1, model: 'deco.grand-fountain', scale: 1, renderTier: 'unique' }),
  def({ id: 'decor.monument', nameKey: 'item.decor.monument', category: 'decor', tier: 14, footprint: { w: 2, d: 2 }, cost: 2800, costStardust: 1, model: 'deco.monument', scale: 1.59, renderTier: 'unique' }),
  def({ id: 'decor.clock-tower', nameKey: 'item.decor.clock-tower', category: 'decor', tier: 14, footprint: { w: 2, d: 2 }, cost: 3200, costStardust: 1, model: 'deco.clock-tower', scale: 2.38, renderTier: 'unique' }),
  def({ id: 'decor.market-square', nameKey: 'item.decor.market-square', category: 'decor', tier: 14, footprint: { w: 2, d: 2 }, cost: 2400, model: 'deco.market-square', scale: 1.01, renderTier: 'unique' }),
  def({ id: 'decor.town-gate', nameKey: 'item.decor.town-gate', category: 'decor', tier: 14, footprint: { w: 1, d: 1 }, cost: 1400, model: 'deco.town-gate', scale: 1.82, renderTier: 'instanced' }),
  def({ id: 'decor.grand-banner', nameKey: 'item.decor.grand-banner', category: 'decor', tier: 14, footprint: { w: 1, d: 1 }, cost: 800, model: 'deco.grand-banner', scale: 1.59, renderTier: 'instanced' }),
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
