/**
 * UI-facing signals (S2/S21): thin mirrors of build/session state fed by the
 * event bus, consumed by DOM components via effects.
 */
import { signal } from '@/core/signals';
import { bus, type BlockReasonUi } from '@/core/events';
import type { BuildTool } from '@/build/BuildSession';

export const selectedDefSignal = signal<string | null>(null);
export const toolSignal = signal<BuildTool>('none');
export const carryingSignal = signal(false);
export const catalogOpenSignal = signal(true);
/** Item ids freshly unlocked by a level-up — badged in the catalog, cleared on view. */
export const catalogRevealSignal = signal<ReadonlySet<string>>(new Set());
/** Why the current placement ghost is invalid (S23 colour-blind cue), or null when valid/idle. */
export const ghostBlockedSignal = signal<BlockReasonUi | null>(null);

// — catalog search/filter (post-1.0): the build bar's search box + two toggles.
/** Live search text (matched against item display names, case-insensitive). */
export const catalogSearchSignal = signal('');
/** "Affordable only" toggle — hide items the player can't currently pay for. */
export const affordableOnlySignal = signal(false);
/** "Not placed" toggle — hide items already placed somewhere on the island. */
export const unplacedOnlySignal = signal(false);
/** Def ids currently on the island, kept fresh by App (place/remove) for the filter. */
export const placedDefsSignal = signal<ReadonlySet<string>>(new Set());

bus.on('build:modeChanged', ({ tool, carrying }) => {
  toolSignal.set(tool);
  carryingSignal.set(carrying ?? false);
  if (tool !== 'place') selectedDefSignal.set(null);
});

bus.on('build:ghostChanged', (g) => {
  ghostBlockedSignal.set(g && !g.valid ? (g.reason ?? null) : null);
});
