/**
 * Runtime asset access (S4, TECH §7): loads the pipeline's manifest.json, fetches
 * every GLB in the requested phase, caches parsed scenes, hands out clones.
 * v0.1 has a single "boot" phase; phased/lazy loading arrives in v0.3.
 */
import { Mesh, type Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
        this.cache.set(id, { scene: gltf.scene, meta });
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
    const cast = opts?.castShadow ?? true;
    const receive = opts?.receiveShadow ?? true;
    clone.traverse((o: Object3D) => {
      if (o instanceof Mesh) {
        o.castShadow = cast;
        o.receiveShadow = receive;
      }
    });
    return clone;
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
