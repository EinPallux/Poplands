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
 * Furniture interactions (post-1.0): a wandering neighbour will occasionally seek
 * out a nearby interactive placeable (a bench to `sit` on, a fire/fountain/statue to
 * `gather` around) — walk to a walkable approach cell beside it, use it for a spell
 * (sit pose held, or idle + the odd emote), then get up and stroll on. Only ONE
 * neighbour claims a given piece at a time. The agent stays LOGICALLY on its
 * walkable approach cell the whole time (so the "always on walkable ground"
 * invariant holds); a render-only offset (ox/oz/lift) leans the avatar onto the
 * seat. Furniture removed mid-use just ends the visit gracefully (no fail states).
 *
 * Population = min(Σ houses, cap) and is MONOTONIC: removing a home never evicts a
 * neighbour (the no-fail-state covenant — nobody gets kicked off the island).
 */
import { bus } from '@/core/events';
import { mulberry32 } from '@/core/math';
import { footprintCells, footprintCenter } from '@/core/grid';
import { itemDef } from '@/content/catalog';
import { CHATTER_LINES, CHATTER_EMOTES } from '@/content/chatter';
import { ISLANDERS, MAX_ISLANDERS, islanderDef, type IslanderDef } from '@/content/roster';
import type { SaveIslanders } from '@/core/save';
import type { Placement, IslandModel } from '@/world/IslandModel';
import type { ItemDef } from '@/content/catalog';

/** The per-agent state the renderer reads (pull model). Extra kinematic fields on
 *  the backing object are ignored by structural typing. */
export interface AgentView {
  readonly id: string; // roster id — stable key for the renderer's map
  readonly model: string; // runtime asset id
  readonly x: number; // continuous world X (block-center coords)
  readonly z: number; // continuous world Z
  readonly yaw: number; // heading (radians; 0 = +Z), renderer applies model offset
  readonly moving: boolean; // drives the idle↔walk crossfade
  /** Render-only offsets (post-1.0 furniture): the avatar is drawn at
   *  (x+ox, footY+lift, z+oz) so it can lean onto a seat while the sim keeps the
   *  agent on its walkable approach cell. Absent ⇒ 0 (the renderer coalesces). */
  readonly ox?: number;
  readonly oz?: number;
  readonly lift?: number;
}

type UseKind = 'sit' | 'gather';

interface Agent extends AgentView {
  id: string;
  model: string;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  ox: number;
  oz: number;
  lift: number;
  tx: number; // current wander target
  tz: number;
  timer: number; // seconds until the next decision (idle dwell / walk safety cap)
  chat: number; // >0 while paused to greet the player (seconds remaining)
  usePid: string | null; // furniture being approached or used (also the claim key)
  useKind: UseKind | null;
  using: boolean; // true once seated/gathered (vs still walking over)
  useTimer: number; // seconds left in the current visit
  emoteTimer: number; // gather: seconds until the next look/emote
}

const SPEED = 1.5; // blocks/second — an unhurried stroll
const TURN_RATE = 9; // rad/second heading slew (the renderer damps further)
const WALK_TIMEOUT = 8; // seconds; a stuck walker re-decides rather than trudge forever
const DWELL_MIN = 1.5;
const DWELL_SPAN = 2.5;
// furniture: how often an idle neighbour heads for a placeable, how far they'll
// look, how long they linger, and how the sit avatar leans onto the seat.
const FURNITURE_CHANCE = 0.4; // per idle decision, if a free piece is in reach
const FURNITURE_RADIUS = 9; // blocks — only seek furniture within a short stroll
const USE_MIN = 6;
const USE_SPAN = 8; // a visit lasts USE_MIN..USE_MIN+USE_SPAN seconds
const SIT_INSET = 0.5; // render-nudge toward the seat centre (blocks)
const SIT_LIFT_DEFAULT = 0.3;
const EMOTE_MIN = 2.2;
const EMOTE_SPAN = 3; // gather: an emote every EMOTE_MIN..+EMOTE_SPAN seconds
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function houseCapacity(island: IslandModel): number {
  let n = 0;
  for (const p of island.allPlacements()) n += itemDef(p.def)?.houses ?? 0;
  return n;
}

