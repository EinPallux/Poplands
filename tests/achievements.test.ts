import { describe, it, expect, afterEach } from 'vitest';
import { AchievementSystem } from '@/sim/AchievementSystem';
import { ACHIEVEMENTS, type AchievementStats } from '@/content/achievements';
import { freshAchievements } from '@/core/save';
import { bus } from '@/core/events';

const zero = (): AchievementStats => ({
  level: 1, chunks: 0, itemsPlaced: 0, popsCollected: 0, questsDone: 0, secretsFound: 0,
  ownedItems: 0, homes: 0, incomes: 0, fishSpecies: 0, fishTotal: 0, museumDonated: 0,
  islanders: 0, pals: 0, giftClaims: 0, hasWonder: false,
});

const offs: Array<() => void> = [];
let sys: AchievementSystem | null = null;

afterEach(() => {
  sys?.dispose();
  sys = null;
  for (const off of offs) off();
  offs.length = 0;
});

/** A trigger event (any progress event re-evaluates); gift:claimed has a tiny payload. */
const tick = () => bus.emit('gift:claimed', { day: 1, rewards: {} });

describe('AchievementSystem', () => {
  it('earns + announces a stamp when its threshold is crossed', () => {
    const stats = zero();
    const state = freshAchievements();
    sys = new AchievementSystem(state, () => stats);
    const earned: string[] = [];
    offs.push(bus.on('achievement:earned', (e) => earned.push(e.id)));
    sys.wire();

    tick(); // nothing yet on a blank board
    expect(earned).toHaveLength(0);

    stats.itemsPlaced = 1;
    tick();
    expect(earned).toContain('first-build');
    expect(state.earned).toContain('first-build'); // persisted into the slice
  });

  it('never double-earns the same stamp', () => {
    const stats = zero();
    sys = new AchievementSystem(freshAchievements(), () => stats);
    let count = 0;
    offs.push(bus.on('achievement:earned', (e) => e.id === 'first-fish' && count++));
    sys.wire();
    stats.fishTotal = 3;
    tick();
    tick();
    tick();
    expect(count).toBe(1);
  });

  it('announce() grants already-met stamps SILENTLY (no celebration spam on load)', () => {
    const stats = zero();
    stats.level = 12; // a returning player already at L12
    const state = freshAchievements();
    sys = new AchievementSystem(state, () => stats);
    let fired = 0;
    offs.push(bus.on('achievement:earned', () => fired++));

    sys.announce();
    expect(fired).toBe(0); // silent
    const v = sys.view();
    expect(v.list.find((x) => x.id === 'level-5')!.earned).toBe(true);
    expect(v.list.find((x) => x.id === 'level-10')!.earned).toBe(true);
    expect(v.list.find((x) => x.id === 'level-20')!.earned).toBe(false); // 12 < 20
  });

  it('later live earns still celebrate after a silent announce', () => {
    const stats = zero();
    stats.chunks = 6; // already met the 5-chunk stamp
    sys = new AchievementSystem(freshAchievements(), () => stats);
    const earned: string[] = [];
    offs.push(bus.on('achievement:earned', (e) => earned.push(e.id)));
    sys.announce(); // silently grants first-chunk
    sys.wire();
    expect(earned).toHaveLength(0);

    stats.chunks = 12; // now grow to 12 live
    tick();
    expect(earned).toContain('sprawling');
    expect(earned).not.toContain('first-chunk'); // already granted silently, not re-fired
  });

  it('view reports earned/total and per-stamp flags', () => {
    const stats = zero();
    stats.hasWonder = true;
    sys = new AchievementSystem(freshAchievements(), () => stats);
    sys.announce();
    const v = sys.view();
    expect(v.total).toBe(ACHIEVEMENTS.length);
    expect(v.earned).toBeGreaterThanOrEqual(1);
    expect(v.list.find((x) => x.id === 'the-wonder')!.earned).toBe(true);
  });

  it('snapshot round-trips the earned set', () => {
    const stats = zero();
    stats.pals = 6;
    sys = new AchievementSystem(freshAchievements(), () => stats);
    sys.announce(); // grants first-pal + menagerie
    const snap = sys.snapshot();
    const sys2 = new AchievementSystem(snap, () => zero());
    expect(sys2.view().earned).toBe(snap.earned.length);
    expect(sys2.view().list.find((x) => x.id === 'menagerie')!.earned).toBe(true);
    sys2.dispose();
  });
});
