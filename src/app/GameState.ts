/**
 * Game state assembly (S3 integration): loads-or-creates the save, hydrates the
 * IslandModel, seeds the starter island on fresh saves, owns the sim systems
 * (economy; progression + quests added by their tasks), snapshots state back,
 * and drives autosave + export/import.
 */
import { bus } from '@/core/events';
import { freshSave, SaveManager, withCarried, type Save, type SavePlacement } from '@/core/save';
import { loadSettings, snapshotSettings } from '@/core/settingsStore';
import { loadWallet, snapshotWallet, loadPlayer } from '@/core/playerStore';
import { IslandModel, type Placement } from '@/world/IslandModel';
import { EconomySystem } from '@/sim/EconomySystem';
import { ProgressionSystem } from '@/sim/ProgressionSystem';
import { QuestSystem } from '@/sim/QuestSystem';
import { itemDef } from '@/content/catalog';
import { STARTER_PLACEMENTS } from '@/content/starterIsland';

export class GameState {
  readonly save: Save;
  readonly island: IslandModel;
  readonly manager: SaveManager;
  readonly economy: EconomySystem;
  readonly progression: ProgressionSystem;
  readonly quests: QuestSystem;
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

    this.island = new IslandModel(this.save.island.chunks.map(({ cx, cz }) => ({ cx, cz })));
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

    // autosave on every mutation (debounced inside the manager)
    for (const ev of [
      'item:placed',
      'item:removed',
      'item:moved',
      'wallet:changed',
      'xp:gained',
      'quest:completed',
      'cmd:skipPostcard', // mutates persisted quest state → must autosave
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
    this.economy.resolveOffline();
    this.quests.announce();
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
}
