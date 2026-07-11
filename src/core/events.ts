/**
 * Typed event bus — the seam between simulation and presentation (TECH §3, S2).
 * Event names & payloads are compile-time checked against the app's EventMap.
 */

import type { StringKey } from './strings';

export type Handler<P> = (payload: P) => void;

/** Quest kinds and reward shape are shared across sim + presentation. */
export type QuestKind = 'tutorial' | 'postcard' | 'milestone';
export interface QuestReward {
  pops?: number;
  stardust?: number;
  xp?: number;
}

export class EventBus<M extends Record<string, unknown>> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  once<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    const off = this.on(event, (p) => {
      off();
      handler(p);
    });
    return off;
  }

  off<K extends keyof M>(event: K, handler: Handler<M[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) (h as Handler<M[K]>)(payload);
  }

  /** Dev aid: total live subscriptions (leak detector hooks onto this, S2). */
  get subscriptionCount(): number {
    let n = 0;
    for (const set of this.handlers.values()) n += set.size;
    return n;
  }
}

/**
 * The application event map grows as systems land.
 * Commands (cmd:*) flow UI→sim; domain events flow sim→presentation (TECH §3).
 */
export interface AppEvents extends Record<string, unknown> {
  'app:ready': void;
  'app:pause': void;
  'app:resume': { elapsedMs: number };
  'assets:progress': { phase: string; progress: number };
  'assets:phaseLoaded': { phase: string };
  'input:cellHover': { wx: number; wz: number } | null;
  'input:cellClick': { wx: number; wz: number };
  'input:rotate': void;
  'input:escape': void;
  'camera:moved': void;

  // build commands (UI/input → session)
  'cmd:selectItem': { defId: string | null };
  'cmd:setTool': { tool: 'place' | 'move' | 'remove' | 'none' };
  'cmd:collect': { placementId: string };
  'cmd:collectAll': void;
  'cmd:skipPostcard': { id: string };

  // domain events (sim → presentation)
  'item:placed': { id: string; def: string; wx: number; wz: number; rot: 0 | 1 | 2 | 3; silent?: boolean };
  'item:removed': { id: string; def: string; wx: number; wz: number; rot: 0 | 1 | 2 | 3; silent?: boolean };
  // a move re-drops an existing placement id — a distinct event so quests/XP
  // never count it as a fresh placement (the quest-farming exploit the critique found)
  'item:moved': { id: string; def: string; wx: number; wz: number; rot: 0 | 1 | 2 | 3 };
  'build:modeChanged': { tool: 'place' | 'move' | 'remove' | 'none'; carrying?: boolean };
  'build:ghostChanged': { valid: boolean; reason?: BlockReasonUi } | null;
  'build:rejected': { reason: BlockReasonUi };
  'island:changed': void;

  // economy (S13)
  'income:ripe': { placementId: string };
  'income:progress': { placementId: string; wx: number; wz: number; fill: number };
  'income:collected': {
    placementId?: string;
    amount: number;
    at: number;
    wx: number;
    wz: number;
    currency: 'pops' | 'stardust';
  };
  'wallet:changed': { pops: number; stardust: number };
  'purchase:denied': { reason: 'pops' | 'stardust' };

  // progression (S14)
  'xp:gained': { amount: number; source: 'place' | 'quest' | 'discovery'; level: number; xp: number };
  'level:up': {
    level: number;
    rewards: { pops: number; stardust: number };
    unlockedTier: number | null;
    newItems: string[];
    silent?: boolean;
  };

  // quests (S15)
  'quest:offered': {
    id: string;
    kind: QuestKind;
    titleKey: StringKey;
    descKey: StringKey;
    current: number;
    target: number;
    rewards: QuestReward;
    step?: number;
    silent?: boolean;
  };
  'quest:progress': { id: string; current: number; target: number };
  'quest:completed': { id: string; kind: QuestKind; rewards: QuestReward; nextId?: string };
  'quest:dismissed': { id: string }; // a postcard was skipped — HUD removes its card

  // persistence
  'save:written': void;
  'save:loaded': void;

  // settings
  'settings:changed': void;
}

/** Why a placement is blocked, as surfaced to the UI (occupied/off-island/can't afford). */
export type BlockReasonUi = 'off-island' | 'occupied' | 'unaffordable';

export const bus = new EventBus<AppEvents>();
