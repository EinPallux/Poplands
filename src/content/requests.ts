/**
 * Islander requests (post-1.0): the little wishes a neighbour leaves — "Rosie would
 * love a tree nearby" — that you grant by placing a matching thing close to them, for
 * a small reward + a happy wave. THREE.JS-FREE data only; the RequestSystem drives them.
 *
 * Wishes are by item CATEGORY (not a specific building) so they're always grantable
 * with something cheap you already have — no-grind, no dead-ends. Purely cozy: a wish
 * never expires or nags, and ignoring it costs nothing.
 */
import type { Category } from '@/content/catalog';
import type { StringKey } from '@/core/strings';

export interface WishKind {
  category: Category; // the kind of thing to place nearby to grant it
  icon: string; // shown in the thought bubble + toast
  wishKey: StringKey; // "{name} would love a tree nearby" (name filled by the UI)
  thankKey: StringKey; // the neighbour's thank-you line on granting
}

/** The wishable categories — a leafy plant, a pretty decoration, a neighbour's home,
 *  or a little shop. Ground/paths aren't wished for. */
export const WISH_KINDS: readonly WishKind[] = [
  { category: 'nature', icon: '🌳', wishKey: 'wish.nature', thankKey: 'wish.thanks.nature' },
  { category: 'decor', icon: '✨', wishKey: 'wish.decor', thankKey: 'wish.thanks.decor' },
  { category: 'home', icon: '🏡', wishKey: 'wish.home', thankKey: 'wish.thanks.home' },
  { category: 'income', icon: '🛍️', wishKey: 'wish.income', thankKey: 'wish.thanks.income' },
];

/** Reward for granting a wish (modest — the joy is the point, not the payout). */
export const WISH_REWARD = { pops: 40, xp: 15 } as const;

/** How close "nearby" is (blocks, from the neighbour's current spot). */
export const WISH_RADIUS = 6;
/** At most this many wishes float at once, so the island never feels naggy. */
export const MAX_ACTIVE_WISHES = 2;
/** Seconds between wish rolls (a new wish only if a slot + a wishless resident exist). */
export const WISH_INTERVAL_S = 45;
