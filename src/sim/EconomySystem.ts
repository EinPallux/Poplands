/**
 * Economy (S13) — wallets + income accrual. THREE.JS-FREE (sim layer).
 *
 * The single lazy formula `computeStored` makes offline earnings free with no
 * special case: it reads state without mutating, clamps to cap, and treats a
 * backward clock as "no accrual" (never a penalty). The 2 Hz tick only
 * edge-detects ripeness for presentation — it never writes accrual, so calling
 * it every step can't double-count. Lifecycle (onPlaced/onRemoved) is driven
 * imperatively by BuildSession's TRUE place/remove — never via the bus — so a
 * move (silent, same id) preserves ripening and never re-charges.
 */
import { bus } from '@/core/events';
import { footprintCenter } from '@/core/grid';
import { popsSignal, stardustSignal } from '@/core/playerStore';
import type { SaveEconomy } from '@/core/save';
import { itemDef, type ItemDef } from '@/content/catalog';
import type { IslandModel, Placement } from '@/world/IslandModel';
import { minChebyshev } from '@/sim/predicates';

/** How often a Pop Post sweeps its neighbourhood for ripe income (S13 convenience). */
const AUTO_COLLECT_INTERVAL_S = 4;

interface AccrualState {
  storedPops: number;
  lastCollectAt: number;
  wasFull: boolean;
  lastStep: number; // 0..3, for income:progress bubble steps
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * The one accrual formula. READ-ONLY. Exported for exhaustive unit testing.
 * elapsed<=0 (clock back / tampered future ts) → no accrual, no penalty.
 * huge elapsed → clamps to cap (this is why offline is free, not special-cased).
 */
export function computeStored(
  state: { storedPops: number; lastCollectAt: number },
  ratePerMs: number,
  cap: number,
  now: number,
): number {
  const elapsed = now - state.lastCollectAt;
  if (elapsed <= 0) return clamp(state.storedPops, 0, cap);
  return clamp(state.storedPops + ratePerMs * elapsed, 0, cap);
}

const ratePerMsOf = (def: ItemDef): number => (def.income ? def.income.ratePerMin / 60000 : 0);

export class EconomySystem {
  private accrual = new Map<string, AccrualState>();
  private tickAccum = 0;
  private autoCollectAccum = 0;

  constructor(
    private readonly island: IslandModel,
    private readonly now: () => number = () => Date.now(),
  ) {}

  // ——— wallets (single write path) ———

  canAfford(def: ItemDef): boolean {
    return popsSignal.get() >= def.cost && stardustSignal.get() >= (def.costStardust ?? 0);
  }

  /** Which wallet blocks a purchase (Pops checked first) — for the denial message. */
  shortWallet(def: ItemDef): 'pops' | 'stardust' {
    return popsSignal.get() < def.cost ? 'pops' : 'stardust';
  }

  /** Denial reason for a raw cost — Pops checked first, else Stardust is the blocker
   *  (S7 chunk purchase; only called after trySpend already failed). */
  shortOf(pops: number): 'pops' | 'stardust' {
    return popsSignal.get() < pops ? 'pops' : 'stardust';
  }

  charge(def: ItemDef): void {
    popsSignal.update((p) => p - def.cost);
    if (def.costStardust) stardustSignal.update((s) => s - (def.costStardust ?? 0));
    this.emitWallet();
  }

  /** 100% refund (GDD pillar 1). */
  refund(def: ItemDef): void {
    popsSignal.update((p) => p + def.cost);
    if (def.costStardust) stardustSignal.update((s) => s + (def.costStardust ?? 0));
    this.emitWallet();
  }

  /** Reward credit from level-ups (S14) and quests (S15). */
  credit(pops: number, stardust = 0): void {
    if (pops) popsSignal.update((p) => p + pops);
    if (stardust) stardustSignal.update((s) => s + stardust);
    if (pops || stardust) this.emitWallet();
  }

  /** Spend from both wallets iff affordable — atomic (chunk purchase, reroll fee,
   *  S7). Returns false WITHOUT mutating either wallet if short on either. */
  trySpend(pops: number, stardust = 0): boolean {
    if (popsSignal.get() < pops || stardustSignal.get() < stardust) return false;
    if (pops) popsSignal.update((p) => p - pops);
    if (stardust) stardustSignal.update((s) => s - stardust);
    if (pops || stardust) this.emitWallet();
    return true;
  }

