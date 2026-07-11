/**
 * Game state assembly (S3 integration): loads-or-creates the save, hydrates the
 * IslandModel, seeds the starter island on fresh saves, owns the sim systems
 * (economy; progression + quests added by their tasks), snapshots state back,
 * and drives autosave + export/import.
 */
import { bus } from '@/core/events';
import { freshSave, SaveManager, withCarried, type Save, type SavePlacement } from '@/core/save';
import { encodeShareCode, decodeShareCode } from '@/core/islandCode';
import { loadSettings, snapshotSettings } from '@/core/settingsStore';
import { loadWallet, snapshotWallet, loadPlayer } from '@/core/playerStore';
import { IslandModel, type Placement } from '@/world/IslandModel';
import { EconomySystem } from '@/sim/EconomySystem';
import { ProgressionSystem } from '@/sim/ProgressionSystem';
import { QuestSystem } from '@/sim/QuestSystem';
import { ExpansionSystem } from '@/sim/ExpansionSystem';
import { SecretSystem } from '@/sim/SecretSystem';
import { IslanderSystem } from '@/sim/IslanderSystem';
import { PalSystem } from '@/sim/PalSystem';
import { FishingSystem } from '@/sim/FishingSystem';
import { DailyGiftSystem } from '@/sim/DailyGiftSystem';
import { MuseumSystem } from '@/sim/MuseumSystem';
import { AchievementSystem } from '@/sim/AchievementSystem';
import { GardenSystem } from '@/sim/GardenSystem';
import { itemDef } from '@/content/catalog';
import { STARTER_PLACEMENTS } from '@/content/starterIsland';

export class GameState {
  readonly save: Save;
  readonly island: IslandModel;
  readonly manager: SaveManager;
  readonly economy: EconomySystem;
  readonly progression: ProgressionSystem;
  readonly quests: QuestSystem;
  readonly expansion: ExpansionSystem;
  readonly secrets: SecretSystem;
  readonly islanders: IslanderSystem;
  readonly pals: PalSystem;
  readonly fishing: FishingSystem;
  readonly dailyGift: DailyGiftSystem;
  readonly museum: MuseumSystem;
  readonly achievements: AchievementSystem;
  readonly garden: GardenSystem;
  readonly isFresh: boolean;
  /** Supplies the item held in Move mode so the snapshot never drops it. */
  private carriedProvider: (() => Placement | null) | null = null;

