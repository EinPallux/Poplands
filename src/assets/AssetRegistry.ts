/**
 * Runtime asset access (S4, TECH §7): loads the pipeline's manifest.json, fetches
 * GLBs in phased waves (boot → early → themed:<biome>), caches parsed scenes +
 * clips, hands out clones. First paint waits only on `boot`; `early` and the
 * per-biome themed waves stream in later (idle-after-boot, level-up, chunk arrival).
 *
 * v0.5: animated agents (S16). The cache keeps each model's `AnimationClip[]`, and
 * `cloneAnimated` clones via `SkeletonUtils.clone` so a SkinnedMesh's bones rebind
 * to the clone — a plain `scene.clone()` shares the source skeleton and every
 * instance would deform in lockstep.
 *
 * v0.6: phased/lazy loading. `loadBoot` fetches only `phase:'boot'`; `loadPhase`
 * streams a later wave (idempotent), `ensure` force-loads one id on demand, and a
 * `pending` promise map de-dupes concurrent loads of the same id (no double-fetch).
 */
import { Mesh, type AnimationClip, type Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { bus } from '@/core/events';
import type { AssetPhase } from '@/content/assetPhases';

export interface ModelMeta {
  file: string;
  bytes: number;
  aabb: { min: [number, number, number]; max: [number, number, number] };
  size: [number, number, number];
  clips: string[];
  phase: AssetPhase;
}

interface ManifestJson {
  models: Record<string, ModelMeta>;
}

interface CachedModel {
  scene: Group;
  meta: ModelMeta;
  clips: AnimationClip[];
}

function applyShadowFlags(obj: Object3D, cast: boolean, receive: boolean): void {
  obj.traverse((o: Object3D) => {
    if (o instanceof Mesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

export class AssetRegistry {
  private cache = new Map<string, CachedModel>();
  private pending = new Map<string, Promise<CachedModel>>();
  private loader = new GLTFLoader();
  private manifest: ManifestJson | null = null;
  private loadedPhases = new Set<AssetPhase>();
  private baseUrl = '';

  /** Fetch the manifest + the boot wave. First paint waits on this alone. */
  async loadBoot(baseUrl: string): Promise<void> {
    this.baseUrl = baseUrl;
    const res = await fetch(`${baseUrl}assets/models/manifest.json`);
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    this.manifest = (await res.json()) as ManifestJson;
    await this.loadPhase('boot');
  }

  /** Load every model in a phase. Idempotent — an already-loaded phase resolves at once. */
  async loadPhase(phase: AssetPhase): Promise<void> {
    if (this.loadedPhases.has(phase)) return;
    if (!this.manifest) throw new Error('[assets] loadPhase before loadBoot');
    const entries = Object.entries(this.manifest.models).filter(([, m]) => m.phase === phase);
    let loaded = 0;
    bus.emit('assets:progress', { phase, progress: entries.length ? 0 : 1 });
    await Promise.all(
      entries.map(async ([id, meta]) => {
        await this.loadOne(id, meta);
        loaded++;
        bus.emit('assets:progress', { phase, progress: loaded / entries.length });
      }),
    );
    this.loadedPhases.add(phase);
    bus.emit('assets:phaseLoaded', { phase });
  }

  /** Force one id to load regardless of phase — the interactive-placement escape hatch. */
  async ensure(id: string): Promise<void> {
    if (this.cache.has(id)) return;
    const meta = this.manifest?.models[id];
    if (!meta) throw new Error(`[assets] unknown model id: ${id}`);
    await this.loadOne(id, meta);
  }

  /** The phase a model belongs to, or null if the id is unknown / manifest not loaded. */
  phaseOf(id: string): AssetPhase | null {
    return this.manifest?.models[id]?.phase ?? null;
  }

  /** Load + cache one model, de-duping concurrent requests via the pending map. */
  private loadOne(id: string, meta: ModelMeta): Promise<CachedModel> {
    const cached = this.cache.get(id);
    if (cached) return Promise.resolve(cached);
    let p = this.pending.get(id);
    if (!p) {
      p = this.loader.loadAsync(`${this.baseUrl}${meta.file}`).then((gltf) => {
        const entry: CachedModel = { scene: gltf.scene, meta, clips: gltf.animations };
        this.cache.set(id, entry);
        this.pending.delete(id);
        return entry;
      });
      this.pending.set(id, p);
    }
    return p;
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  meta(id: string): ModelMeta {
    return this.entry(id).meta;
  }

  /**
   * A fresh clone of the model's scene, shadow flags applied. Geometry & materials
   * stay shared with the cache (cheap clones, zero duplicate GPU uploads).
   */
  cloneModel(id: string, opts?: { castShadow?: boolean; receiveShadow?: boolean }): Group {
    const { scene } = this.entry(id);
    const clone = scene.clone(true);
    applyShadowFlags(clone, opts?.castShadow ?? true, opts?.receiveShadow ?? true);
    return clone;
  }

  /**
   * A skeleton-rebinding clone plus the model's animation clips — for Tier C agents
   * (S16). `SkeletonUtils.clone` deep-copies bones and rewires each SkinnedMesh to
   * the copy, so every agent animates independently; the clips are shared read-only
   * (an AnimationMixer references them without mutating). Falls back gracefully for
   * node-animated models (pets), where it behaves like a plain deep clone.
   */
  cloneAnimated(
    id: string,
    opts?: { castShadow?: boolean; receiveShadow?: boolean },
  ): { root: Group; clips: AnimationClip[] } {
    const { scene, clips } = this.entry(id);
    // justified: SkeletonUtils.clone returns Object3D but preserves the root's
    // concrete type (a GLTF scene root is always a Group).
    const root = cloneSkinned(scene) as Group;
    applyShadowFlags(root, opts?.castShadow ?? true, opts?.receiveShadow ?? false);
    return { root, clips };
  }

  /** The cached (shared) scene — for geometry extraction (ground merging). Do not mutate. */
  sharedScene(id: string): Group {
    return this.entry(id).scene;
  }

  private entry(id: string): CachedModel {
    const entry = this.cache.get(id);
    if (!entry) throw new Error(`[assets] unknown model id: ${id}`);
    return entry;
  }
}
