/**
 * Quest runtime (S15): tutorial chain + rolling postcards + milestone counters.
 * THREE.JS-FREE. Mutates the passed `state` (save.quests) in place. Auto-complete
 * model (no claim button): predicate satisfied → complete() → quest:completed →
 * Economy/Progression credit rewards, presentation juices. Cozy & ignorable —
 * nothing is modal; the sandbox is always playable.
 */
import { bus } from '@/core/events';
import type { SaveQuests, CounterId } from '@/core/save';
import {
  TUTORIAL,
  POSTCARDS,
  MILESTONES,
  TUTORIAL_FIRST_ID,
  questDef,
  type QuestDef,
} from '@/content/quests';
import { itemDef } from '@/content/catalog';
import {
  evaluate,
  matchSelector,
  countOwned,
  selectorItemsExist,
  predicateSelectors,
  type EvalContext,
} from './predicates';
import type { IslandModel } from '@/world/IslandModel';

const POSTCARD_COOLDOWN_MS = 4000;

export class QuestSystem {
  private unsubs: Array<() => void> = [];
  private completing = new Set<string>(); // re-entrancy guard
  private lastCurrent = new Map<string, number>(); // for quest:progress dedupe
  private needsRefill = false; // a slot wants a card; gates the per-frame tick's pool scan

