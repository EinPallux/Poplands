/**
 * Progression runtime (S14): XP intake with a placement-idempotence ledger,
 * level advancement, and level-up reward emission. THREE.JS-FREE.
 *
 * Mutates the passed `player` slice IN PLACE (level/xp/xpGranted) so
 * GameState.collect's Object.assign(wallet) never clobbers it. Economy credits
 * the level:up rewards.pops/stardust; this system owns level/xp only.
 */
import { bus } from '@/core/events';
import { levelSignal, xpSignal } from '@/core/playerStore';
import { itemDef } from '@/content/catalog';
import { applyXp, placementXp, levelReward, tierUnlockedAt, itemsUnlockedAt, MAX_LEVEL } from './progression';

interface PlayerProgress {
  level: number;
  xp: number;
  xpGranted: string[];
}

export class ProgressionSystem {
  private granted: Set<string>;
  private unsubs: Array<() => void> = [];

  constructor(private readonly player: PlayerProgress) {
    this.granted = new Set(player.xpGranted);
  }

  /** Subscribe to XP sources. Called by GameState (kept out of the constructor
   *  so unit tests can drive grantXp directly without bus side-effects). */
  wire(): void {
    this.unsubs.push(
      bus.on('item:placed', (e) => {
        if (e.silent) return; // hydration / move-return — never XP
        if (this.granted.has(e.id)) return; // idempotent: re-placing an id is free
        const def = itemDef(e.def);
        if (!def) return;
        this.granted.add(e.id);
        this.player.xpGranted.push(e.id);
        this.grantXp(placementXp(def.cost), 'place');
      }),
      bus.on('quest:completed', (e) => {
        if (e.rewards.xp) this.grantXp(e.rewards.xp, 'quest');
      }),
    );
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  /** Single XP intake path. Writes state + signals BEFORE emitting so listeners read consistent state. */
  grantXp(amount: number, source: 'place' | 'quest' | 'discovery'): void {
    if (amount <= 0 || this.player.level >= MAX_LEVEL) return;
    const { level, xp, leveled } = applyXp({ level: this.player.level, xp: this.player.xp }, amount);
    this.player.level = level;
    this.player.xp = xp;
    levelSignal.set(level);
    xpSignal.set(xp);
    bus.emit('xp:gained', { amount, source, level, xp });
    for (const L of leveled) {
      bus.emit('level:up', {
        level: L,
        rewards: levelReward(L),
        unlockedTier: tierUnlockedAt(L),
        newItems: itemsUnlockedAt(L),
      });
    }
  }
}
