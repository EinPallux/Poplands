/**
 * Islanders (S16): the little neighbours who move in as your island gains homes,
 * and wander it while you build. THREE.JS-FREE — this owns only kinematics (plain
 * {x,z} numbers, headings, timers) and roster bookkeeping; the AgentRenderer
 * projects the exposed `agents` snapshot into animated meshes each frame (pull
 * model, like WorldFx reads economy). Sim never sees a mesh, a mixer, or a clip.
 *
 * Movement is deliberately not A*: the island is a small open grid, so each agent
 * strolls in a straight line toward a nearby walkable cell and re-decides on
 * arrival, on obstruction, or after a safety timeout. Decisions happen on per-agent
 * timers (seconds apart), never per frame — only the position integration is
 * per-frame, and that's a handful of adds. Believable cozy wander at ~zero cost.
 *
 * Population = min(Σ houses, cap) and is MONOTONIC: removing a home never evicts a
 * neighbour (the no-fail-state covenant — nobody gets kicked off the island).
 */
import { bus } from '@/core/events';
import { mulberry32 } from '@/core/math';
import { itemDef } from '@/content/catalog';
import { CHATTER_LINES, CHATTER_EMOTES } from '@/content/chatter';
import { ISLANDERS, MAX_ISLANDERS, islanderDef, type IslanderDef } from '@/content/roster';
import type { SaveIslanders } from '@/core/save';
import type { IslandModel } from '@/world/IslandModel';

/** The per-agent state the renderer reads (pull model). Extra kinematic fields on
 *  the backing object are ignored by structural typing. */
export interface AgentView {
  readonly id: string; // roster id — stable key for the renderer's map
  readonly model: string; // runtime asset id
  readonly x: number; // continuous world X (block-center coords)
  readonly z: number; // continuous world Z
  readonly yaw: number; // heading (radians; 0 = +Z), renderer applies model offset
  readonly moving: boolean; // drives the idle↔walk crossfade
}

interface Agent extends AgentView {
  id: string;
  model: string;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  tx: number; // current wander target
  tz: number;
  timer: number; // seconds until the next decision (idle dwell / walk safety cap)
  chat: number; // >0 while paused to greet the player (seconds remaining)
}

const SPEED = 1.5; // blocks/second — an unhurried stroll
const TURN_RATE = 9; // rad/second heading slew (the renderer damps further)
const WALK_TIMEOUT = 8; // seconds; a stuck walker re-decides rather than trudge forever
const DWELL_MIN = 1.5;
const DWELL_SPAN = 2.5;

function houseCapacity(island: IslandModel): number {
  let n = 0;
  for (const p of island.allPlacements()) n += itemDef(p.def)?.houses ?? 0;
  return n;
}

export class IslanderSystem {
  private unsubs: Array<() => void> = [];
  private list: Agent[] = [];
  private rng: () => number;

  constructor(
    private readonly island: IslandModel,
    private readonly state: SaveIslanders,
    seed: number,
  ) {
    this.rng = mulberry32((seed ^ 0x51a4d) >>> 0);
  }

  wire(): void {
    // a new home may welcome a neighbour; a removed one never evicts (monotonic)
    this.unsubs.push(
      bus.on('item:placed', () => this.reconcile()),
      bus.on('item:removed', () => this.reconcile()),
      bus.on('cmd:clickNpc', (e) => this.onClick(e.id)),
    );
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  /** Spawn live agents for already-resident Islanders (from the save), then catch
   *  any home growth beyond the persisted roster. Called by GameState.start(). */
  announce(): void {
    for (const id of this.state.residents) {
      const def = islanderDef(id);
      if (def && !this.list.some((a) => a.id === id)) this.spawn(def);
    }
    this.reconcile();
  }

  /** The renderer reads this each frame (stable array, mutated in place — no alloc). */
  get agents(): readonly AgentView[] {
    return this.list;
  }

  snapshot(): SaveIslanders {
    return this.state;
  }

  /** Per-frame kinematics + timer-gated decisions. */
  update(dt: number): void {
    for (const a of this.list) {
      if (a.chat > 0) {
        a.chat -= dt; // paused mid-island to greet the player — stand and chat
        a.moving = false;
        continue;
      }
      a.timer -= dt;
      if (a.moving) this.stepWalk(a, dt);
      else if (a.timer <= 0) this.pickTarget(a);
    }
  }

  // ——— internals ———

  /** Tap-to-greet: pause, say a cute line, play a matching emote (S16 interactions). */
  private onClick(id: string): void {
    const a = this.list.find((x) => x.id === id);
    if (!a) return;
    a.chat = 3;
    a.moving = false;
    const line = CHATTER_LINES[Math.floor(this.rng() * CHATTER_LINES.length)]!;
    const emote = CHATTER_EMOTES[Math.floor(this.rng() * CHATTER_EMOTES.length)]!;
    bus.emit('npc:spoke', { id, textKey: line });
    bus.emit('agent:playClip', { id, clip: emote });
  }

  private reconcile(): void {
    const target = Math.min(houseCapacity(this.island), MAX_ISLANDERS, ISLANDERS.length);
    while (this.state.residents.length < target) {
      const def = ISLANDERS[this.state.residents.length]!;
      this.state.residents.push(def.id);
      this.spawn(def);
      bus.emit('npc:arrived', { id: def.id });
    }
  }

  private spawn(def: IslanderDef): void {
    const cell = this.randomWalkableCell();
    this.list.push({
      id: def.id,
      model: def.model,
      x: cell.x,
      z: cell.z,
      yaw: this.rng() * Math.PI * 2,
      moving: false,
      tx: cell.x,
      tz: cell.z,
      timer: this.rng() * DWELL_SPAN, // stagger first steps so nobody marches in sync
      chat: 0,
    });
  }

  private stepWalk(a: Agent, dt: number): void {
    const dx = a.tx - a.x;
    const dz = a.tz - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.06 || a.timer <= 0) {
      this.rest(a);
      return;
    }
    const ux = dx / dist;
    const uz = dz / dist;
    const step = Math.min(SPEED * dt, dist);
    const nx = a.x + ux * step;
    const nz = a.z + uz * step;
    if (!this.island.walkable(Math.floor(nx), Math.floor(nz))) {
      this.rest(a); // path clipped a solid cell — change of mind
      return;
    }
    a.x = nx;
    a.z = nz;
    a.yaw = turnToward(a.yaw, Math.atan2(ux, uz), TURN_RATE * dt);
  }

  private pickTarget(a: Agent): void {
    for (let i = 0; i < 8; i++) {
      const ang = this.rng() * Math.PI * 2;
      const rad = 2 + this.rng() * 5;
      const cx = Math.floor(a.x + Math.sin(ang) * rad);
      const cz = Math.floor(a.z + Math.cos(ang) * rad);
      if (this.island.walkable(cx, cz)) {
        a.tx = cx + 0.5;
        a.tz = cz + 0.5;
        a.moving = true;
        a.timer = WALK_TIMEOUT;
        return;
      }
    }
    a.timer = 1 + this.rng() * 2; // hemmed in — idle a beat and try again
  }

  private rest(a: Agent): void {
    a.moving = false;
    a.timer = DWELL_MIN + this.rng() * DWELL_SPAN;
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
}

/** Shortest-arc slew of `from` toward `to`, capped at `maxStep` radians. */
function turnToward(from: number, to: number, maxStep: number): number {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}