  /** Subscribe to reward-bearing events so Economy is the SINGLE crediter
   *  (progression owns XP; quests own their own completion). Called by GameState. */
  wireRewards(): () => void {
    const offLevel = bus.on('level:up', (e) => {
      if (e.silent) return;
      this.credit(e.rewards.pops, e.rewards.stardust);
    });
    const offQuest = bus.on('quest:completed', (e) => {
      this.credit(e.rewards.pops ?? 0, e.rewards.stardust ?? 0);
    });
    const offSecret = bus.on('secret:found', (e) => {
      this.credit(e.rewards.pops ?? 0, e.rewards.stardust ?? 0);
    });
    const offFish = bus.on('fishing:caught', (e) => {
      this.credit(e.rewards.pops ?? 0, e.rewards.stardust ?? 0);
    });
    const offGift = bus.on('gift:claimed', (e) => {
      this.credit(e.rewards.pops ?? 0, e.rewards.stardust ?? 0);
    });
    const offMuseum = bus.on('museum:donated', (e) => {
      this.credit(e.rewards.pops ?? 0, e.rewards.stardust ?? 0);
    });
    const offHarvest = bus.on('garden:harvested', (e) => {
      this.credit(e.rewards.pops ?? 0, e.rewards.stardust ?? 0);
    });
    const offWish = bus.on('request:fulfilled', (e) => {
      this.credit(e.rewards.pops ?? 0, e.rewards.stardust ?? 0);
    });
    return () => {
      offLevel();
      offQuest();
      offSecret();
      offFish();
      offGift();
      offMuseum();
      offHarvest();
      offWish();
    };
  }

  private emitWallet(): void {
    bus.emit('wallet:changed', { pops: popsSignal.get(), stardust: stardustSignal.get() });
  }

  // ——— placement lifecycle (imperative — NOT bus-driven) ———

  onPlaced(p: Placement): void {
    const def = itemDef(p.def);
    if (!def?.income) return;
    if (!this.accrual.has(p.id)) {
      this.accrual.set(p.id, { storedPops: 0, lastCollectAt: this.now(), wasFull: false, lastStep: 0 });
    }
  }

  onRemoved(p: Placement): void {
    const def = itemDef(p.def);
    if (!def?.income) return;
    this.collect(p.id); // auto-bank ripe pops (cozy, no punishment)
    this.accrual.delete(p.id);
  }

  // ——— accrual reads ———

  ripeAmount(id: string, now = this.now()): number {
    const state = this.accrual.get(id);
    const p = this.island.placement(id);
    const def = p && itemDef(p.def);
    if (!state || !def?.income) return 0;
    return computeStored(state, ratePerMsOf(def), def.income.cap, now);
  }

  ripeFraction(id: string, now = this.now()): number {
    const p = this.island.placement(id);
    const def = p && itemDef(p.def);
    if (!def?.income) return 0;
    return def.income.cap > 0 ? this.ripeAmount(id, now) / def.income.cap : 0;
  }

  /** Debug only (headless verify): pin a building's banked Pops to a cap fraction,
   *  so the ripen-bubble threshold states are reachable without waiting on accrual.
   *  Seeds the accrual entry if it's missing (debug placement skips onPlaced). */
  debugRipen(id: string, frac = 1): void {
    const p = this.island.placement(id);
    const def = p && itemDef(p.def);
    if (!def?.income) return;
    let state = this.accrual.get(id);
    if (!state) {
      state = { storedPops: 0, lastCollectAt: this.now(), wasFull: false, lastStep: 0 };
      this.accrual.set(id, state);
    }
    state.storedPops = clamp(def.income.cap * frac, 0, def.income.cap);
    state.lastCollectAt = this.now(); // freeze the anchor so reads return ~storedPops
    state.wasFull = frac >= 1;
  }

  // ——— collection ———

  /** Bank a building's whole ripe Pops (fractional carry kept so nothing is lost). */
  collect(id: string, now = this.now()): number {
    const state = this.accrual.get(id);
    const p = this.island.placement(id);
    const def = p && itemDef(p.def);
    if (!state || !p || !def?.income) return 0;
    const exact = computeStored(state, ratePerMsOf(def), def.income.cap, now);
    const whole = Math.floor(exact);
    // A no-op collect must not touch the accrual anchor. Date.now() is not
    // monotonic — if the wall clock has jumped backward (NTP / manual change),
    // re-anchoring lastCollectAt to an earlier `now` would drag the anchor back
    // and over-credit when the clock recovers. Bailing here keeps the anchor at
    // the true last collection (backward-clock covenant); collectAll relies on
    // this since, unlike click-collect, it doesn't pre-gate on ripeAmount≥1.
    if (whole <= 0) return 0;
    state.storedPops = exact - whole; // carry the fraction
    state.lastCollectAt = now;
    state.wasFull = false;
    state.lastStep = 0;
    popsSignal.update((v) => v + whole);
    const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
    bus.emit('income:collected', {
      placementId: id,
      amount: whole,
      at: now,
      wx: c.x,
      wz: c.z,
      currency: 'pops',
    });
    this.emitWallet();
    return whole;
  }