  constructor() {
    this.manager = new SaveManager(() => this.collect());
    const loaded = this.manager.load();
    this.isFresh = loaded === null;
    this.save = loaded ?? GameState.makeFreshSave();
    loadSettings(this.save.settings);
    loadWallet(this.save.player);
    loadPlayer(this.save.player);

    this.island = new IslandModel(
      this.save.island.chunks.map(({ cx, cz, theme }) => ({ cx, cz, theme })),
    );
    const attic: SavePlacement[] = [...this.save.attic];
    for (const p of this.save.island.placements) {
      const def = itemDef(p.def);
      if (def && this.island.canPlace(def, p.wx, p.wz, p.rot).ok) {
        this.island.place(p.def, p.wx, p.wz, p.rot, p.id);
      } else {
        attic.push(p); // unknown def or corrupt overlap — parked, never dropped (S3)
      }
    }
    if (attic.length > this.save.attic.length) {
      console.warn(`[save] parked ${attic.length - this.save.attic.length} placement(s) in the attic`);
    }
    this.save.attic = attic;

    // economy owns wallets + accrual; hydrate quietly (no ripe emits until start())
    this.economy = new EconomySystem(this.island);
    this.economy.hydrate(this.save.economy, this.island.allPlacements());
    // progression owns level/xp (mutates save.player in place)
    this.progression = new ProgressionSystem(this.save.player);
    // quests own their state slice (mutates save.quests in place)
    this.quests = new QuestSystem(this.island, this.save.quests, this.save.player.level);
    // expansion owns survey offers + the buy flow (grows the island lattice)
    this.expansion = new ExpansionSystem(this.island, this.economy, this.save.seed);
    // secrets own the per-chunk discovery roll + dig/chest state (mutates save.secrets)
    this.secrets = new SecretSystem(this.island, this.save.secrets, this.save.seed);
    // islanders + pals own their rosters + wander AI (mutate save.islanders in place)
    this.islanders = new IslanderSystem(this.island, this.save.islanders, this.save.seed);
    this.pals = new PalSystem(this.island, this.save.islanders, this.save.seed);
    // fishing owns the pond minigame + catch collection (mutates save.fishing on snapshot)
    this.fishing = new FishingSystem(this.island, this.save.fishing, this.save.seed);
    // daily gift owns the once-a-day present (mutates save.dailyGift in place)
    this.dailyGift = new DailyGiftSystem(this.save.dailyGift);
    // the museum donates caught fish onto display (reads the fishing collection)
    this.museum = new MuseumSystem(this.save.museum, () => Object.keys(this.fishing.collection().caught));
    // the garden grows crops on placed Garden Patches (time-based, offline-safe)
    this.garden = new GardenSystem(this.island, this.save.garden);
    // the Stamp Book awards lifetime milestone stamps (reads a live cross-system snapshot)
    this.achievements = new AchievementSystem(this.save.achievements, () => this.achievementStats());

    // a bought chunk is appended to the persisted chunk set (only ExpansionSystem
    // grows the model, so save.chunks and the model stay in lock-step — themes stay
    // 'meadow' in v0.4). Kept out of collect() so existing chunk themes survive.
    bus.on('chunk:unlocked', (e) => {
      this.save.island.chunks.push({ cx: e.cx, cz: e.cz, theme: e.theme });
    });

    // autosave on every mutation (debounced inside the manager)
    for (const ev of [
      'item:placed',
      'item:removed',
      'item:moved',
      'wallet:changed',
      'xp:gained',
      'quest:completed',
      'cmd:skipPostcard', // mutates persisted quest state → must autosave
      'chunk:unlocked', // grew the island → persist the new chunk
      'secret:spawned', // rolled a new chunk's secret → persist it
      'secret:progress', // partial dig → persist the click count
      'secret:found', // discovered → persist + reward flows credited
      'npc:arrived', // a neighbour moved in → persist the roster
      'pal:adopted', // a Pal came to visit → persist the roster
      'fishing:caught', // reeled in a fish → persist the collection
      'gift:claimed', // opened the daily present → persist the claim
      'museum:donated', // put a fish on display → persist the donation
      'achievement:earned', // a new stamp → persist the Stamp Book
      'garden:planted', // a seed went in → persist the plot
      'garden:harvested', // a crop came out → persist the empty plot + tally
      'settings:changed',
    ] as const) {
      bus.on(ev, () => this.manager.requestSave());
    }
  }

  /** Called by App AFTER presentation has subscribed, so the load-time ripe
   *  bubble cascade (F3 "the island greets you") reaches its listeners, and so
   *  reward-credit subscriptions are live before any quest/level fires. Wire
   *  order matters: economy/progression must be subscribed before quests can
   *  fire a completion whose reward they credit. */
  start(): void {
    this.economy.wireRewards();
    this.progression.wire();
    this.quests.wire();
    this.achievements.wire(); // AFTER quests so its milestone bumps land before we read them
    this.expansion.wire();
    this.secrets.wire();
    this.islanders.wire();
    this.pals.wire();
    this.fishing.wire();
    this.garden.wire();
    this.economy.resolveOffline();
    this.quests.announce();
    this.expansion.announce();
    this.secrets.announce();
    this.islanders.announce();
    this.pals.announce();
    this.dailyGift.announce(); // surface today's present if it's ready
    this.achievements.announce(); // silently grant any stamps already earned (no spam)
  }

