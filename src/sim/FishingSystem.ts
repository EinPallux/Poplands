/**
 * Fishing (post-1.0): the pond cast→nibble→catch minigame. THREE.JS-FREE (sim).
 *
 * One line at a time. Tapping a fishing-pond placement casts (a splash); after a
 * short random wait a fish nibbles; tapping again within a generous window reels
 * it in — a weighted roll latches the species into the collection and fires
 * `fishing:caught`, whose rewards Economy + Progression credit via the same
 * reward-event pattern as quests/secrets. Missing the window is gentle: the fish
 * "gets away", no penalty, recast freely (the no-fail covenant, GDD §7.5).
 *
 * Randomness is injected (mulberry32 by default) so unit tests pin exact outcomes.
 */
import { bus } from '@/core/events';
import { footprintCenter } from '@/core/grid';
import { mulberry32 } from '@/core/math';
import type { SaveFishing } from '@/core/save';
import { itemDef, type ItemDef } from '@/content/catalog';
import { rollFish } from '@/content/fish';
import type { IslandModel, Placement } from '@/world/IslandModel';

type Mode = 'idle' | 'waiting' | 'nibbling';

const WAIT_MIN = 1.6; // seconds of calm before a nibble
const WAIT_MAX = 4.2;
const NIBBLE_WINDOW = 3.0; // generous reel window — a miss is gentle, never a fail

export class FishingSystem {
  private mode: Mode = 'idle';
  private activePond: string | null = null;
  private timer = 0;
  private readonly caught: Map<string, number>;
  private total: number;
  private unsubs: Array<() => void> = [];

  constructor(
    private readonly island: IslandModel,
    save: SaveFishing,
    seed: number,
    private readonly rng: () => number = mulberry32((seed ^ 0xf1541) >>> 0),
  ) {
    this.caught = new Map(Object.entries(save.caught));
    this.total = save.total;
  }

  /** Subscribe to pond removal (App routes cmd:castLine → castLine). Called by
   *  GameState.start(). */
  wire(): void {
    this.unsubs.push(
      bus.on('item:removed', (e) => {
        if (e.id === this.activePond) this.reset(); // a pond torn up mid-cast cancels the line
      }),
    );
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  /** Pond tap: cast when idle, reel when a fish is nibbling. Ignored otherwise. */
  castLine(placementId: string): void {
    const p = this.island.placement(placementId);
    const def = p && itemDef(p.def);
    if (!p || !def || !def.fishing) return; // not a fishing pond
    if (this.mode === 'idle') {
      this.activePond = placementId;
      this.mode = 'waiting';
      this.timer = WAIT_MIN + this.rng() * (WAIT_MAX - WAIT_MIN);
      const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
      bus.emit('fishing:cast', { placementId, wx: c.x, wz: c.z });
    } else if (this.mode === 'nibbling' && placementId === this.activePond) {
      this.resolveCatch(p, def);
    }
    // 'waiting', or a tap on a different pond → ignored (one line at a time)
  }

  /** Advance the active cast's timers. Called each frame by App. */
  tick(dt: number): void {
    if (this.mode === 'idle') return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const p = this.activePond ? this.island.placement(this.activePond) : undefined;
    const def = p && itemDef(p.def);
    if (!p || !def || !def.fishing) {
      this.reset(); // the pond vanished under us
      return;
    }
    const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
    if (this.mode === 'waiting') {
      this.mode = 'nibbling';
      this.timer = NIBBLE_WINDOW;
      bus.emit('fishing:nibble', { placementId: p.id, wx: c.x, wz: c.z });
    } else {
      bus.emit('fishing:missed', { placementId: p.id, wx: c.x, wz: c.z }); // it got away — gentle
      this.reset();
    }
  }

  private resolveCatch(p: Placement, def: ItemDef): void {
    const fish = rollFish(this.rng());
    const prev = this.caught.get(fish.id) ?? 0;
    this.caught.set(fish.id, prev + 1);
    this.total += 1;
    const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
    bus.emit('fishing:caught', {
      fishId: fish.id,
      nameKey: fish.nameKey,
      icon: fish.icon,
      rarity: fish.rarity,
      rewards: { pops: fish.reward.pops, stardust: fish.reward.stardust ?? 0, xp: fish.reward.xp },
      isNew: prev === 0,
      wx: c.x,
      wz: c.z,
    });
    this.reset();
  }

  private reset(): void {
    this.mode = 'idle';
    this.activePond = null;
    this.timer = 0;
  }

  snapshot(): SaveFishing {
    return { caught: Object.fromEntries(this.caught), total: this.total };
  }

  /** Read-only view for the journal panel. */
  collection(): { caught: Record<string, number>; total: number; species: number } {
    return { caught: Object.fromEntries(this.caught), total: this.total, species: this.caught.size };
  }

  /** Current line state — for the debug HUD + headless verification. */
  get phase(): Mode {
    return this.mode;
  }

  /** Seconds left on the active timer — debug/verify only. */
  get remaining(): number {
    return this.timer;
  }

  /** Debug/verify: collapse the wait so the nibble fires on the next tick. */
  debugSkipWait(): void {
    if (this.mode === 'waiting') this.timer = 0;
  }
}
