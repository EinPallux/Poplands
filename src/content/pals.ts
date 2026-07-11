/**
 * Pal roster (S18): the animals that scamper onto your island as it gets lively
 * (they're drawn to gardens). Content-as-data — `id` is a stable save contract,
 * `nameKey` routes the species name through the string table, `model` is a runtime
 * pet asset id (node-animated Cube Pets: idle/walk/run/eat/dance/gesture-*).
 */
import type { StringKey } from '@/core/strings';

export interface PalDef {
  id: string;
  nameKey: StringKey;
  model: string;
}

/** Adoption order — the first garden welcomes a cat, then a dog, … */
export const PALS: readonly PalDef[] = [
  { id: 'cat', nameKey: 'pal.cat.name', model: 'pal.cat' },
  { id: 'dog', nameKey: 'pal.dog.name', model: 'pal.dog' },
  { id: 'bunny', nameKey: 'pal.bunny.name', model: 'pal.bunny' },
  { id: 'chick', nameKey: 'pal.chick.name', model: 'pal.chick' },
  { id: 'pig', nameKey: 'pal.pig.name', model: 'pal.pig' },
  { id: 'cow', nameKey: 'pal.cow.name', model: 'pal.cow' },
];

/** Max Pals visible at once — the S18 DoD target (6 Pals at 60 fps). */
export const MAX_PALS = 6;

const byId = new Map<string, PalDef>(PALS.map((p) => [p.id, p]));

export function palDef(id: string): PalDef | undefined {
  return byId.get(id);
}
