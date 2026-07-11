/**
 * Islander chatter (S16): the cute one-liners a neighbour says when you tap them.
 * Content-as-data — lines are string keys (i18n-ready), picked at random. Kept
 * deliberately small, warm, and fourth-wall-cozy; add lines here + in the string
 * table, never a new code path. A matching emote clip plays with each line.
 */
import type { StringKey } from '@/core/strings';

export const CHATTER_LINES: readonly StringKey[] = [
  'npc.say.1',
  'npc.say.2',
  'npc.say.3',
  'npc.say.4',
  'npc.say.5',
  'npc.say.6',
  'npc.say.7',
  'npc.say.8',
  'npc.say.9',
  'npc.say.10',
  'npc.say.11',
  'npc.say.12',
  'npc.say.13',
  'npc.say.14',
];

/** Cute reaction clips to pair with a line (all present on the Pack-2 rig). */
export const CHATTER_EMOTES = ['emote-yes', 'interact-right', 'interact-left'] as const;
