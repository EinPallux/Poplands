/**
 * Quest content (S15) as data: the tutorial chain, postcard pool, and milestone
 * counters. Predicate/selector TYPES live here (content layer) so the pure
 * evaluator (sim/predicates.ts) can import them without breaking layering.
 * Quest ids are STABLE save contracts — never rename after shipping.
 */
import type { StringKey } from '@/core/strings';
import type { QuestReward } from '@/core/events';
import type { Category } from '@/content/catalog';
import type { CounterId } from '@/core/save';

export type ItemSelector =
  | { def: string }
  | { defs: readonly string[] }
  | { cat: Category }
  | { tier: number }
  | { any: true };

export type Predicate =
  | { kind: 'place'; sel: ItemSelector; n: number }
  | { kind: 'own'; sel: ItemSelector; n: number }
  | { kind: 'collectPops'; n: number }
  | { kind: 'reachLevel'; level: number }
  | { kind: 'adjacency'; a: ItemSelector; b: ItemSelector; dist: number; n?: number }
  | { kind: 'findSecret'; n?: number }
  | { kind: 'chunks'; n: number } // own at least N chunks (expansion; live snapshot)
  | { kind: 'all'; of: readonly Predicate[] };

export interface QuestDef {
  id: string;
  kind: 'tutorial' | 'postcard';
  titleKey: StringKey;
  descKey: StringKey;
  predicate: Predicate;
  rewards: QuestReward;
  nextId?: string; // tutorial chain link
  minLevel?: number;
  maxLevel?: number;
  order?: number; // postcard draw priority (deterministic)
}

export interface MilestoneDef {
  id: string;
  counter: CounterId;
  labelKey: StringKey;
  tiers: ReadonlyArray<{ at: number; reward: QuestReward }>;
}

const FLOWERS = ['nature.flower.purple', 'nature.flower.red', 'nature.flower.yellow'] as const;
const PATHS = ['ground.path.dirt', 'ground.path.stone'] as const;

/**
 * "Welcome to the Drift" — 12 steps, v0.3-adapted (no chunks/islanders yet).
 * Each build step also grants XP so the tutorial itself funds the reachLevel
 * checkpoints (L2 = 60 XP, L3 = 240 XP): the rewards below sum to ~208 XP which,
 * with the ~37 placement-XP the mandated builds earn, lands the player at L3 as
 * they finish — no grind wall, honouring the no-grind covenant (GDD §7.5).
 */
