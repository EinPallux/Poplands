import { describe, it, expect } from 'vitest';
import { matchesCatalogFilter, type CatalogFilter } from '@/ui/catalogFilter';
import type { ItemDef } from '@/content/catalog';

/** Minimal ItemDef stub (the filter only reads id/cost/costStardust). */
function mk(id: string, cost: number, costStardust?: number): ItemDef {
  return {
    id,
    nameKey: 'app.title',
    category: 'nature',
    tier: 1,
    footprint: { w: 1, d: 1 },
    cost,
    model: 'x',
    scale: 1,
    renderTier: 'instanced',
    ...(costStardust !== undefined ? { costStardust } : {}),
  };
}

const base: CatalogFilter = {
  query: '',
  affordableOnly: false,
  unplacedOnly: false,
  pops: 0,
  stardust: 0,
  placed: new Set(),
};

describe('matchesCatalogFilter', () => {
  it('passes everything with no active filter', () => {
    expect(matchesCatalogFilter(mk('a', 999), 'Anything', base)).toBe(true);
  });

  it('matches the query against the display name (query is pre-lowercased)', () => {
    expect(matchesCatalogFilter(mk('a', 10), 'Little Tree', { ...base, query: 'tree' })).toBe(true);
    expect(matchesCatalogFilter(mk('a', 10), 'Little Tree', { ...base, query: 'roc' })).toBe(false);
    // caller lowercases; the helper lowercases the NAME so 'TREE' display still matches
    expect(matchesCatalogFilter(mk('a', 10), 'TREE', { ...base, query: 'tree' })).toBe(true);
  });

  it('hides items the player can’t afford when affordableOnly is on', () => {
    expect(matchesCatalogFilter(mk('a', 100), 'x', { ...base, affordableOnly: true, pops: 50 })).toBe(false);
    expect(matchesCatalogFilter(mk('a', 100), 'x', { ...base, affordableOnly: true, pops: 100 })).toBe(true);
    // Stardust is checked too
    expect(matchesCatalogFilter(mk('b', 0, 5), 'x', { ...base, affordableOnly: true, pops: 999, stardust: 3 })).toBe(
      false,
    );
    expect(matchesCatalogFilter(mk('b', 0, 5), 'x', { ...base, affordableOnly: true, pops: 999, stardust: 5 })).toBe(
      true,
    );
  });

  it('hides already-placed items when unplacedOnly is on', () => {
    const placed = new Set(['a']);
    expect(matchesCatalogFilter(mk('a', 10), 'x', { ...base, unplacedOnly: true, placed })).toBe(false);
    expect(matchesCatalogFilter(mk('c', 10), 'x', { ...base, unplacedOnly: true, placed })).toBe(true);
  });

  it('combines filters with AND semantics', () => {
    const f: CatalogFilter = {
      query: 'tree',
      affordableOnly: true,
      unplacedOnly: true,
      pops: 50,
      stardust: 0,
      placed: new Set(['b']),
    };
    // affordable + unplaced + name all satisfied
    expect(matchesCatalogFilter(mk('a', 40), 'Apple Tree', f)).toBe(true);
    // too expensive
    expect(matchesCatalogFilter(mk('a', 60), 'Apple Tree', f)).toBe(false);
    // already placed
    expect(matchesCatalogFilter(mk('b', 40), 'Apple Tree', f)).toBe(false);
    // name miss
    expect(matchesCatalogFilter(mk('a', 40), 'Round Bush', f)).toBe(false);
  });
});
