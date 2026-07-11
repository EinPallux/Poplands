/**
 * Quest UI mirror (S15/S21): signals rebuilt from quest:* events, read by the
 * Mailbox. Presentation-only — the sim owns the authoritative state.
 */
import { signal } from '@/core/signals';
import { bus, type QuestKind, type QuestReward } from '@/core/events';
import type { StringKey } from '@/core/strings';

export interface QuestView {
  id: string;
  kind: QuestKind;
  titleKey: StringKey;
  descKey: StringKey;
  current: number;
  target: number;
  rewards: QuestReward;
  step?: number;
}

export const activeQuestsSignal = signal<readonly QuestView[]>([]);
export const freePlayUnlockedSignal = signal(false);

bus.on('quest:offered', (e) => {
  if (e.kind === 'milestone') return;
  const view: QuestView = {
    id: e.id,
    kind: e.kind,
    titleKey: e.titleKey,
    descKey: e.descKey,
    current: e.current,
    target: e.target,
    rewards: e.rewards,
    ...(e.step !== undefined ? { step: e.step } : {}),
  };
  activeQuestsSignal.update((list) => {
    const rest = list.filter((q) => q.id !== e.id);
    // tutorial first, then postcards, stable otherwise
    return [...rest, view].sort((a, b) => (a.kind === 'tutorial' ? -1 : 0) - (b.kind === 'tutorial' ? -1 : 0));
  });
});

bus.on('quest:progress', (e) => {
  activeQuestsSignal.update((list) =>
    list.map((q) => (q.id === e.id ? { ...q, current: e.current, target: e.target } : q)),
  );
});

bus.on('quest:completed', (e) => {
  if (e.kind === 'milestone') return;
  activeQuestsSignal.update((list) => list.filter((q) => q.id !== e.id));
});
