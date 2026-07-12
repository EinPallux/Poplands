/**
 * Pals (S18): the animals that scamper onto the island as it gets lively — they're
 * drawn to gardens, so population tracks how much nature you've planted. THREE.JS-FREE,
 * same sim/render seam as Islanders (the AgentRenderer projects the `agents` snapshot).
 * Simpler than S16: Pals wander, occasionally nibble the grass, and love being petted
 * (tap → happy gesture + hearts). Population is monotonic — a Pal never leaves.
 */
import { bus } from '@/core/events';
import { mulberry32 } from '@/core/math';
import { itemDef } from '@/content/catalog';
import { PALS, MAX_PALS, palDef, type PalDef } from '@/content/pals';
import type { SaveIslanders } from '@/core/save';
import type { IslandModel } from '@/world/IslandModel';
import type { AgentView } from './IslanderSystem';

interface Pal extends AgentView {
  id: string;
  model: string;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  tx: number;
  tz: number;
  timer: number;
  pet: number; // >0 while paused after a pet
}

const SPEED = 1.8; // Pals scamper a touch quicker than Islanders
const TURN_RATE = 11;
const WALK_TIMEOUT = 6;
const DWELL_MIN = 1.2;
const DWELL_SPAN = 2.6;
const NATURE_PER_PAL = 8; // one Pal drawn per this many nature items

function natureCount(island: IslandModel): number {
  let n = 0;
  for (const p of island.allPlacements()) if (itemDef(p.def)?.category === 'nature') n++;
  return n;
}

export class PalSystem {
  private unsubs: Array<() => void> = [];
  private list: Pal[] = [];
  private rng: () => number;

  constructor(
    private readonly island: IslandModel,
    private readonly state: SaveIslanders,
    seed: number,
  ) {
    this.rng = mulberry32((seed ^ 0x9e37) >>> 0);
  }

  wire(): void {
    this.unsubs.push(
      bus.on('item:placed', () => this.reconcile()),
      bus.on('item:removed', () => this.reconcile()),
      bus.on('cmd:clickPal', (e) => this.onPet(e.id)),
    );
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  announce(): void {
    for (const id of this.state.pals) {
      const def = palDef(id);
      if (def && !this.list.some((p) => p.id === id)) this.spawn(def);
    }
    this.reconcile();
  }

  get agents(): readonly AgentView[] {
    return this.list;
  }

  snapshot(): SaveIslanders {
    return this.state;
  }

  update(dt: number): void {
    for (const p of this.list) {
      if (p.pet > 0) {
        p.pet -= dt;
        p.moving = false;
        continue;
      }
      p.timer -= dt;
      if (p.moving) this.stepWalk(p, dt);
      else if (p.timer <= 0) this.pickTarget(p);
    }
  }

  // ——— internals ———

  private onPet(id: string): void {
    const p = this.list.find((x) => x.id === id);
    if (!p) return;
    p.pet = 2.2;
    p.moving = false;
    bus.emit('agent:playClip', { id, clip: 'gesture-positive' });
    bus.emit('pal:petted', { id });
  }

  private reconcile(): void {
    const target = Math.min(Math.floor(natureCount(this.island) / NATURE_PER_PAL), MAX_PALS, PALS.length);
    while (this.state.pals.length < target) {
      const def = PALS[this.state.pals.length]!;
      this.state.pals.push(def.id);
      this.spawn(def, true);
      bus.emit('pal:adopted', { id: def.id, nameKey: def.nameKey });
    }
  }

  private spawn(def: PalDef, arrival = false): void {
    const cell = arrival ? this.randomWalkableEdge() : this.randomWalkableCell();
    const pal: Pal = {
      id: def.id,
      model: def.model,
      x: cell.x,
      z: cell.z,
      yaw: this.rng() * Math.PI * 2,
      moving: false,
      tx: cell.x,
      tz: cell.z,
      timer: this.rng() * DWELL_SPAN,
      pet: 0,
    };
    if (arrival) {
      const c = this.island.center();
      pal.tx = c.x;
      pal.tz = c.z;
      pal.moving = true;
      pal.timer = WALK_TIMEOUT;
      pal.yaw = Math.atan2(c.x - cell.x, c.z - cell.z);
    }
    this.list.push(pal);
  }

  private stepWalk(p: Pal, dt: number): void {
    const dx = p.tx - p.x;
    const dz = p.tz - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.06 || p.timer <= 0) {
      this.rest(p);
      return;
    }
    const ux = dx / dist;
    const uz = dz / dist;
    const step = Math.min(SPEED * dt, dist);
    const nx = p.x + ux * step;
    const nz = p.z + uz * step;
    if (!this.island.walkable(Math.floor(nx), Math.floor(nz))) {
      this.rest(p);
      return;
    }
    p.x = nx;
    p.z = nz;
    p.yaw = turnToward(p.yaw, Math.atan2(ux, uz), TURN_RATE * dt);
  }

  private pickTarget(p: Pal): void {
    for (let i = 0; i < 8; i++) {
      const ang = this.rng() * Math.PI * 2;
      const rad = 2 + this.rng() * 6;
      const cx = Math.floor(p.x + Math.sin(ang) * rad);
      const cz = Math.floor(p.z + Math.cos(ang) * rad);
      if (this.island.walkable(cx, cz)) {
        p.tx = cx + 0.5;
        p.tz = cz + 0.5;
        p.moving = true;
        p.timer = WALK_TIMEOUT;
        return;
      }
    }
    p.timer = 1 + this.rng() * 2;
  }

  private rest(p: Pal): void {
    p.moving = false;
    p.timer = DWELL_MIN + this.rng() * DWELL_SPAN;
    const r = this.rng();
    if (r < 0.25) bus.emit('agent:playClip', { id: p.id, clip: 'eat' }); // nibble the grass
    else if (r < 0.36) bus.emit('agent:playClip', { id: p.id, clip: 'dance' }); // a playful hop
  }

  private randomWalkableEdge(): { x: number; z: number } {
    const edges = this.island.edgeCells().filter((e) => this.island.walkable(e.wx, e.wz));
    if (edges.length) {
      const e = edges[Math.floor(this.rng() * edges.length)]!;
      return { x: e.wx + 0.5, z: e.wz + 0.5 };
    }
    return this.randomWalkableCell();
  }

  private randomWalkableCell(): { x: number; z: number } {
    const blocks = this.island.allBlocks();
    for (let i = 0; i < 40; i++) {
      const b = blocks[Math.floor(this.rng() * blocks.length)]!;
      if (this.island.walkable(b.wx, b.wz)) return { x: b.wx + 0.5, z: b.wz + 0.5 };
    }
    const c = this.island.center();
    return { x: c.x, z: c.z };
  }

  positionOf(id: string): { x: number; z: number } | null {
    const p = this.list.find((x) => x.id === id);
    return p ? { x: p.x, z: p.z } : null;
  }
}

/** Shortest-arc slew of `from` toward `to`, capped at `maxStep` radians. */
function turnToward(from: number, to: number, maxStep: number): number {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}
