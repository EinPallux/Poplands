/**
 * Secrets & discoveries (S19, GDD §10) as data. THREE.JS-FREE. A chunk's secret is
 * a deterministic seeded roll (same save-seed + coords → same secret forever), so
 * the save stores only the outcome + progress, never re-rolling on load.
 *
 * Distribution (GDD §10): dig 35% · chest 10% · flora 5% · nothing 50%.
 */
import { mulberry32 } from '@/core/math';
import type { SecretKind } from '@/core/events';

export interface SecretDef {
  clicksToOpen: number; // dig 3 (escalating poofs), chest/flora 1
  reward: { pops: readonly [number, number]; stardust: readonly [number, number]; xp: number };
  vfx: 'sparkle' | 'chest' | 'flora';
}

export const SECRETS: Readonly<Record<SecretKind, SecretDef>> = {
  dig: { clicksToOpen: 3, reward: { pops: [50, 150], stardust: [0, 1], xp: 20 }, vfx: 'sparkle' },
  chest: { clicksToOpen: 1, reward: { pops: [150, 400], stardust: [1, 3], xp: 40 }, vfx: 'chest' },
  flora: { clicksToOpen: 1, reward: { pops: [0, 0], stardust: [0, 1], xp: 25 }, vfx: 'flora' },
};

/** The tutorial's first bought chunk always yields a (more generous) dig. */
export const FIRST_SECRET_OVERRIDE = { pops: 100, stardust: 2, xp: 30 } as const;

// cumulative weights out of 100 (GDD §10)
const ROLL: ReadonlyArray<{ kind: SecretKind; upTo: number }> = [
  { kind: 'dig', upTo: 35 },
  { kind: 'chest', upTo: 45 },
  { kind: 'flora', upTo: 50 },
];

/** Deterministic per (saveSeed, chunk). Returns null for a chunk with no secret. */
export function rollSecret(seed: number, cx: number, cz: number, forced?: SecretKind): SecretKind | null {
  if (forced) return forced;
  const rng = mulberry32((seed ^ (cx * 374761393) ^ (cz * 668265263)) >>> 0);
  const r = rng() * 100;
  for (const b of ROLL) if (r < b.upTo) return b.kind;
  return null;
}

/** Seeded marker cell (interior of the chunk) + reward roll for a spawned secret. */
export function secretInstance(
  seed: number,
  cx: number,
  cz: number,
  kind: SecretKind,
  override?: { pops: number; stardust: number; xp: number },
): { wx: number; wz: number; reward: { pops: number; stardust: number; xp: number } } {
  const rng = mulberry32((seed ^ (cx * 2246822519) ^ (cz * 3266489917) ^ 0x9e3779b9) >>> 0);
  const def = SECRETS[kind];
  const pick = (r: readonly [number, number]): number => r[0] + Math.floor(rng() * (r[1] - r[0] + 1));
  const bx = 1 + Math.floor(rng() * 6); // interior cell 1..6 (off the very edge)
  const bz = 1 + Math.floor(rng() * 6);
  const reward = override ?? {
    pops: pick(def.reward.pops),
    stardust: pick(def.reward.stardust),
    xp: def.reward.xp,
  };
  return { wx: cx * 8 + bx, wz: cz * 8 + bz, reward };
}
