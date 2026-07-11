/**
 * UI-facing signals (S2/S21): thin mirrors of build/session state fed by the
 * event bus, consumed by DOM components via effects.
 */
import { signal } from '@/core/signals';
import { bus } from '@/core/events';
import type { BuildTool } from '@/build/BuildSession';

export const selectedDefSignal = signal<string | null>(null);
export const toolSignal = signal<BuildTool>('none');
export const carryingSignal = signal(false);
export const catalogOpenSignal = signal(true);
/** Item ids freshly unlocked by a level-up — badged in the catalog, cleared on view. */
export const catalogRevealSignal = signal<ReadonlySet<string>>(new Set());

bus.on('build:modeChanged', ({ tool, carrying }) => {
  toolSignal.set(tool);
  carryingSignal.set(carrying ?? false);
  if (tool !== 'place') selectedDefSignal.set(null);
});
