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
  /** Catalog tier — gates availability once progression lands (v0.3). */
  tier: 1 | 2;
  footprint: Footprint;
  /** Pops. Display-only in v0.2; charged from v0.3. */
  cost: number;
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
  def({ id: 'income.stall', nameKey: 'item.income.stall', category: 'income', tier: 2, footprint: { w: 2, d: 2 }, cost: 100, model: 'building.stall', scale: 1.9, renderTier: 'unique' }),
  def({ id: 'home.hut', nameKey: 'item.home.hut', category: 'home', tier: 2, footprint: { w: 3, d: 3 }, cost: 150, model: 'building.hut', scale: 3.4, renderTier: 'unique' }),
  def({ id: 'home.house', nameKey: 'item.home.house', category: 'home', tier: 2, footprint: { w: 3, d: 4 }, cost: 400, model: 'building.house', scale: 3.0, renderTier: 'unique' }),
  def({ id: 'decor.lantern', nameKey: 'item.decor.lantern', category: 'decor', tier: 2, footprint: { w: 1, d: 1 }, cost: 25, model: 'deco.lantern', scale: 1, renderTier: 'instanced' }),
  def({ id: 'decor.fence.gate', nameKey: 'item.decor.fence.gate', category: 'decor', tier: 2, footprint: { w: 1, d: 1 }, cost: 15, model: 'deco.fence-gate', scale: 1, renderTier: 'instanced' }),
  def({ id: 'nature.clover', nameKey: 'item.nature.clover', category: 'nature', tier: 2, footprint: { w: 1, d: 1 }, cost: 10, model: 'nature.clover', scale: 2.2, renderTier: 'instanced' }),
  def({ id: 'nature.fern', nameKey: 'item.nature.fern', category: 'nature', tier: 2, footprint: { w: 1, d: 1 }, cost: 14, model: 'nature.fern', scale: 1.7, renderTier: 'instanced' }),
  def({ id: 'nature.pine', nameKey: 'item.nature.pine', category: 'nature', tier: 2, footprint: { w: 1, d: 1 }, cost: 30, model: 'nature.pine', scale: 1.6, renderTier: 'instanced' }),
  def({ id: 'decor.hedge', nameKey: 'item.decor.hedge', category: 'decor', tier: 2, footprint: { w: 1, d: 1 }, cost: 16, model: 'deco.hedge', scale: 1, renderTier: 'instanced' }),
] as const;

const byId = new Map(CATALOG.map((d) => [d.id, d]));

export function itemDef(id: string): ItemDef | undefined {
  return byId.get(id);
}

export const CATEGORIES: readonly Category[] = ['nature', 'decor', 'home', 'income', 'ground'];