  /** Collect every ripe building (Pop Post / collect-all). Each sprays its own arc. */
  collectAll(now = this.now()): number {
    let total = 0;
    for (const p of this.incomePlacements()) total += this.collect(p.id, now);
    return total;
  }

  /**
   * Pop Post sweep (GDD §7.2): for each placed auto-collector, bank the ripe income
   * of every income building whose footprint is within its `autoCollectRadius`
   * (Chebyshev blocks). Same `collect()` path as a manual tap — coin arcs, wallet
   * update, and backward-clock guard all apply. Returns total Pops banked.
   */
  autoCollect(now = this.now()): number {
    const all = this.island.allPlacements();
    const posts = all.filter((p) => (itemDef(p.def)?.autoCollectRadius ?? 0) > 0);
    if (posts.length === 0) return 0;
    const income = all.filter((p) => itemDef(p.def)?.income);
    let total = 0;
    const done = new Set<string>();
    for (const post of posts) {
      const radius = itemDef(post.def)!.autoCollectRadius!;
      for (const b of income) {
        if (done.has(b.id)) continue; // two overlapping posts never double-collect the same building
        if (minChebyshev(post, b) <= radius) {
          const got = this.collect(b.id, now);
          if (got > 0) total += got;
          done.add(b.id);
        }
      }
    }
    return total;
  }

  // ——— tick: ripe edge + progress steps (read-only, ~2 Hz) ———

  tick(dt: number): void {
    // Pop Post sweep (S13 convenience): banks ripe income near each auto-collector
    // every few seconds. Runs on the shared economy tick, independent of the 2 Hz gate.
    this.autoCollectAccum += dt;
    if (this.autoCollectAccum >= AUTO_COLLECT_INTERVAL_S) {
      this.autoCollectAccum = 0;
      this.autoCollect();
    }

    this.tickAccum += dt;
    if (this.tickAccum < 0.5) return;
    this.tickAccum = 0;
    const now = this.now();
    for (const p of this.incomePlacements()) {
      const state = this.accrual.get(p.id);
      if (!state) continue;
      const frac = this.ripeFraction(p.id, now);
      const step = frac >= 1 ? 3 : frac >= 0.66 ? 2 : frac >= 0.33 ? 1 : 0;
      if (step !== state.lastStep) {
        state.lastStep = step;
        const def = itemDef(p.def)!;
        const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
        bus.emit('income:progress', { placementId: p.id, wx: c.x, wz: c.z, fill: frac });
      }
      if (frac >= 1 && !state.wasFull) {
        state.wasFull = true;
        bus.emit('income:ripe', { placementId: p.id });
      } else if (frac < 1 && state.wasFull) {
        state.wasFull = false;
      }
    }
  }

  // ——— persistence ———

  /** Rebuild accrual from a save; seed any income placement missing an entry at
   *  load-now so pre-economy (migrated) buildings get NO retroactive windfall. */
  hydrate(saved: SaveEconomy | undefined, placements: Placement[]): void {
    this.accrual.clear();
    const now = this.now();
    for (const e of saved?.accrual ?? []) {
      this.accrual.set(e.id, {
        storedPops: e.storedPops,
        lastCollectAt: e.lastCollectAt,
        wasFull: false,
        lastStep: 0,
      });
    }
    for (const p of placements) {
      const def = itemDef(p.def);
      if (def?.income && !this.accrual.has(p.id)) {
        this.accrual.set(p.id, { storedPops: 0, lastCollectAt: now, wasFull: false, lastStep: 0 });
      }
    }
  }

  /** On load/resume: normalize tampered future timestamps; greet returning
   *  players with ripe bubbles. Adds NO pops (the lazy formula already did). */
  resolveOffline(now = this.now()): void {
    for (const p of this.incomePlacements()) {
      const state = this.accrual.get(p.id);
      if (!state) continue;
      if (state.lastCollectAt > now) state.lastCollectAt = now;
      const frac = this.ripeFraction(p.id, now);
      if (frac >= 1) {
        state.wasFull = true;
        state.lastStep = 3;
        bus.emit('income:ripe', { placementId: p.id });
      }
    }
  }

  snapshot(): SaveEconomy {
    return {
      accrual: [...this.accrual.entries()].map(([id, s]) => ({
        id,
        storedPops: s.storedPops,
        lastCollectAt: s.lastCollectAt,
      })),
    };
  }

  private incomePlacements(): Placement[] {
    return this.island.allPlacements().filter((p) => itemDef(p.def)?.income);
  }
}
