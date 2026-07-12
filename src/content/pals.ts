/**
 * Pal roster (S18): the animals that scamper onto your island as it gets lively
 * (they're drawn to gardens). Content-as-data — `id` is a stable save contract,
 * `nameKey` routes the pet's given name through the string table, `icon` is the
 * species emoji, `model` is a runtime pet asset id (node-animated Cube Pets:
 * idle/walk/run/eat/dance/gesture-*). Two individuals of each species (each named)
 * make a fuller menagerie without new art — the six Cube Pet models are reused.
 */
import type { StringKey } from '@/core/strings';

export interface PalDef {
  id: string; // stable save contract — never rename
  nameKey: StringKey; // the pet's given name
  icon: string; // species emoji (album / toasts)
  model: string; // runtime Cube Pet asset id (shared across same-species Pals)
}

/** Adoption order — the first garden welcomes Marmalade the cat, then Biscuit… The
 *  first six ids are unchanged (older saves keep their Pals); six more follow. */
export const PALS: readonly PalDef[] = [
  { id: 'cat', nameKey: 'pal.cat.name', icon: '🐱', model: 'pal.cat' },
  { id: 'dog', nameKey: 'pal.dog.name', icon: '🐶', model: 'pal.dog' },
  { id: 'bunny', nameKey: 'pal.bunny.name', icon: '🐰', model: 'pal.bunny' },
  { id: 'chick', nameKey: 'pal.chick.name', icon: '🐤', model: 'pal.chick' },
  { id: 'pig', nameKey: 'pal.pig.name', icon: '🐷', model: 'pal.pig' },
  { id: 'cow', nameKey: 'pal.cow.name', icon: '🐮', model: 'pal.cow' },
  { id: 'cat2', nameKey: 'pal.cat2.name', icon: '🐱', model: 'pal.cat' },
  { id: 'dog2', nameKey: 'pal.dog2.name', icon: '🐶', model: 'pal.dog' },
  { id: 'bunny2', nameKey: 'pal.bunny2.name', icon: '🐰', model: 'pal.bunny' },
  { id: 'chick2', nameKey: 'pal.chick2.name', icon: '🐤', model: 'pal.chick' },
  { id: 'pig2', nameKey: 'pal.pig2.name', icon: '🐷', model: 'pal.pig' },
  { id: 'cow2', nameKey: 'pal.cow2.name', icon: '🐮', model: 'pal.cow' },
];

/** Max Pals visible at once — a full, lively menagerie (two of each species). */
export const MAX_PALS = 12;

const byId = new Map<string, PalDef>(PALS.map((p) => [p.id, p]));

export function palDef(id: string): PalDef | undefined {
  return byId.get(id);
}