export const TUTORIAL: readonly QuestDef[] = [
  { id: 'tut.flowers', kind: 'tutorial', titleKey: 'quest.tut.flowers.t', descKey: 'quest.tut.flowers.d', predicate: { kind: 'place', sel: { defs: FLOWERS }, n: 3 }, rewards: { pops: 30, xp: 12 }, nextId: 'tut.path' },
  { id: 'tut.path', kind: 'tutorial', titleKey: 'quest.tut.path.t', descKey: 'quest.tut.path.d', predicate: { kind: 'place', sel: { defs: PATHS }, n: 3 }, rewards: { pops: 25, xp: 12 }, nextId: 'tut.bench' },
  { id: 'tut.bench', kind: 'tutorial', titleKey: 'quest.tut.bench.t', descKey: 'quest.tut.bench.d', predicate: { kind: 'place', sel: { def: 'decor.bench' }, n: 1 }, rewards: { pops: 40, xp: 15 }, nextId: 'tut.stall' },
  { id: 'tut.stall', kind: 'tutorial', titleKey: 'quest.tut.stall.t', descKey: 'quest.tut.stall.d', predicate: { kind: 'place', sel: { def: 'income.stall' }, n: 1 }, rewards: { pops: 60, xp: 22 }, nextId: 'tut.collect' },
  { id: 'tut.collect', kind: 'tutorial', titleKey: 'quest.tut.collect.t', descKey: 'quest.tut.collect.d', predicate: { kind: 'collectPops', n: 1 }, rewards: { pops: 25, xp: 12 }, nextId: 'tut.hut' },
  { id: 'tut.hut', kind: 'tutorial', titleKey: 'quest.tut.hut.t', descKey: 'quest.tut.hut.d', predicate: { kind: 'place', sel: { def: 'home.hut' }, n: 1 }, rewards: { pops: 80, xp: 30 }, nextId: 'tut.cozycorner' },
  { id: 'tut.cozycorner', kind: 'tutorial', titleKey: 'quest.tut.cozycorner.t', descKey: 'quest.tut.cozycorner.d', predicate: { kind: 'adjacency', a: { def: 'decor.lantern' }, b: { def: 'home.hut' }, dist: 2, n: 1 }, rewards: { pops: 20, xp: 12 }, nextId: 'tut.lanterns' },
  { id: 'tut.lanterns', kind: 'tutorial', titleKey: 'quest.tut.lanterns.t', descKey: 'quest.tut.lanterns.d', predicate: { kind: 'place', sel: { def: 'decor.lantern' }, n: 2 }, rewards: { pops: 40, xp: 20 }, nextId: 'tut.level2' },
  { id: 'tut.level2', kind: 'tutorial', titleKey: 'quest.tut.level2.t', descKey: 'quest.tut.level2.d', predicate: { kind: 'reachLevel', level: 2 }, rewards: { stardust: 3, xp: 28 }, nextId: 'tut.pops150' },
  { id: 'tut.pops150', kind: 'tutorial', titleKey: 'quest.tut.pops150.t', descKey: 'quest.tut.pops150.d', predicate: { kind: 'collectPops', n: 150 }, rewards: { pops: 50, xp: 45 }, nextId: 'tut.level3' },
  { id: 'tut.level3', kind: 'tutorial', titleKey: 'quest.tut.level3.t', descKey: 'quest.tut.level3.d', predicate: { kind: 'reachLevel', level: 3 }, rewards: { pops: 60, xp: 30 }, nextId: 'tut.capstone' },
  { id: 'tut.capstone', kind: 'tutorial', titleKey: 'quest.tut.capstone.t', descKey: 'quest.tut.capstone.d', predicate: { kind: 'own', sel: { any: true }, n: 30 }, rewards: { pops: 100, stardust: 2, xp: 50 }, nextId: 'tut.callchunk' },
  // v0.4 finale — the first-10-minutes contract closes on the first chunk + first secret.
  { id: 'tut.callchunk', kind: 'tutorial', titleKey: 'quest.tut.callchunk.t', descKey: 'quest.tut.callchunk.d', predicate: { kind: 'chunks', n: 5 }, rewards: { pops: 60, xp: 20 }, nextId: 'tut.secret' },
  { id: 'tut.secret', kind: 'tutorial', titleKey: 'quest.tut.secret.t', descKey: 'quest.tut.secret.d', predicate: { kind: 'findSecret', n: 1 }, rewards: { pops: 100, stardust: 2, xp: 30 } },
];

export const TUTORIAL_FIRST_ID = TUTORIAL[0]!.id;

