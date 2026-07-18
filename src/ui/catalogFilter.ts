/**
 * Catalog search/filter (post-1.0): a pure predicate deciding whether a catalog
 * item is visible under the current search text + toggle filters. Kept free of
 * DOM/signals so it's trivially unit-testable; the BuildBar feeds it live state.
 */
import type { ItemDef } from '@/content/catalog';

export interface CatalogFilter {
  /** Lowercased search text; empty matches everything. */
  query: string;
  /** Only items the player can currently afford (Pops + Stardust). */
  affordableOnly: boolean;
  /** Only items not already placed anywhere on the island. */
  unplacedOnly: boolean;
  pops: number;
  stardust: number;
  /** Def ids currently placed on the island (for the "not placed" filter). */
  placed: ReadonlySet<string>;
}

/** True if `def` (whose localized display name is `name`) passes every active filter. */
export function matchesCatalogFilter(def: ItemDef, name: string, f: CatalogFilter): boolean {
  if (f.query && !name.toLowerCase().includes(f.query)) return false;
  if (f.affordableOnly && (f.pops < def.cost || f.stardust < (def.costStardust ?? 0))) return false;
  if (f.unplacedOnly && f.placed.has(def.id)) return false;
  return true;
}
