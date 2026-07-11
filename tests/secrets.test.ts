import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rollSecret, secretInstance, SECRETS, FIRST_SECRET_OVERRIDE } from '@/content/secrets';
import { SecretSystem } from '@/sim/SecretSystem';
import { IslandModel } from '@/world/IslandModel';
import { bus, type SecretKind } from '@/core/events';
import type { SaveSecret } from '@/core/save';

describe('rollSecret distribution (S19 DoD, GDD §10)', () => {
  it('matches dig 35% · chest 10% · flora 5% · none 50% within ±2% over 20k chunks', () => {
    const counts: Record<string, number> = { dig: 0, chest: 0, flora: 0, none: 0 };
    let n = 0;
    for (let cx = 0; cx < 200; cx++) {
      for (let cz = 0; cz < 100; cz++) {
        const k = rollSecret(1337, cx, cz);
        counts[k ?? 'none']!++;
        n++;
      }
    }
    expect(n).toBe(20000);
    expect(Math.abs(counts.dig! / n - 0.35)).toBeLessThan(0.02);
    expect(Math.abs(counts.chest! / n - 0.1)).toBeLessThan(0.02);
    expect(Math.abs(counts.flora! / n - 0.05)).toBeLessThan(0.02);
    expect(Math.abs(counts.none! / n - 0.5)).toBeLessThan(0.02);
  });

  it('is deterministic per (seed, chunk) and a forced kind overrides the roll', () => {
    expect(rollSecret(42, 3, 7)).toBe(rollSecret(42, 3, 7));
    expect(rollSecret(42, 3, 7, 'meadow', 'chest')).toBe('chest');
    // a different seed can change the outcome (not asserting which)
    const a = rollSecret(1, 5, 5);
    const b = rollSecret(2, 5, 5);
    expect(typeof (a ?? 'none')).toBe('string');
    expect(typeof (b ?? 'none')).toBe('string');
  });

  it('biome tables reshuffle the kind but hold "nothing" at ~50% (economy-safe)', () => {
    const tally = (theme: 'meadow' | 'sandbar' | 'spooky' | 'snowcap') => {
      const c: Record<string, number> = { dig: 0, chest: 0, flora: 0, none: 0 };
      let n = 0;
      for (let cx = 0; cx < 200; cx++)
        for (let cz = 0; cz < 100; cz++) {
          c[rollSecret(1337, cx, cz, theme) ?? 'none']!++;
          n++;
        }
      return { c, n };
    };
    // every biome keeps the ~50% nothing slice → island-wide secret rate is unchanged
    for (const th of ['sandbar', 'spooky', 'snowcap'] as const) {
      const { c, n } = tally(th);
      expect(Math.abs(c.none! / n - 0.5)).toBeLessThan(0.02);
    }
    // …but the winning kind shifts by biome (flavor)
    expect(Math.abs(tally('sandbar').c.dig! / 20000 - 0.42)).toBeLessThan(0.02); // beachcombing
    expect(Math.abs(tally('spooky').c.chest! / 20000 - 0.25)).toBeLessThan(0.02); // haunted chests
    expect(Math.abs(tally('snowcap').c.flora! / 20000 - 0.2)).toBeLessThan(0.02); // rare flora
  });

  it('secretInstance places the marker on an interior cell and is deterministic', () => {
    const inst = secretInstance(9, 2, 3, 'dig');
    expect(inst).toEqual(secretInstance(9, 2, 3, 'dig'));
    const bx = inst.wx - 2 * 8;
    const bz = inst.wz - 3 * 8;
    expect(bx).toBeGreaterThanOrEqual(1);
    expect(bx).toBeLessThanOrEqual(6);
    expect(bz).toBeGreaterThanOrEqual(1);
    expect(bz).toBeLessThanOrEqual(6);
  });
});

describe('SecretSystem (S19 runtime)', () => {
  let island: IslandModel;
  let secrets: SaveSecret[];
  let sys: SecretSystem;
  let spawned: Array<{ cx: number; cz: number; kind: SecretKind }>;
  let progress: Array<{ clicks: number; total: number }>;
  let found: Array<{ kind: SecretKind; rewards: { pops?: number; stardust?: number; xp?: number } }>;
  const offs: Array<() => void> = [];

  beforeEach(() => {
    island = new IslandModel([
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
      { cx: 0, cz: 1 },
      { cx: 1, cz: 1 },
    ]);
    secrets = [];
    sys = new SecretSystem(island, secrets, 555);
    sys.wire();
    spawned = [];
    progress = [];
    found = [];
    offs.push(bus.on('secret:spawned', (e) => spawned.push(e)));
    offs.push(bus.on('secret:progress', (e) => progress.push(e)));
    offs.push(bus.on('secret:found', (e) => found.push(e)));
  });

  afterEach(() => {
    sys.dispose();
    for (const off of offs) off();
    offs.length = 0;
  });

  it('seeds starter chunks on announce and forces a generous dig at the origin', () => {
    sys.announce();
    const origin = secrets.find((s) => s.cx === 0 && s.cz === 0);
    expect(origin).toBeDefined();
    expect(origin!.kind).toBe('dig');
    expect(origin!.reward).toEqual(FIRST_SECRET_OVERRIDE); // {pops:100, stardust:2, xp:30}
    expect(spawned.some((e) => e.cx === 0 && e.cz === 0)).toBe(true);
  });

  it('a dig takes 3 clicks: two progress bumps, then found with its reward', () => {
    sys.announce(); // (0,0) is a forced dig
    expect(SECRETS.dig.clicksToOpen).toBe(3);
    bus.emit('cmd:clickSecret', { cx: 0, cz: 0 });
    bus.emit('cmd:clickSecret', { cx: 0, cz: 0 });
    expect(progress).toHaveLength(2);
    expect(progress[1]).toMatchObject({ clicks: 2, total: 3 });
    expect(found).toHaveLength(0);
    bus.emit('cmd:clickSecret', { cx: 0, cz: 0 }); // 3rd → open
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('dig');
    expect(found[0]!.rewards).toEqual({ pops: 100, stardust: 2, xp: 30 });
    expect(secrets.find((s) => s.cx === 0 && s.cz === 0)!.found).toBe(true);
  });

  it('a found secret latches — further clicks do nothing', () => {
    sys.announce();
    for (let i = 0; i < 3; i++) bus.emit('cmd:clickSecret', { cx: 0, cz: 0 });
    expect(found).toHaveLength(1);
    bus.emit('cmd:clickSecret', { cx: 0, cz: 0 }); // extra clicks after discovery
    bus.emit('cmd:clickSecret', { cx: 0, cz: 0 });
    expect(found).toHaveLength(1); // no re-fire
  });

  it('the first bought chunk (index 5) always spawns a dig', () => {
    sys.announce();
    island.addChunk(2, 0);
    bus.emit('chunk:unlocked', { cx: 2, cz: 0, index: 5, theme: 'meadow' });
    const s = secrets.find((x) => x.cx === 2 && x.cz === 0);
    expect(s).toBeDefined();
    expect(s!.kind).toBe('dig');
  });
});