  /** Live cross-system snapshot the Stamp Book evaluates its predicates against. */
  private achievementStats() {
    const placements = this.island.allPlacements();
    let homes = 0;
    let incomes = 0;
    let hasWonder = false;
    for (const p of placements) {
      const def = itemDef(p.def);
      if (!def) continue;
      if (def.category === 'home') homes++;
      else if (def.category === 'income') incomes++;
      if (p.def === 'decor.the-wonder') hasWonder = true;
    }
    const m = this.save.quests.milestones;
    const fish = this.fishing.collection();
    return {
      level: this.save.player.level,
      chunks: this.island.chunkCount,
      itemsPlaced: m.itemsPlaced,
      popsCollected: m.popsCollected,
      questsDone: m.questsDone,
      secretsFound: m.secretsFound,
      ownedItems: placements.length,
      homes,
      incomes,
      fishSpecies: Object.keys(fish.caught).length,
      fishTotal: fish.total,
      museumDonated: this.museum.snapshot().donated.length,
      islanders: this.islanders.snapshot().residents.length,
      pals: this.pals.snapshot().pals.length,
      giftClaims: this.save.dailyGift.claims,
      cropsHarvested: this.garden.harvested,
      hasWonder,
    };
  }

  private static makeFreshSave(): Save {
    const save = freshSave(Math.floor(Math.random() * 2 ** 31), Date.now());
    let id = 1;
    save.island.placements = STARTER_PLACEMENTS.map((p) => ({
      id: `p${id++}`,
      def: p.def,
      wx: p.wx,
      wz: p.wz,
      rot: p.rot ?? 0,
    }));
    // milestone counter starts consistent with the seeded island
    save.quests.milestones.itemsPlaced = save.island.placements.length;
    return save;
  }

  /** Register the Move-mode carried-item provider (App wires the BuildSession). */
  setCarriedProvider(fn: () => Placement | null): void {
    this.carriedProvider = fn;
  }

  /** Snapshot live state back into the save shell (called by the manager).
   *  Object.assign preserves player.xp/level/xpGranted written in place by progression. */
  collect(): Save {
    // Fold a Move-mode carried building back into the snapshot at its home so a
    // mid-carry autosave can never lose it (no fail states).
    const carried = this.carriedProvider?.() ?? null;
    const placements = withCarried(this.island.snapshotPlacements(), carried);
    this.save.island.placements = placements;
    // Bound the XP idempotence ledger to live placements — a removed id retires
    // forever (ids are never reused), so pruning it can't cause a double-grant
    // and keeps xpGranted from growing without limit over a long-lived save.
    const live = new Set(placements.map((p) => p.id));
    this.save.player.xpGranted = this.save.player.xpGranted.filter((id) => live.has(id));
    Object.assign(this.save.player, snapshotWallet());
    this.save.economy = this.economy.snapshot();
    this.save.fishing = this.fishing.snapshot();
    this.save.museum = this.museum.snapshot();
    this.save.achievements = this.achievements.snapshot();
    this.save.garden = this.garden.snapshot();
    this.save.settings = snapshotSettings();
    return this.save;
  }

  exportToFile(): void {
    const blob = new Blob([this.manager.exportString()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poplands-island-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(file: File): Promise<boolean> {
    const text = await file.text();
    const ok = this.manager.importString(text);
    if (ok) {
      window.location.reload(); // placements-are-truth → clean reload is safest hydration
      return true;
    }
    return false;
  }

  /** A compact, copy-pasteable code encoding the current island (post-1.0). */
  async shareCode(): Promise<string> {
    return encodeShareCode(this.manager.exportString());
  }

  /** Decode + validate + persist a shared island to the main save slot (no reload).
   *  Returns false (no side effects) if the code is malformed or not a valid save. */
  async importShareCode(code: string): Promise<boolean> {
    const json = await decodeShareCode(code);
    if (json === null) return false;
    return this.manager.importString(json) !== null; // parseSave-validates + writes the slot
  }

  /** Load a shared island from a code: import it, then reload to rebuild the world.
   *  The CALLER confirms first — this replaces the current island. */
  async loadShareCode(code: string): Promise<boolean> {
    if (!(await this.importShareCode(code))) return false;
    // drop only the ?island= param (keep any others) so a refresh won't re-prompt
    const u = new URL(window.location.href);
    u.searchParams.delete('island');
    window.history.replaceState(null, '', u.pathname + u.search);
    window.location.reload(); // placements-are-truth → rebuild from the new save
    return true;
  }
}
