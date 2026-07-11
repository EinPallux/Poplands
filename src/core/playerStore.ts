/**
 * Player wallets & progression signals (S13/S14, TECH §10). Single-writer
 * discipline: EconomySystem owns pops/stardust; ProgressionSystem owns level/xp.
 * UI reads these via effects. xp is progress INTO the current level (not lifetime).
 */
import { signal, computed, type ReadonlySignal } from './signals';

export const popsSignal = signal(0);
export const stardustSignal = signal(0);
export const levelSignal = signal(1);
export const xpSignal = signal(0);

export const MAX_LEVEL = 20;

/** XP required to advance FROM level L to L+1 (S14 curve). Exposed for the derived progress signal. */
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round((60 * Math.pow(level, 1.55)) / 10) * 10;
}

/** 0..1 fraction into the current level — the LevelRing binds to this. */
export const levelProgressSignal: ReadonlySignal<number> = computed(() => {
  const need = xpToNext(levelSignal.get());
  if (!isFinite(need)) return 1;
  return Math.max(0, Math.min(1, xpSignal.get() / need));
});

export function loadWallet(p: { pops: number; stardust: number }): void {
  popsSignal.set(p.pops);
  stardustSignal.set(p.stardust);
}

export function snapshotWallet(): { pops: number; stardust: number } {
  return { pops: popsSignal.get(), stardust: stardustSignal.get() };
}

export function loadPlayer(p: { level: number; xp: number }): void {
  levelSignal.set(p.level);
  xpSignal.set(p.xp);
}