  constructor(
    private readonly island: IslandModel,
    private readonly state: SaveQuests,
    private level: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  wire(): void {
    this.unsubs.push(
      bus.on('item:placed', (e) => this.onPlaced(e)),
      bus.on('item:removed', (e) => this.onRemoved(e)),
      bus.on('income:collected', (e) => this.onCollected(e.amount)),
      bus.on('level:up', (e) => this.onLevel(e.level)),
      bus.on('secret:found', () => this.onSecretFound()),
      bus.on('cmd:skipPostcard', (e) => this.onSkip(e.id)),
    );
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  /** Re-emit persisted quests to the HUD and seed the first tutorial step on a
   *  fresh save. Called by GameState.start() after presentation subscribes. */
  announce(): void {
    if (this.state.tutorial.activeId) {
      this.offer(this.state.tutorial.activeId, true);
      this.evalAndMaybeComplete(this.state.tutorial.activeId);
    } else if (!this.state.freePlayUnlocked && this.state.tutorial.done.length === 0) {
      this.state.tutorial.activeId = TUTORIAL_FIRST_ID;
      this.offerTutorial(TUTORIAL_FIRST_ID);
    }
    for (const a of this.state.postcards.active) {
      this.offer(a.id, true);
      this.evalAndMaybeComplete(a.id);
    }
    if (this.state.freePlayUnlocked) this.drawPostcards();
  }

  private activeIds(): string[] {
    const ids = this.state.postcards.active.map((a) => a.id);
    if (this.state.tutorial.activeId) ids.push(this.state.tutorial.activeId);
    return ids;
  }

  private ctxFor(questId: string): EvalContext {
    return {
      counter: this.state.progress[questId] ?? 0,
      island: this.island,
      level: this.level,
      secrets: this.state.milestones.secretsFound ?? 0,
    };
  }

  // ——— event handlers ———

  private onPlaced(e: { def: string; silent?: boolean }): void {
    if (e.silent) return;
    this.bumpMilestone('itemsPlaced', 1);
    const def = itemDef(e.def);
    for (const id of this.activeIds()) {
      const q = questDef(id);
      if (q && q.predicate.kind === 'place' && def && matchSelector(def, q.predicate.sel)) {
        this.state.progress[id] = (this.state.progress[id] ?? 0) + 1;
      }
    }
    this.reevalActive();
  }

  private onRemoved(e: { silent?: boolean }): void {
    if (e.silent) return;
    this.reevalActive(); // own/adjacency snapshots may drop; completion never un-latches
  }

  private onCollected(amount: number): void {
    this.bumpMilestone('popsCollected', amount);
    for (const id of this.activeIds()) {
      const q = questDef(id);
      if (q && q.predicate.kind === 'collectPops') {
        this.state.progress[id] = (this.state.progress[id] ?? 0) + amount;
      }
    }
    this.reevalActive();
  }

  private onSecretFound(): void {
    this.bumpMilestone('secretsFound', 1);
    for (const id of this.activeIds()) {
      const q = questDef(id);
      if (q && q.predicate.kind === 'findSecret') {
        this.state.progress[id] = (this.state.progress[id] ?? 0) + 1;
      }
    }
    this.reevalActive();
  }

  private onLevel(level: number): void {
    // monotonic: a quest reward handled mid-cascade may have already advanced the
    // player further than this queued level:up payload — never regress (latent
    // until a reachLevel postcard exists, but cheap insurance for v0.4).
    this.level = Math.max(this.level, level);
    this.bumpMilestone('levelsGained', 1);
    this.reevalActive();
    this.drawPostcards();
  }

  private onSkip(id: string): void {
    const idx = this.state.postcards.active.findIndex((a) => a.id === id);
    if (idx < 0) return;
    this.state.postcards.active.splice(idx, 1);
    delete this.state.progress[id];
    this.lastCurrent.delete(id);
    if (!this.state.postcards.skipped.includes(id)) this.state.postcards.skipped.push(id);
    this.state.postcards.cooldownUntil = this.now() + POSTCARD_COOLDOWN_MS;
    bus.emit('quest:dismissed', { id }); // HUD drops the card immediately (no desync)
    this.drawPostcards();
  }

  /** Low-frequency tick (App loop): refill a freed postcard slot once its cooldown
   *  lapses. Gated by needsRefill so the steady-state per-frame cost is a boolean
   *  check — it only scans/sorts the pool when a slot actually wants a card and the
   *  cooldown has passed. Without the gate this re-filtered POSTCARDS every frame
   *  whenever a slot sat open with an exhausted pool (both reviewers flagged it). */
  tick(): void {
    if (!this.needsRefill || !this.state.freePlayUnlocked) return;
    if (this.state.postcards.active.length >= 2) {
      this.needsRefill = false;
      return;
    }
    if (this.now() < this.state.postcards.cooldownUntil) return; // wait out the cooldown cheaply
    this.drawPostcards();
  }

  private reevalActive(): void {
    for (const id of this.activeIds()) this.evalAndMaybeComplete(id);
  }

  private evalAndMaybeComplete(id: string): void {
    const q = questDef(id);
    if (!q || this.completing.has(id)) return;
    const r = evaluate(q.predicate, this.ctxFor(id));
    if (this.lastCurrent.get(id) !== r.current) {
      this.lastCurrent.set(id, r.current);
      bus.emit('quest:progress', { id, current: r.current, target: r.target });
    }
    if (r.done) this.complete(q);
  }

  private complete(q: QuestDef): void {
    if (this.completing.has(q.id)) return;
    this.completing.add(q.id);
    delete this.state.progress[q.id];
    this.lastCurrent.delete(q.id);

    if (q.kind === 'tutorial') {
      this.state.tutorial.done.push(q.id);
      this.state.tutorial.activeId = null;
    } else {
      const idx = this.state.postcards.active.findIndex((a) => a.id === q.id);
      if (idx >= 0) this.state.postcards.active.splice(idx, 1);
      this.state.postcards.done.push(q.id);
      this.state.postcards.cooldownUntil = this.now() + POSTCARD_COOLDOWN_MS;
    }

    this.bumpMilestone('questsDone', 1);
    bus.emit('quest:completed', {
      id: q.id,
      kind: q.kind,
      rewards: q.rewards,
      ...(q.nextId ? { nextId: q.nextId } : {}),
    });

    this.completing.delete(q.id);

    if (q.kind === 'tutorial') {
      if (q.nextId) {
        this.state.tutorial.activeId = q.nextId;
        this.offerTutorial(q.nextId);
      } else {
        this.state.freePlayUnlocked = true; // capstone → open the postcard pool
        this.drawPostcards();
      }
    } else {
      this.drawPostcards();
    }
  }

  private offerTutorial(id: string): void {
    this.seedProgress(id);
    this.offer(id);
    this.evalAndMaybeComplete(id); // may cascade-complete (bounded chain)
  }

  /** Seed a newly-offered quest's cumulative 'place' counter from already-owned
   *  matching items, so pre-existing work counts (forgiving; migrated islands
   *  skip ahead). collectPops/findSecret start at 0. */
  private seedProgress(id: string): void {
    const q = questDef(id);
    if (!q) return;
    if (q.predicate.kind === 'place') {
      const owned = countOwned(this.island, q.predicate.sel);
      this.state.progress[id] = Math.min(q.predicate.n, owned);
    }
  }

  private offer(id: string, silent = false): void {
    const q = questDef(id);
    if (!q) return;
    const r = evaluate(q.predicate, this.ctxFor(id));
    bus.emit('quest:offered', {
      id,
      kind: q.kind,
      titleKey: q.titleKey,
      descKey: q.descKey,
      current: r.current,
      target: r.target,
      rewards: q.rewards,
      ...(q.kind === 'tutorial' ? { step: TUTORIAL.findIndex((t) => t.id === id) + 1 } : {}),
      ...(silent ? { silent: true } : {}),
    });
  }

  /** Fill open postcard slots with the highest-priority eligible cards. */
  private drawPostcards(): void {
    if (!this.state.freePlayUnlocked) return;
    while (this.state.postcards.active.length < 2 && this.now() >= this.state.postcards.cooldownUntil) {
      const pick = this.eligiblePostcards()[0];
      if (!pick) break;
      this.state.postcards.active.push({ id: pick.id, progress: 0 });
      this.seedProgress(pick.id);
      this.offer(pick.id);
      this.evalAndMaybeComplete(pick.id);
    }
    // Re-arm the frame tick ONLY while a slot is open behind an unexpired cooldown
    // (time will let it draw). If the pool is exhausted at this level (cooldown lapsed,
    // nothing to draw), clear it so tick stops scanning until an event — level:up,
    // completion, or skip, each of which calls back here — re-arms it.
    this.needsRefill =
      this.state.postcards.active.length < 2 && this.now() < this.state.postcards.cooldownUntil;
  }

  private eligiblePostcards(): QuestDef[] {
    const { done, active, skipped } = this.state.postcards;
    return POSTCARDS.filter((p) => {
      if (this.level < (p.minLevel ?? 1) || this.level > (p.maxLevel ?? Infinity)) return false;
      if (done.includes(p.id) || active.some((a) => a.id === p.id)) return false;
      return predicateSelectors(p.predicate).every(selectorItemsExist);
    }).sort((a, b) => {
      // deprioritize skipped cards — a skip defers a card behind the fresh pool
      const sa = skipped.includes(a.id) ? 1 : 0;
      const sb = skipped.includes(b.id) ? 1 : 0;
      return sa - sb || (a.order ?? 0) - (b.order ?? 0);
    });
  }

  // ——— milestones (counters only in v0.3; Album UI is v0.6) ———

  private bumpMilestone(counter: CounterId, amount: number): void {
    this.state.milestones[counter] = (this.state.milestones[counter] ?? 0) + amount;
    for (const ms of MILESTONES) {
      if (ms.counter !== counter) continue;
      const claimed = this.state.milestoneTier[ms.id] ?? 0;
      for (let i = claimed; i < ms.tiers.length; i++) {
        if (this.state.milestones[counter] >= ms.tiers[i]!.at) {
          this.state.milestoneTier[ms.id] = i + 1;
          bus.emit('quest:completed', { id: `${ms.id}.${i}`, kind: 'milestone', rewards: ms.tiers[i]!.reward });
        }
      }
    }
  }

  snapshot(): SaveQuests {
    return this.state;
  }
}
