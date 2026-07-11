/**
 * Game state assembly (S3 integration): loads-or-creates the save, hydrates the
 * IslandModel, seeds the starter island on fresh saves, snapshots state back
 * into the save shell, and owns autosave triggers + export/import.
 */
import { bus } from '@/core/events';
import {
  freshSave,
  SaveManager,
  type SaveV1,
  type SavePlacement,
} from '@/core/save';
import { loadSettings, snapshotSettings } from '@/core/settingsStore';
import { IslandModel } from '@/world/IslandModel';
import { itemDef } from '@/content/catalog';
import { STARTER_PLACEMENTS } from '@/content/starterIsland';

export class GameState {
  readonly save: SaveV1;
  readonly island: IslandModel;
  readonly manager: SaveManager;
  readonly isFresh: boolean;

  constructor() {
    this.manager = new SaveManager(() => this.collect());
    const loaded = this.manager.load();
    this.isFresh = loaded === null;
    this.save = loaded ?? GameState.makeFreshSave();
    loadSettings(this.save.settings);

    this.island = new IslandModel(this.save.island.chunks.map(({ cx, cz }) => ({ cx, cz })));
    const attic: SavePlacement[] = [...this.save.attic];
    for (const p of this.save.island.placements) {
      if (itemDef(p.def) && this.island.canPlace(itemDef(p.def)!, p.wx, p.wz, p.rot).ok) {
        this.island.place(p.def, p.wx, p.wz, p.rot, p.id);
      } else {
        attic.push(p); // unknown def or corrupt overlap — parked, never dropped (S3)
      }
    }
    if (attic.length > this.save.attic.length) {
      console.warn(`[save] parked ${attic.length - this.save.attic.length} placement(s) in the attic`);
    }
    this.save.attic = attic;

    // autosave on every mutation (debounced inside the manager)
    bus.on('item:placed', () => this.manager.requestSave());
    bus.on('item:removed', () => this.manager.requestSave());
    bus.on('settings:changed', () => this.manager.requestSave());
  }

  private static makeFreshSave(): SaveV1 {
    const save = freshSave(Math.floor(Math.random() * 2 ** 31), Date.now());
    let id = 1;
    save.island.placements = STARTER_PLACEMENTS.map((p) => ({
      id: `p${id++}`,
      def: p.def,
      wx: p.wx,
      wz: p.wz,
      rot: p.rot ?? 0,
    }));
    return save;
  }

  /** Snapshot live state back into the save shell (called by the manager). */
  collect(): SaveV1 {
    this.save.island.placements = this.island.snapshotPlacements();
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
      // placements-are-truth makes a clean reload the safest hydration path
      window.location.reload();
      return true;
    }
    return false;
  }
}
