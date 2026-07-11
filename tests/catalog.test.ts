import { describe, it, expect } from 'vitest';
import { CATALOG, itemDef } from '@/content/catalog';
import { ALL_QUESTS, type Predicate, type ItemSelector } from '@/content/quests';

function selectorIds(sel: ItemSelector): string[] {
  if ('def' in sel) return [sel.def];
  if ('defs' in sel) return [...sel.defs];
  return [];
}

function predicateIds(pred: Predicate): string[] {
  switch (pred.kind) {
    case 'place':
    case 'own':
      return selectorIds(pred.sel);
    case 'adjacency':
      return [...selectorIds(pred.a), ...selectorIds(pred.b)];
    case 'all':
      return pred.of.flatMap(predicateIds);
    default:
      return [];
  }
}

describe('catalog integrity', () => {
  it('every catalog item has a unique id', () => {
    const ids = CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every income item has a positive ratePerMin and cap', () => {
    for (const d of CATALOG) {
      if (d.category === 'income') {
        expect(d.income, `${d.id} missing income`).toBeDefined();
        expect(d.income!.ratePerMin).toBeGreaterThan(0);
        expect(d.income!.cap).toBeGreaterThan(0);
      }
    }
  });

  it('every quest-referenced item id exists in the catalog', () => {
    for (const q of ALL_QUESTS) {
      for (const id of predicateIds(q.predicate)) {
        expect(itemDef(id), `quest ${q.id} references missing item ${id}`).toBeDefined();
      }
    }
  });

  it('tiers are within 1..6', () => {
    for (const d of CATALOG) {
      expect(d.tier).toBeGreaterThanOrEqual(1);
      expect(d.tier).toBeLessThanOrEqual(6);
    }
  });
});
