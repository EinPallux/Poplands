/**
 * Runtime asset access (S4, TECH §7): loads the pipeline's manifest.json, fetches
 * every GLB in the requested phase, caches parsed scenes + clips, hands out clones.
 * v0.1 has a single "boot" phase; phased/lazy loading arrives in v0.3.
 *
 * v0.5: animated agents (S16). The cache now keeps each model's `AnimationClip[]`
 * (previously dropped), and `cloneAnimated` clones via `SkeletonUtils.clone` so a
 * SkinnedMesh's bones rebind to the clone — a plain `scene.clone()` shares the
 * source skeleton and every instance would deform in lockstep.
 */
import { Mesh, type AnimationClip, type Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { bus } from '@/core/events';

export interface ModelMeta {
  file: string;
  bytes: number;
  aabb: { min: [number, number, number]; max: [number, number, number] };
  size: [number, number, number];
  clips: string[];
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
  private loader = new GLTFLoader();

  async loadBoot(baseUrl: string): Promise<void> {
    const res = await fetch(`${baseUrl}assets/models/manifest.json`);
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    const manifest = (await res.json()) as ManifestJson;

    const entries = Object.entries(manifest.models);
    let loaded = 0;
    bus.emit('assets:progress', { phase: 'boot', progress: 0 });

    await Promise.all(
      entries.map(async ([id, meta]) => {
        const gltf = await this.loader.loadAsync(`${baseUrl}${meta.file}`);
        this.cache.set(id, { scene: gltf.scene, meta, clips: gltf.animations });
        loaded++;
        bus.emit('assets:progress', { phase: 'boot', progress: loaded / entries.length });
      }),
    );
    bus.emit('assets:phaseLoaded', { phase: 'boot' });
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
