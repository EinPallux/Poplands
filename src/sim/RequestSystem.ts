/**
 * Islander requests (post-1.0): each resident occasionally leaves a little wish for
 * something nearby — a tree, a lamp, a neighbour's home, a shop — that you grant by
 * placing a matching thing close to them. THREE.JS-FREE: it owns wish bookkeeping only
 * (ids + kinds + a spawn timer) and reads live resident positions through an injected
 * provider (same pull seam as WorldFx reads economy). Wishes are EPHEMERAL — they
 * re-roll each session, never persist, never expire, and ignoring one costs nothing
 * (the no-FOMO covenant). Granting fires a reward-event (Economy + Progression credit)
 * and a happy wave, exactly like fishing/garden rewards.
 */
import { bus } from '@/core/events';
import { mulberry32 } from '@/core/math';
import { itemDef } from '@/content/catalog';
import { footprintCenter } from '@/core/grid';
import {
  WISH_KINDS,
  WISH_REWARD,
  WISH_RADIUS,
  MAX_ACTIVE_WISHES,
  WISH_INTERVAL_S,
  type WishKind,
} from '@/content/requests';
import { islanderDef } from '@/content/roster';

interface Wish {
  id: string; // resident id
  kind: WishKind;
}

export class RequestSystem {
  private unsubs: Array<() => void> = [];
  private active = new Map<string, Wish>();
  private rng: () => number;
  private timer = WISH_INTERVAL_S * 0.5; // first wish comes a little sooner

  constructor(
    /** Live resident ids (monotonic roster from IslanderSystem). */
    private readonly residents: () => readonly string[],
    /** A resident's current world position, or null if not spawned. */
    private readonly positionOf: (id: string) => { x: number; z: number } | null,
    seed: number,
  ) {
    this.rng = mulberry32((seed ^ 0x7715c) >>> 0);
  }

  wire(): void {
    // granting = placing a matching thing near the wisher
    this.unsubs.push(bus.on('item:placed', (e) => this.onPlaced(e.def, e.wx, e.wz)));
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.active.clear();
  }

  /** Per-frame: roll a new wish now and then (timer-gated, never per frame's work). */
  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = WISH_INTERVAL_S;
    this.trySpawn();
  }

  /** The live wishes, for the thought-bubble layer + Album + debug. */
  snapshot(): Array<{ id: string; icon: string; wishKey: string }> {
    return [...this.active.values()].map((w) => ({ id: w.id, icon: w.kind.icon, wishKey: w.kind.wishKey }));
  }

  // ——— internals ———

  private trySpawn(): void {
    if (this.active.size >= MAX_ACTIVE_WISHES) return;
    // a present resident who isn't already wishing for something
    const free = this.residents().filter((id) => !this.active.has(id) && this.positionOf(id));
    if (free.length === 0) return;
    const id = free[Math.floor(this.rng() * free.length)]!;
    const kind = WISH_KINDS[Math.floor(this.rng() * WISH_KINDS.length)]!;
    this.active.set(id, { id, kind });
    const def = islanderDef(id);
    if (def) bus.emit('request:new', { id, nameKey: def.nameKey, icon: kind.icon, wishKey: kind.wishKey });
  }

  private onPlaced(defId: string, wx: number, wz: number): void {
    const def = itemDef(defId);
    if (!def || this.active.size === 0) return;
    const c = footprintCenter(wx, wz, def.footprint, 0); // rot irrelevant for a distance check
    for (const [id, wish] of this.active) {
      if (wish.kind.category !== def.category) continue;
      const pos = this.positionOf(id);
      if (!pos || Math.hypot(c.x - pos.x, c.z - pos.z) > WISH_RADIUS) continue;
      this.grant(id, wish, pos);
      return; // one placement grants at most one wish (the nearest match)
    }
  }

  private grant(id: string, wish: Wish, pos: { x: number; z: number }): void {
    this.active.delete(id);
    const rd = islanderDef(id);
    bus.emit('agent:playClip', { id, clip: 'emote-yes' }); // a happy wave
    bus.emit('npc:spoke', { id, textKey: wish.kind.thankKey });
    bus.emit('request:fulfilled', {
      id,
      nameKey: rd?.nameKey ?? wish.kind.wishKey,
      wx: Math.round(pos.x),
      wz: Math.round(pos.z),
      rewards: { pops: WISH_REWARD.pops, xp: WISH_REWARD.xp },
    });
  }

  // ——— debug (headless verification; ?debug=1 only) ———

  /** Force a wish onto a specific resident (or the first free one) for the harness. */
  debugNewWish(id?: string, category?: string): { id: string; category: string } | null {
    const pick = id ?? this.residents().find((r) => !this.active.has(r) && this.positionOf(r));
    if (!pick || this.active.has(pick) || !this.positionOf(pick)) return null;
    const kind = category ? WISH_KINDS.find((k) => k.category === category) : WISH_KINDS[0];
    if (!kind) return null;
    this.active.set(pick, { id: pick, kind });
    const def = islanderDef(pick);
    if (def) bus.emit('request:new', { id: pick, nameKey: def.nameKey, icon: kind.icon, wishKey: kind.wishKey });
    return { id: pick, category: kind.category };
  }

  debugWishes(): Array<{ id: string; category: string }> {
    return [...this.active.values()].map((w) => ({ id: w.id, category: w.kind.category }));
  }
}