/** Rolling postcard pool (max 2 active). Draw order = array order. */
export const POSTCARDS: readonly QuestDef[] = [
  { id: 'pc.grove', kind: 'postcard', titleKey: 'quest.pc.grove.t', descKey: 'quest.pc.grove.d', predicate: { kind: 'place', sel: { def: 'nature.tree' }, n: 5 }, rewards: { pops: 40, xp: 15 }, minLevel: 1, order: 1 },
  { id: 'pc.paved', kind: 'postcard', titleKey: 'quest.pc.paved.t', descKey: 'quest.pc.paved.d', predicate: { kind: 'place', sel: { cat: 'ground' }, n: 8 }, rewards: { pops: 30, xp: 12 }, minLevel: 1, order: 2 },
  { id: 'pc.blooming', kind: 'postcard', titleKey: 'quest.pc.blooming.t', descKey: 'quest.pc.blooming.d', predicate: { kind: 'place', sel: { cat: 'nature' }, n: 10 }, rewards: { pops: 50, xp: 20 }, minLevel: 2, order: 3 },
  { id: 'pc.cozycorner', kind: 'postcard', titleKey: 'quest.pc.cozycorner.t', descKey: 'quest.pc.cozycorner.d', predicate: { kind: 'adjacency', a: { def: 'decor.bench' }, b: { def: 'decor.lantern' }, dist: 2 }, rewards: { pops: 40, xp: 15 }, minLevel: 2, order: 4 },
  { id: 'pc.firstearnings', kind: 'postcard', titleKey: 'quest.pc.firstearnings.t', descKey: 'quest.pc.firstearnings.d', predicate: { kind: 'collectPops', n: 200 }, rewards: { pops: 40, xp: 20 }, minLevel: 2, order: 5 },
  { id: 'pc.homeward', kind: 'postcard', titleKey: 'quest.pc.homeward.t', descKey: 'quest.pc.homeward.d', predicate: { kind: 'own', sel: { cat: 'home' }, n: 2 }, rewards: { pops: 70, xp: 25 }, minLevel: 3, order: 6 },
  { id: 'pc.greenthumb', kind: 'postcard', titleKey: 'quest.pc.greenthumb.t', descKey: 'quest.pc.greenthumb.d', predicate: { kind: 'own', sel: { cat: 'nature' }, n: 20 }, rewards: { pops: 60, xp: 25 }, minLevel: 3, order: 7 },
  { id: 'pc.farmlife', kind: 'postcard', titleKey: 'quest.pc.farmlife.t', descKey: 'quest.pc.farmlife.d', predicate: { kind: 'own', sel: { defs: ['income.pumpkin-patch', 'income.wheat-field'] }, n: 1 }, rewards: { pops: 60, xp: 20 }, minLevel: 3, order: 8 },
  { id: 'pc.tidysum', kind: 'postcard', titleKey: 'quest.pc.tidysum.t', descKey: 'quest.pc.tidysum.d', predicate: { kind: 'collectPops', n: 500 }, rewards: { pops: 80, xp: 30 }, minLevel: 4, order: 9 },
  { id: 'pc.village', kind: 'postcard', titleKey: 'quest.pc.village.t', descKey: 'quest.pc.village.d', predicate: { kind: 'all', of: [{ kind: 'own', sel: { cat: 'home' }, n: 3 }, { kind: 'own', sel: { cat: 'income' }, n: 3 }] }, rewards: { pops: 120, stardust: 3 }, minLevel: 5, order: 10 },
  { id: 'pc.treasure', kind: 'postcard', titleKey: 'quest.pc.treasure.t', descKey: 'quest.pc.treasure.d', predicate: { kind: 'findSecret', n: 1 }, rewards: { pops: 60, stardust: 1, xp: 20 }, minLevel: 4, order: 11 },
];

/** Lifetime milestones — counters persist in v0.3; the Album UI arrives in v0.6. */
export const MILESTONES: readonly MilestoneDef[] = [
  { id: 'ms.placed', counter: 'itemsPlaced', labelKey: 'quest.ms.placed', tiers: [
    { at: 25, reward: { stardust: 2 } },
    { at: 100, reward: { stardust: 3 } },
    { at: 300, reward: { stardust: 5 } },
  ] },
  { id: 'ms.pops', counter: 'popsCollected', labelKey: 'quest.ms.pops', tiers: [
    { at: 1000, reward: { stardust: 2 } },
    { at: 10000, reward: { stardust: 4 } },
  ] },
  { id: 'ms.quests', counter: 'questsDone', labelKey: 'quest.ms.quests', tiers: [
    { at: 10, reward: { stardust: 3 } },
    { at: 25, reward: { stardust: 5 } },
  ] },
];

const questById = new Map<string, QuestDef>();
for (const q of [...TUTORIAL, ...POSTCARDS]) questById.set(q.id, q);

export function questDef(id: string): QuestDef | undefined {
  return questById.get(id);
}

export const ALL_QUESTS: readonly QuestDef[] = [...TUTORIAL, ...POSTCARDS];
