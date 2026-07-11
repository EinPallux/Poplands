/**
 * Tier C agent rendering (S16, TECH §6.2): projects the IslanderSystem's `agents`
 * snapshot into animated meshes. Sim owns kinematics (plain numbers); this owns the
 * meshes, one AnimationMixer per agent, and the idle↔walk crossfade — the sim/render
 * seam. Called each frame AFTER the sim integrates, so positions are frame-accurate
 * and set directly (no re-interp needed); only the blend weight eases.
 *
 * Anti-sync (the "12 clones marching in lockstep" tell): each agent gets a ±10%
 * mixer timescale and a random clip phase, so a crowd of the same model never
 * moves as one. Clones share geometry & materials with the cache (SkeletonUtils
 * rebinds only the skeleton) — cheap to spawn, never disposed here.
 */
import {
  Group,
  AnimationMixer,
  AnimationClip,
  LoopOnce,
  Raycaster,
  Vector2,
  type AnimationAction,
  type Camera,
  type Object3D,
} from 'three';
import { bus } from '@/core/events';
import type { AssetRegistry } from '@/assets/AssetRegistry';
import type { AgentView } from '@/sim/IslanderSystem';

const AGENT_SCALE = 1.3; // ~1.0 block tall (models are ~0.78u; cozy, childlike)
const MODEL_YAW_OFFSET = 0; // Pack-2 characters model-face +Z, matching the sim heading
const BLEND_RATE = 12; // idle↔walk weight easing (per second)

interface AgentRec {
  root: Group;
  mixer: AnimationMixer;
  idle: AnimationAction | null;
  walk: AnimationAction | null;
  walkW: number; // current walk blend weight (0 idle … 1 walk)
  timescale: number;
  footY: number; // y that seats the model's lowest point on the ground
  clips: AnimationClip[]; // this model's clip set (for one-shot emotes)
  emote: AnimationAction | null; // one-shot reaction currently playing (else null)
  emoteTime: number; // seconds left on the emote
}

export class AgentRenderer {
  readonly group = new Group();
  private recs = new Map<string, AgentRec>();
  private seen = new Set<string>();
  private raycaster = new Raycaster();
  private pointer = new Vector2();

  constructor(private readonly assets: AssetRegistry) {
    this.group.name = 'agents';
    bus.on('agent:playClip', (e) => this.playClip(e.id, e.clip));
  }

  /** Reconcile meshes to the snapshot, advance animation. Call after sim.update(). */
  sync(agents: readonly AgentView[], dt: number): void {
    this.seen.clear();
    for (const a of agents) {
      this.seen.add(a.id);
      const rec = this.recs.get(a.id) ?? this.spawn(a);
      rec.root.position.set(a.x, rec.footY, a.z);
      rec.root.rotation.y = a.yaw + MODEL_YAW_OFFSET;

      const target = a.moving ? 1 : 0;
      rec.walkW += (target - rec.walkW) * Math.min(1, BLEND_RATE * dt);
      if (rec.emote && rec.emoteTime > 0) {
        // a reaction is playing — it takes the foreground; the walk/idle blend rests
        rec.emoteTime -= dt;
        rec.emote.setEffectiveWeight(1);
        rec.idle?.setEffectiveWeight(0);
        rec.walk?.setEffectiveWeight(0);
        if (rec.emoteTime <= 0) {
          rec.emote.stop();
          rec.emote = null;
        }
      } else {
        rec.idle?.setEffectiveWeight(1 - rec.walkW);
        rec.walk?.setEffectiveWeight(rec.walkW);
      }
      rec.mixer.update(dt * rec.timescale);
    }
    // drop anyone no longer in the roster (robustness; monotonic in v0.5 so rare)
    for (const [id, rec] of this.recs) {
      if (this.seen.has(id)) continue;
      this.group.remove(rec.root);
      this.recs.delete(id);
    }
  }

  private spawn(a: AgentView): AgentRec {
    const { root, clips } = this.assets.cloneAnimated(a.model, { castShadow: true, receiveShadow: false });
    root.scale.setScalar(AGENT_SCALE);
    root.userData['npcId'] = a.id; // so a raycast hit maps back to the roster id
    const minY = this.assets.meta(a.model).aabb.min[1];
    const footY = -minY * AGENT_SCALE; // seat the lowest vertex on y=0

    const mixer = new AnimationMixer(root);
    const idle = bindAction(mixer, clips, 'idle');
    const walk = bindAction(mixer, clips, 'walk');
    // both actions run; weights do the blending. Idle full, walk silent to start.
    idle?.play();
    walk?.play();
    const timescale = 0.9 + Math.random() * 0.2; // ±10% anti-sync
    if (idle) {
      idle.setEffectiveWeight(1);
      idle.time = Math.random() * (idle.getClip().duration || 1); // random phase
    }
    if (walk) {
      walk.setEffectiveWeight(0);
      walk.time = Math.random() * (walk.getClip().duration || 1);
    }

    const rec: AgentRec = {
      root,
      mixer,
      idle,
      walk,
      walkW: 0,
      timescale,
      footY,
      clips,
      emote: null,
      emoteTime: 0,
    };
    this.recs.set(a.id, rec);
    this.group.add(root);
    return rec;
  }

  /** Play a one-shot reaction clip over the idle/walk blend (tap-to-greet emote). */
  private playClip(id: string, clip: string): void {
    const rec = this.recs.get(id);
    if (!rec) return;
    const action = bindAction(rec.mixer, rec.clips, clip);
    if (!action) return;
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset();
    action.play();
    rec.emote = action;
    rec.emoteTime = action.getClip().duration;
  }

  /** Raycast agent meshes at a screen point → the roster id under the cursor (or null). */
  pickAt(clientX: number, clientY: number, camera: Camera): string | null {
    if (this.recs.size === 0) return null;
    this.pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, camera);
    const hits = this.raycaster.intersectObject(this.group, true);
    for (const h of hits) {
      let o: Object3D | null = h.object;
      while (o) {
        const npcId = o.userData['npcId'];
        if (typeof npcId === 'string') return npcId;
        o = o.parent;
      }
    }
    return null;
  }

  get count(): number {
    return this.recs.size;
  }
}

function bindAction(mixer: AnimationMixer, clips: AnimationClip[], name: string): AnimationAction | null {
  const clip = AnimationClip.findByName(clips, name);
  if (!clip) return null;
  const action = mixer.clipAction(clip);
  action.enabled = true;
  return action;
}
