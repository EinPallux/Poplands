/**
 * Build mode (S9): tools (place / move / remove), ghost preview with validity,
 * rotation, and transactional mutations against the IslandModel. Emits domain
 * events; presentation (PropRenderer/juice/audio/UI) reacts. Selection works
 * by occupancy lookup — on a grid, the hovered cell IS the picker (TECH §9).
 */
import { Group, type Object3D } from 'three';
import { bus, type BlockReasonUi } from '@/core/events';
import { footprintCenter, rotYaw, edgeAnchorOrigin, type Rot } from '@/core/grid';
import { itemDef, type ItemDef } from '@/content/catalog';
import type { IslandModel, Placement } from '@/world/IslandModel';
import type { PropRenderer } from '@/world/PropRenderer';
import type { EconomySystem } from '@/sim/EconomySystem';
import { carryBob } from '@/vfx/presets';

export type BuildTool = 'none' | 'place' | 'move' | 'remove';

interface GhostState {
  def: ItemDef;
  object: Object3D;
  setValid: (valid: boolean) => void;
  dispose: () => void;
  rot: Rot;
  cell: { wx: number; wz: number } | null;
  valid: boolean;
  bob: ((dt: number) => void) | null;
}

export class BuildSession {
  readonly group = new Group(); // ghost lives here
  private tool: BuildTool = 'none';
  private ghost: GhostState | null = null;
  /** In move mode: the picked-up placement (freed from occupancy while carried). */
  private carried: Placement | null = null;
  private hoverCell: { wx: number; wz: number } | null = null;

  constructor(
    private readonly island: IslandModel,
    private readonly props: PropRenderer,
    private readonly economy: EconomySystem,
  ) {
    this.group.name = 'build-session';
    bus.on('cmd:selectItem', ({ defId }) => {
      if (defId === null) this.setTool('none');
      else this.startPlacing(defId);
    });
    bus.on('cmd:setTool', ({ tool }) => this.setTool(tool));
    bus.on('input:cellHover', (cell) => this.onHover(cell));
    bus.on('input:cellClick', (cell) => this.onClick(cell));
  }

  get activeTool(): BuildTool {
    return this.tool;
  }

  get isActive(): boolean {
    return this.tool !== 'none';
  }

  get ghostObject(): Object3D | null {
    return this.ghost?.object ?? null;
  }

  /** The item currently held in Move mode (at its ORIGINAL home), or null. The
   *  save snapshot includes this so a carried building is never lost if a write
   *  lands mid-carry (e.g. tab-switch → immediate autosave). */
  get carriedPlacement(): Placement | null {
    return this.carried;
  }

  /** R key — rotate the ghost (App routes R here only while a ghost exists). */
  rotate(): void {
    if (!this.ghost) return;
    this.ghost.rot = ((this.ghost.rot + 1) % 4) as Rot;
    this.refreshGhost();
  }

  /** Esc — cancel: carried items glide home, tools deselect. */
  cancel(): void {
    this.returnCarried();
    this.setTool('none');
  }

  private returnCarried(): void {
    if (!this.carried) return;
    const home = this.carried;
    this.carried = null;
    this.island.place(home.def, home.wx, home.wz, home.rot, home.id);
    bus.emit('item:placed', { ...home, silent: true }); // App's presentation shows it
  }

  update(dt: number): void {
    if (this.ghost?.bob) this.ghost.bob(dt);
  }

  // ——— internals ———

  /** Effective footprint origin for a clicked/hovered cell. Identity for normal
   *  items; for edge-anchor items the origin shifts so the on-island anchor sits
   *  on the land side and the footprint extends toward the void in the facing
   *  direction — so a dock reaches south/west edges, not just north/east (S8). */
  private footprintOrigin(def: ItemDef, cell: { wx: number; wz: number }, rot: Rot): { wx: number; wz: number } {
    return def.edgeAnchor ? edgeAnchorOrigin(cell, def.footprint, rot) : cell;
  }

  private startPlacing(defId: string): void {
    const def = itemDef(defId);
    if (!def) return;
    this.teardownGhost();
    this.tool = 'place';
    this.makeGhost(def, 0);
    bus.emit('build:modeChanged', { tool: 'place' });
  }

  private setTool(tool: BuildTool): void {
    this.returnCarried(); // switching tools while carrying = polite cancel first
    this.teardownGhost();
    this.tool = tool;
    bus.emit('build:modeChanged', { tool });
    if (tool === 'none') bus.emit('build:ghostChanged', null);
  }

  private makeGhost(def: ItemDef, rot: Rot): void {
    const ghost = this.props.makeGhost(def.id);
    if (!ghost) return;
    this.ghost = {
      def,
      object: ghost.object,
      setValid: ghost.setValid,
      dispose: ghost.dispose,
      rot,
      cell: this.hoverCell,
      valid: false,
      bob: null,
    };
    this.group.add(ghost.object);
    this.refreshGhost();
  }

  private teardownGhost(): void {
    if (this.ghost) {
      this.group.remove(this.ghost.object);
      this.ghost.dispose(); // free the ghost-owned badge material + placeholder geometry
      this.ghost = null;
    }
  }

