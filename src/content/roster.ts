/**
 * Islander roster (S16) as data: the little neighbours who move in as your island
 * gains homes. Each entry is a stable save contract — `id` is persisted in the
 * roster slice and never renamed after shipping; `nameKey` routes the display name
 * through the string table (i18n-ready, per the 2026-07-11 decision); `model` is a
 * runtime asset id (the 12 lit, skinned Pack-2 characters). More Islanders than
 * models is intentional — repeats read as a cozy small town, not a bug.
 *
 * Naming follows the GDD vocabulary exactly: these are Islanders (Pals arrive with
 * their own roster). Content-as-data: adding a neighbour = an entry here + a name
 * string, never a new code path.
 */
import type { StringKey } from '@/core/strings';

export interface IslanderDef {
  /** Stable persisted id (roster slice). Never rename after shipping. */
  id: string;
  /** Display name via the string table. */
  nameKey: StringKey;
  /** Runtime GLB asset id (npc.a … npc.l). */
  model: string;
}

const NPC_MODELS = [
  'npc.a',
  'npc.b',
  'npc.c',
  'npc.d',
  'npc.e',
  'npc.f',
  'npc.g',
  'npc.h',
  'npc.i',
  'npc.j',
  'npc.k',
  'npc.l',
] as const;

/** Roster order IS move-in order: the first home welcomes Mo, the second Pia, … */
const NAMES: ReadonlyArray<{ id: string; nameKey: StringKey }> = [
  { id: 'mo', nameKey: 'npc.mo.name' },
  { id: 'pia', nameKey: 'npc.pia.name' },
  { id: 'bram', nameKey: 'npc.bram.name' },
  { id: 'lulu', nameKey: 'npc.lulu.name' },
  { id: 'fen', nameKey: 'npc.fen.name' },
  { id: 'nix', nameKey: 'npc.nix.name' },
  { id: 'oda', nameKey: 'npc.oda.name' },
  { id: 'juno', nameKey: 'npc.juno.name' },
  { id: 'taro', nameKey: 'npc.taro.name' },
  { id: 'wren', nameKey: 'npc.wren.name' },
  { id: 'sol', nameKey: 'npc.sol.name' },
  { id: 'mika', nameKey: 'npc.mika.name' },
  { id: 'posy', nameKey: 'npc.posy.name' },
  { id: 'gus', nameKey: 'npc.gus.name' },
  { id: 'ivy', nameKey: 'npc.ivy.name' },
  { id: 'remy', nameKey: 'npc.remy.name' },
];

export const ISLANDERS: readonly IslanderDef[] = NAMES.map((n, i) => ({
  ...n,
  model: NPC_MODELS[i % NPC_MODELS.length]!,
}));

/** Active/visible Islander cap — the S16 DoD target (12 wanderers at 60 fps). */
export const MAX_ISLANDERS = 12;

const byId = new Map<string, IslanderDef>(ISLANDERS.map((d) => [d.id, d]));

export function islanderDef(id: string): IslanderDef | undefined {
  return byId.get(id);
}