export class IslanderSystem {
  private unsubs: Array<() => void> = [];
  private list: Agent[] = [];
  private rng: () => number;
  /** Furniture placement ids currently claimed by a neighbour (one user apiece). */
  private claimed = new Set<string>();

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
      bus.on('item:removed', (e) => {
        this.releaseFurniture(e.id); // a removed seat ends any visit + frees the claim
        this.reconcile();
      }),
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

  /** A live agent's world position (for the arrival popup anchor). */
  positionOf(id: string): { x: number; z: number } | null {
    const a = this.list.find((x) => x.id === id);
    return a ? { x: a.x, z: a.z } : null;
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
      if (a.using) {
        this.tickUsing(a, dt); // seated/gathered at a piece of furniture
        continue;
      }
      a.timer -= dt;
      if (a.moving) this.stepWalk(a, dt);
      else if (a.timer <= 0) this.pickTarget(a);
    }
  }

  // ——— internals ———

  /** Tap-to-greet: pause, say a cute line, play a matching emote (S16 interactions).
   *  A neighbour mid-stroll toward furniture drops the plan; a SEATED one waves
   *  without getting up (the sit pose resumes after the one-shot emote). */
  private onClick(id: string): void {
    const a = this.list.find((x) => x.id === id);
    if (!a) return;
    if (a.usePid && !a.using) this.abandonApproach(a); // was walking to a seat — let it go
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
      this.spawn(def, true); // a genuine move-in: walk in from the cloud edge
      bus.emit('npc:arrived', { id: def.id, nameKey: def.nameKey });
    }
  }

  private spawn(def: IslanderDef, arrival = false): void {
    const cell = arrival ? this.randomWalkableEdge() : this.randomWalkableCell();
    const agent: Agent = {
      id: def.id,
      model: def.model,
      x: cell.x,
      z: cell.z,
      yaw: this.rng() * Math.PI * 2,
      moving: false,
      ox: 0,
      oz: 0,
      lift: 0,
      tx: cell.x,
      tz: cell.z,
      timer: this.rng() * DWELL_SPAN, // stagger first steps so nobody marches in sync
      chat: 0,
      usePid: null,
      useKind: null,
      using: false,
      useTimer: 0,
      emoteTimer: 0,
    };
    if (arrival) {
      // enter from the edge and stroll toward the island's heart (the move-in beat)
      const c = this.island.center();
      agent.tx = c.x;
      agent.tz = c.z;
      agent.moving = true;
      agent.timer = WALK_TIMEOUT;
      agent.yaw = Math.atan2(c.x - cell.x, c.z - cell.z);
    }
    this.list.push(agent);
  }

  private randomWalkableEdge(): { x: number; z: number } {
    const edges = this.island.edgeCells().filter((e) => this.island.walkable(e.wx, e.wz));
    if (edges.length) {
      const e = edges[Math.floor(this.rng() * edges.length)]!;
      return { x: e.wx + 0.5, z: e.wz + 0.5 };
    }
    return this.randomWalkableCell();
  }

  private stepWalk(a: Agent, dt: number): void {
    const dx = a.tx - a.x;
    const dz = a.tz - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.06) {
      this.arrive(a); // reached the target cell
      return;
    }
    if (a.timer <= 0) {
      // couldn't get there in time — give up (release any furniture claim) and rest
      if (a.usePid) this.abandonApproach(a);
      else this.rest(a);
      return;
    }
    const ux = dx / dist;
    const uz = dz / dist;
    const step = Math.min(SPEED * dt, dist);
    const nx = a.x + ux * step;
    const nz = a.z + uz * step;
    if (!this.island.walkable(Math.floor(nx), Math.floor(nz))) {
      // path clipped a solid cell — change of mind (drop a furniture plan cleanly)
      if (a.usePid) this.abandonApproach(a);
      else this.rest(a);
      return;
    }
    a.x = nx;
    a.z = nz;
    a.yaw = turnToward(a.yaw, Math.atan2(ux, uz), TURN_RATE * dt);
  }

  /** Reached the current target: settle onto furniture if that's why we came, else idle. */
  private arrive(a: Agent): void {
    if (a.usePid) this.beginUsing(a);
    else this.rest(a);
  }

  private pickTarget(a: Agent): void {
    // sometimes head for a nearby seat/fire/fountain instead of an aimless step
    if (this.rng() < FURNITURE_CHANCE && this.pickFurnitureTarget(a)) return;
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

  /** Claim a free interactive placeable in reach + set the approach cell as target. */
  private pickFurnitureTarget(a: Agent): boolean {
    const cands: Array<{ pid: string; kind: UseKind; ap: { wx: number; wz: number } }> = [];
    for (const p of this.island.allPlacements()) {
      const def = itemDef(p.def);
      if (!def?.interaction || this.claimed.has(p.id)) continue;
      const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
      if (Math.hypot(c.x - a.x, c.z - a.z) > FURNITURE_RADIUS) continue;
      const ap = this.approachCell(a, p, def);
      if (ap) cands.push({ pid: p.id, kind: def.interaction, ap });
    }
    if (cands.length === 0) return false;
    const pick = cands[Math.floor(this.rng() * cands.length)]!;
    this.claimed.add(pick.pid);
    a.usePid = pick.pid;
    a.useKind = pick.kind;
    a.tx = pick.ap.wx + 0.5;
    a.tz = pick.ap.wz + 0.5;
    a.moving = true;
    a.timer = WALK_TIMEOUT;
    return true;
  }

  /** Nearest walkable cell adjacent to a placement's footprint (the stand/sit spot). */
  private approachCell(a: Agent, p: Placement, def: ItemDef): { wx: number; wz: number } | null {
    const cells = footprintCells(p.wx, p.wz, def.footprint, p.rot);
    const inside = new Set(cells.map((c) => `${c.wx},${c.wz}`));
    let best: { wx: number; wz: number } | null = null;
    let bestD = Infinity;
    for (const c of cells) {
      for (const [dx, dz] of NEIGHBORS) {
        const nx = c.wx + dx;
        const nz = c.wz + dz;
        if (inside.has(`${nx},${nz}`) || !this.island.walkable(nx, nz)) continue;
        const d = (nx + 0.5 - a.x) ** 2 + (nz + 0.5 - a.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { wx: nx, wz: nz };
        }
      }
    }
    return best;
  }

  /** Settle onto the furniture we walked to: sit (held pose + seat lean) or gather. */
  private beginUsing(a: Agent): void {
    const p = a.usePid ? this.island.placement(a.usePid) : undefined;
    const def = p ? itemDef(p.def) : undefined;
    if (!p || !def?.interaction) {
      this.abandonApproach(a); // vanished between plan and arrival
      return;
    }
    a.moving = false;
    a.using = true;
    a.useTimer = USE_MIN + this.rng() * USE_SPAN;
    const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
    const dx = c.x - a.x;
    const dz = c.z - a.z;
    if (def.interaction === 'sit') {
      const len = Math.hypot(dx, dz) || 1;
      a.ox = (dx / len) * SIT_INSET; // lean onto the seat (render only)
      a.oz = (dz / len) * SIT_INSET;
      a.lift = def.sitLift ?? SIT_LIFT_DEFAULT;
      a.yaw = Math.atan2(-dx, -dz); // sit facing outward, back to the bench
      bus.emit('agent:playClip', { id: a.id, clip: 'sit', hold: true });
    } else {
      a.ox = 0;
      a.oz = 0;
      a.lift = 0;
      a.yaw = Math.atan2(dx, dz); // face the fire / fountain / statue
      a.emoteTimer = EMOTE_MIN + this.rng() * EMOTE_SPAN;
    }
  }

  /** Advance a visit: gather agents glance about; everyone eventually strolls on. */
  private tickUsing(a: Agent, dt: number): void {
    if (!a.usePid || !this.island.placement(a.usePid)) {
      this.getUp(a); // furniture removed out from under them
      return;
    }
    a.useTimer -= dt;
    if (a.useKind === 'gather') {
      a.emoteTimer -= dt;
      if (a.emoteTimer <= 0) {
        const emote = CHATTER_EMOTES[Math.floor(this.rng() * CHATTER_EMOTES.length)]!;
        bus.emit('agent:playClip', { id: a.id, clip: emote });
        a.emoteTimer = EMOTE_MIN + this.rng() * EMOTE_SPAN;
      }
    }
    if (a.useTimer <= 0) this.getUp(a);
  }

  /** End a visit normally: release the seat, drop the pose, resume wandering. */
  private getUp(a: Agent): void {
    if (a.useKind === 'sit') bus.emit('agent:clearClip', { id: a.id });
    this.clearUse(a);
    this.rest(a);
  }

  /** Give up an approach before sitting (tap / obstruction / timeout). */
  private abandonApproach(a: Agent): void {
    this.clearUse(a);
    this.rest(a);
  }

  /** Free the claim + wipe furniture state + zero the render offsets. */
  private clearUse(a: Agent): void {
    if (a.usePid) this.claimed.delete(a.usePid);
    a.usePid = null;
    a.useKind = null;
    a.using = false;
    a.ox = 0;
    a.oz = 0;
    a.lift = 0;
  }

  /** A placement was removed — end any visit tied to it and free the claim. */
  private releaseFurniture(pid: string): void {
    this.claimed.delete(pid);
    for (const a of this.list) {
      if (a.usePid !== pid) continue;
      if (a.using && a.useKind === 'sit') bus.emit('agent:clearClip', { id: a.id });
      this.clearUse(a);
      this.rest(a);
    }
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

  // ——— debug (headless verification; ?debug=1 only) ———

  /** Live furniture visits, for the verify harness. */
  debugUsage(): Array<{ id: string; kind: UseKind | null; pid: string | null; using: boolean; lift: number }> {
    return this.list
      .filter((a) => a.usePid)
      .map((a) => ({ id: a.id, kind: a.useKind, pid: a.usePid, using: a.using, lift: a.lift }));
  }

  /** Force the nearest free neighbour onto a piece of furniture immediately (skips the
   *  headless-slow walk). Defaults to the first unclaimed interactive placeable. */
  debugSitNow(pid?: string): { id: string; pid: string; kind: UseKind } | null {
    const furns = this.island.allPlacements().filter((p) => itemDef(p.def)?.interaction);
    const p = pid ? furns.find((f) => f.id === pid) : furns.find((f) => !this.claimed.has(f.id));
    if (!p || this.claimed.has(p.id)) return null; // already taken — one user apiece
    const def = itemDef(p.def)!;
    const a = this.list.find((x) => x.chat <= 0 && !x.usePid);
    if (!a) return null;
    const ap = this.approachCell(a, p, def);
    if (!ap) return null;
    this.claimed.add(p.id);
    a.x = ap.wx + 0.5;
    a.z = ap.wz + 0.5;
    a.moving = false;
    a.usePid = p.id;
    a.useKind = def.interaction!;
    this.beginUsing(a);
    return { id: a.id, pid: p.id, kind: def.interaction! };
  }

  /** End a live visit for the given agent (verify the stand-up path). */
  debugEndUse(id: string): boolean {
    const a = this.list.find((x) => x.id === id && x.using);
    if (!a) return false;
    this.getUp(a);
    return true;
  }
}

/** Shortest-arc slew of `from` toward `to`, capped at `maxStep` radians. */
function turnToward(from: number, to: number, maxStep: number): number {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}
