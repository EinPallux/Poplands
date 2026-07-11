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

/** Per-chunk secret kinds (S19, GDD §10 distribution). */
export type SecretKind = 'dig' | 'chest' | 'flora';

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

  // expansion commands (S7/S8, v0.4)
  'cmd:buyChunk': { cx: number; cz: number };
  'cmd:rerollSurveys': void;
  'cmd:clickSecret': { cx: number; cz: number };

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

  // expansion (S7/S8, v0.4): the F2 flow — survey → buy → land rises → new surveys
  'chunk:offered': { slots: Array<{ cx: number; cz: number; pops: number; stardust: number }> };
  'chunk:unlocked': { cx: number; cz: number; index: number }; // index = chunk count AFTER add
  'island:grew': void; // world visuals must rebuild for the new chunk shape (base/ground/outline)

  // secrets & discoveries (S19, v0.4): seeded per-chunk hidden things
  'secret:spawned': { cx: number; cz: number; kind: SecretKind; wx: number; wz: number };
  'secret:progress': { cx: number; cz: number; clicks: number; total: number; wx: number; wz: number };
  'secret:found': {
    cx: number;
    cz: number;
    kind: SecretKind;
    rewards: QuestReward;
    wx: number;
    wz: number;
  };

  // islanders (S16, v0.5): little neighbours who move in as the island gains homes
  'npc:arrived': { id: string; nameKey: StringKey }; // a resident moved in — juice + persist
  'cmd:clickNpc': { id: string }; // player tapped an Islander → greet
  'npc:spoke': { id: string; textKey: StringKey }; // show a speech bubble + chatter blip
  'agent:playClip': { id: string; clip: string }; // one-shot emote over the idle/walk blend

  // pals (S18, v0.5): animals that scamper in as the island gets lively
  'pal:adopted': { id: string; nameKey: StringKey }; // a Pal came to visit — juice + persist
  'cmd:clickPal': { id: string }; // player tapped a Pal → pet it
  'pal:petted': { id: string }; // a Pal was petted → hearts + happy sound

  // juice set-piece framing (S11): the chunk-arrival soft input-lock window
  'juice:setPieceStarted': { kind: 'chunk-arrival' };
  'juice:setPieceEnded': { kind: 'chunk-arrival' };

  // persistence
  'save:written': void;
  'save:loaded': void;

  // settings
  'settings:changed': void;
}

/** Why a placement is blocked, as surfaced to the UI (occupied/off-island/can't afford). */
export type BlockReasonUi = 'off-island' | 'occupied' | 'unaffordable';

export const bus = new EventBus<AppEvents>();
