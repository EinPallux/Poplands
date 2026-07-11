/**
 * Secrets & discoveries runtime (S19). THREE.JS-FREE. Owns the per-chunk secret
 * roll + dig/chest/flora state machine, mutating the passed `secrets` slice
 * (save.secrets) in place. A secret spawns when a chunk arrives (and, on first
 * start, for the starter chunks a fresh/migrated save never rolled); clicking its
 * marker digs/opens it → rewards flow through the bus (S13 credits ● ✦, S14 grants
 * XP, S15 counts the findSecret quest). Nothing expires; found never un-latches.
 */
import { bus, type SecretKind } from '@/core/events';
import type { SaveSecret } from '@/core/save';
import { SECRETS, FIRST_SECRET_OVERRIDE, rollSecret, secretInstance } from '@/content/secrets';
import type { IslandModel } from '@/world/IslandModel';

const FIRST_BOUGHT_INDEX = 5; // the tutorial's first purchased chunk (starter = 4)

export class SecretSystem {
  private unsubs: Array<() => void> = [];

  constructor(
    private readonly island: IslandModel,
    private readonly secrets: SaveSecret[],
    private readonly seed: number,
  ) {}

  wire(): void {
    this.unsubs.push(
      bus.on('cmd:clickSecret', (e) => this.onClick(e.cx, e.cz)),
      bus.on('chunk:unlocked', (e) => this.onChunkUnlocked(e.cx, e.cz, e.index)),
    );
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  /** Seed any chunk that never rolled a secret (starter chunks on a fresh/migrated
   *  save; (0,0) is a guaranteed friendly dig), then re-announce every un-found
   *  secret so the HUD can render its marker. Called by GameState.start(). */
  announce(): void {
    for (const c of this.island.allChunks()) {
      const origin = c.cx === 0 && c.cz === 0;
      this.spawnFor(c.cx, c.cz, origin ? 'dig' : undefined, origin);
    }
    for (const s of this.secrets) {
      if (!s.found) bus.emit('secret:spawned', { cx: s.cx, cz: s.cz, kind: s.kind, wx: s.wx, wz: s.wz });
    }
  }

  snapshot(): SaveSecret[] {
    return this.secrets;
  }

  // ——— internals ———

  private at(cx: number, cz: number): SaveSecret | undefined {
    return this.secrets.find((s) => s.cx === cx && s.cz === cz);
  }

  /** Roll + record a chunk's secret (once). `generous` uses the tutorial override. */
  private spawnFor(cx: number, cz: number, forced: SecretKind | undefined, generous: boolean): void {
    if (this.at(cx, cz)) return; // already rolled — deterministic outcome persists
    const kind = rollSecret(this.seed, cx, cz, forced);
    if (!kind) return; // 50% of chunks have nothing (may host fireflies later)
    const inst = secretInstance(this.seed, cx, cz, kind, generous ? { ...FIRST_SECRET_OVERRIDE } : undefined);
    this.secrets.push({ cx, cz, kind, wx: inst.wx, wz: inst.wz, clicks: 0, found: false, reward: inst.reward });
    bus.emit('secret:spawned', { cx, cz, kind, wx: inst.wx, wz: inst.wz });
  }

  private onChunkUnlocked(cx: number, cz: number, index: number): void {
    // the first bought chunk always carries the tutorial dig (S19 DoD); the rest roll
    const first = index === FIRST_BOUGHT_INDEX;
    this.spawnFor(cx, cz, first ? 'dig' : undefined, first);
  }

  private onClick(cx: number, cz: number): void {
    const s = this.at(cx, cz);
    if (!s || s.found) return;
    s.clicks++;
    const total = SECRETS[s.kind].clicksToOpen;
    if (s.clicks < total) {
      bus.emit('secret:progress', { cx, cz, clicks: s.clicks, total, wx: s.wx, wz: s.wz });
      return;
    }
    s.found = true;
    bus.emit('secret:found', {
      cx,
      cz,
      kind: s.kind,
      rewards: { pops: s.reward.pops, stardust: s.reward.stardust, xp: s.reward.xp },
      wx: s.wx,
      wz: s.wz,
    });
  }
}