  private onHover(cell: { wx: number; wz: number } | null): void {
    this.hoverCell = cell;
    if (this.ghost) {
      this.ghost.cell = cell;
      this.refreshGhost();
    }
  }

  private refreshGhost(): void {
    const g = this.ghost;
    if (!g) return;
    if (!g.cell) {
      g.object.visible = false;
      bus.emit('build:ghostChanged', null);
      return;
    }
    g.object.visible = true;
    const origin = this.footprintOrigin(g.def, g.cell, g.rot);
    const check = this.island.canPlace(g.def, origin.wx, origin.wz, g.rot);
    // A carried item is already paid for — dropping it never costs (move is free).
    const afford = this.carried !== null || this.economy.canAfford(g.def);
    const valid = check.ok && afford;
    g.valid = valid;
    g.setValid(valid);
    const c = footprintCenter(origin.wx, origin.wz, g.def.footprint, g.rot);
    g.object.position.set(c.x, (g.def.yOffset ?? 0) + 0.02, c.z);
    g.object.rotation.y = rotYaw(g.rot);
    if (this.carried && !g.bob) g.bob = carryBob(g.object, g.def.yOffset ?? 0);
    if (valid) {
      bus.emit('build:ghostChanged', { valid: true });
    } else {
      const reason: BlockReasonUi = !check.ok ? check.reason : 'unaffordable';
      bus.emit('build:ghostChanged', { valid: false, reason });
    }
  }

  private onClick(cell: { wx: number; wz: number }): void {
    switch (this.tool) {
      case 'place':
        this.tryPlace(cell);
        return;
      case 'move':
        if (this.carried) this.tryDrop(cell);
        else this.tryPickup(cell);
        return;
      case 'remove':
        this.tryRemove(cell);
        return;
      case 'none':
        this.tryCollect(cell);
        return;
    }
  }

  private tryPlace(cell: { wx: number; wz: number }): void {
    const g = this.ghost;
    if (!g) return;
    const origin = this.footprintOrigin(g.def, cell, g.rot);
    const check = this.island.canPlace(g.def, origin.wx, origin.wz, g.rot);
    if (!check.ok) {
      bus.emit('build:rejected', { reason: check.reason });
      return;
    }
    if (!this.economy.canAfford(g.def)) {
      bus.emit('purchase:denied', { reason: this.denyReason(g.def) });
      return;
    }
    const placement = this.island.place(g.def.id, origin.wx, origin.wz, g.rot);
    this.economy.onPlaced(placement); // seed accrual BEFORE charge (order irrelevant, but explicit)
    this.economy.charge(g.def);
    bus.emit('item:placed', { ...placement });
    this.refreshGhost(); // affordability may now have changed → update ghost tint
    // stay in place mode for joyful chaining (GDD §6.2)
  }

  private denyReason(def: ItemDef): 'pops' | 'stardust' {
    // report whichever wallet is ACTUALLY short (a dual-cost item may fail on Pops)
    return this.economy.shortWallet(def);
  }

  /** Clicking a ripe income building with no tool active collects its Pops (F1). */
  private tryCollect(cell: { wx: number; wz: number }): void {
    const occupant = this.island.occupantAt(cell.wx, cell.wz);
    if (!occupant) return;
    if (this.economy.ripeAmount(occupant.id) >= 1) {
      bus.emit('cmd:collect', { placementId: occupant.id });
    }
  }

  private tryPickup(cell: { wx: number; wz: number }): void {
    const occupant = this.island.occupantAt(cell.wx, cell.wz);
    if (!occupant) return;
    const def = itemDef(occupant.def);
    if (!def) return;
    this.island.remove(occupant.id);
    bus.emit('item:removed', { ...occupant, silent: true }); // App hides the visual
    this.carried = occupant;
    this.makeGhost(def, occupant.rot);
    bus.emit('build:modeChanged', { tool: 'move', carrying: true });
  }

  private tryDrop(cell: { wx: number; wz: number }): void {
    const g = this.ghost;
    const carried = this.carried;
    if (!g || !carried) return;
    const origin = this.footprintOrigin(g.def, cell, g.rot);
    const check = this.island.canPlace(g.def, origin.wx, origin.wz, g.rot);
    if (!check.ok) {
      bus.emit('build:rejected', { reason: check.reason });
      return;
    }
    const placement = this.island.place(carried.def, origin.wx, origin.wz, g.rot, carried.id);
    this.carried = null;
    this.teardownGhost();
    // item:moved (not item:placed): same id re-dropped — no charge, no XP, no
    // quest progress. App still shows the visual; economy accrual is preserved.
    bus.emit('item:moved', { ...placement });
    bus.emit('build:modeChanged', { tool: 'move', carrying: false });
  }

  private tryRemove(cell: { wx: number; wz: number }): void {
    const occupant = this.island.occupantAt(cell.wx, cell.wz);
    if (!occupant) return;
    const def = itemDef(occupant.def);
    if (def) {
      this.economy.onRemoved(occupant); // banks ripe pops (still in island) then drops accrual
      this.economy.refund(def); // 100% refund (GDD pillar 1)
    }
    this.island.remove(occupant.id);
    bus.emit('item:removed', { ...occupant });
  }
}
