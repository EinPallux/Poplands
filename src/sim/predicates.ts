/**
 * Quest predicate DSL (S15) — pure evaluation over island/player state. No bus,
 * no three.js. Named quest shapes (place N, own N, reach level, adjacency…) all
 * reduce to these predicates so quests stay pure data (content/quests.ts).
 */
import { footprintCells, type Rot } from '@/core/grid';
import { itemDef, type ItemDef } from '@/content/catalog';
import type { ItemSelector, Predicate } from '@/content/quests';
import type { IslandModel, Placement } from '@/world/IslandModel';

export type { ItemSelector, Predicate };

export interface EvalContext {
  /** Cumulative per-quest counter (state.progress[questId]) for event-driven predicates. */
  counter: number;
  island: IslandModel;
  level: number;
  secrets: number;
}

export function matchSelector(def: ItemDef, sel: ItemSelector): boolean {
  if ('any' in sel) return true;
  if ('def' in sel) return def.id === sel.def;
  if ('defs' in sel) return sel.defs.includes(def.id);
  if ('cat' in sel) return def.category === sel.cat;
  if ('tier' in sel) return def.tier === sel.tier;
  return false;
}

/** True if every item id a selector names actually exists in the catalog. */
export function selectorItemsExist(sel: ItemSelector): boolean {
  if ('def' in sel) return itemDef(sel.def) !== undefined;
  if ('defs' in sel) return sel.defs.every((id) => itemDef(id) !== undefined);
  return true; // cat/tier/any are always valid
}

export function countOwned(island: IslandModel, sel: ItemSelector): number {
  let c = 0;
  for (const p of island.allPlacements()) {
    const def = itemDef(p.def);
    if (def && matchSelector(def, sel)) c++;
  }
  return c;
}

/** Min Chebyshev distance between two placements' footprint cells (0 = touching). */
function minChebyshev(a: Placement, b: Placement): number {
  const da = itemDef(a.def);
  const db = itemDef(b.def);
  if (!da || !db) return Infinity;
  const ca = footprintCells(a.wx, a.wz, da.footprint, a.rot as Rot);
  const cb = footprintCells(b.wx, b.wz, db.footprint, b.rot as Rot);
  let min = Infinity;
  for (const x of ca) {
    for (const y of cb) {
      const d = Math.max(Math.abs(x.wx - y.wx), Math.abs(x.wz - y.wz));
      if (d < min) min = d;
    }
  }
  return min;
}

/**
 * Count placements matching `a` that have at least one distinct placement
 * matching `b` within Chebyshev `dist`. ("N a's cozy next to a b.")
 */
export function countAdjacent(
  island: IslandModel,
  a: ItemSelector,
  b: ItemSelector,
  dist: number,
): number {
  const all = island.allPlacements();
  const as = all.filter((p) => {
    const d = itemDef(p.def);
    return d && matchSelector(d, a);
  });
  const bs = all.filter((p) => {
    const d = itemDef(p.def);
    return d && matchSelector(d, b);
  });
  let count = 0;
  for (const pa of as) {
    if (bs.some((pb) => pb.id !== pa.id && minChebyshev(pa, pb) <= dist)) count++;
  }
  return count;
}

export interface EvalResult {
  current: number;
  target: number;
  done: boolean;
}

export function evaluate(pred: Predicate, ctx: EvalContext): EvalResult {
  const done = (current: number, target: number): EvalResult => ({
    current: Math.min(current, target),
    target,
    done: current >= target,
  });
  switch (pred.kind) {
    case 'place':
      return done(ctx.counter, pred.n);
    case 'collectPops':
      return done(ctx.counter, pred.n);
    case 'findSecret':
      return done(ctx.counter, pred.n ?? 1);
    case 'own':
      return done(countOwned(ctx.island, pred.sel), pred.n);
    case 'reachLevel':
      return done(ctx.level, pred.level);
    case 'adjacency':
      return done(countAdjacent(ctx.island, pred.a, pred.b, pred.dist), pred.n ?? 1);
    case 'all': {
      const subs = pred.of.map((p) => evaluate(p, ctx));
      const doneCount = subs.filter((s) => s.done).length;
      return { current: doneCount, target: pred.of.length, done: subs.every((s) => s.done) };
    }
  }
}

/** True if a predicate advances via a cumulative counter (vs. a live snapshot). */
export function isCumulative(pred: Predicate): boolean {
  return pred.kind === 'place' || pred.kind === 'collectPops' || pred.kind === 'findSecret';
}

/** Every item selector referenced anywhere in a predicate (for existence checks). */
export function predicateSelectors(pred: Predicate): ItemSelector[] {
  switch (pred.kind) {
    case 'place':
    case 'own':
      return [pred.sel];
    case 'adjacency':
      return [pred.a, pred.b];
    case 'all':
      return pred.of.flatMap(predicateSelectors);
    default:
      return [];
  }
}
