/**
 * Prop rendering tiers (S10, TECH §6.2): placements → meshes.
 *
 * - Tier A (instanced): high-count small items in one InstancedMesh pool per
 *   item def (merged sub-meshes, material array preserved via geometry groups).
 *   Placement pops use promote-animate-demote: a temporary real Object3D plays
 *   the juice, then the instance matrix is baked into the pool.
 * - Tier B (unique): buildings & anything with animated parts — cloned scenes.
 *
 * Placements are the truth (TECH §4): this class only projects them.
 */
import type {
  Object3D} from 'three';
import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { footprintCenter, rotYaw } from '@/core/grid';
import { DIRS, resolveTileShape } from '@/core/autotile';
import { itemDef, type ItemDef } from '@/content/catalog';
import { TILE_KITS } from '@/content/tileKits';
import type { IslandModel, Placement, PlacementId } from '@/world/IslandModel';
import type { AssetRegistry } from '@/assets/AssetRegistry';
import { palette } from '@/render/palette';

const tmpMatrix = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpBox = new Box3();

/** A small round badge canvas for the ghost validity cue — icon, not colour alone
 *  (GDD §11 colour-blind support). Built once per glyph and cached on the renderer. */
function makeGlyphTexture(glyph: string, ink: string): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = `800 ${size * 0.6}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + 2);
  }
  return new CanvasTexture(canvas);
}

/** Merge a model's meshes into one geometry (groups preserved) + material list. */
function mergeModel(scene: Group): { geometry: BufferGeometry; materials: Material[] } {
  const geos: BufferGeometry[] = [];
  const materials: Material[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o instanceof Mesh) {
      const geo = (o.geometry as BufferGeometry).clone();
      geo.applyMatrix4(o.matrixWorld);
      geos.push(geo);
      materials.push(o.material as Material);
    }
  });
  const geometry = mergeGeometries(geos, true);
  for (const g of geos) g.dispose();
  if (!geometry) throw new Error('mergeModel: empty model');
  return { geometry, materials };
}

class InstancedPool {
  mesh: InstancedMesh;
  private ids: PlacementId[] = [];
  private indexOf = new Map<PlacementId, number>();

  constructor(
    private readonly parent: Group,
    private readonly geometry: BufferGeometry,
    private readonly materials: Material[],
    capacity = 16,
  ) {
    this.mesh = this.makeMesh(capacity);
    parent.add(this.mesh);
  }

  private makeMesh(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(
      this.geometry,
      this.materials.length === 1 ? this.materials[0]! : this.materials,
      capacity,
    );
    mesh.count = this.ids.length;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // instance bounds ≠ geometry bounds; island is always on screen
    return mesh;
  }

  private grow(): void {
    const bigger = this.makeMesh(this.mesh.instanceMatrix.count * 2);
    for (let i = 0; i < this.ids.length; i++) {
      this.mesh.getMatrixAt(i, tmpMatrix);
      bigger.setMatrixAt(i, tmpMatrix);
    }
    bigger.count = this.ids.length;
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = bigger;
    this.parent.add(this.mesh);
  }

  add(id: PlacementId, matrix: Matrix4): void {
    if (this.ids.length >= this.mesh.instanceMatrix.count) this.grow();
    const index = this.ids.length;
    this.ids.push(id);
    this.indexOf.set(id, index);
    this.mesh.setMatrixAt(index, matrix);
    this.mesh.count = this.ids.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  remove(id: PlacementId): boolean {
    const index = this.indexOf.get(id);
    if (index === undefined) return false;
    const last = this.ids.length - 1;
    if (index !== last) {
      const movedId = this.ids[last]!;
      this.mesh.getMatrixAt(last, tmpMatrix);
      this.mesh.setMatrixAt(index, tmpMatrix);
      this.ids[index] = movedId;
      this.indexOf.set(movedId, index);
    }
    this.ids.pop();
    this.indexOf.delete(id);
    this.mesh.count = this.ids.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  has(id: PlacementId): boolean {
    return this.indexOf.has(id);
  }

  get count(): number {
    return this.ids.length;
  }
}

export class PropRenderer {
  readonly group = new Group();
  private pools = new Map<string, InstancedPool>();
  private merged = new Map<string, { geometry: BufferGeometry; materials: Material[] }>();
  private uniques = new Map<PlacementId, Object3D>();
  /** For auto-tile items only: the pool key each placement currently lives in
   *  (its resolved shape can change as neighbours come and go). */
  private groundPoolKey = new Map<PlacementId, string>();
  /** Placements whose model is still streaming in (S4 lazy-loading). Flushed to a
   *  plain `show()` the moment `assets.ensure` resolves; cancelled if removed first. */
  private pendingShow = new Map<PlacementId, Placement>();

  private readonly ghostValid: MeshStandardMaterial;
  private readonly ghostInvalid: MeshStandardMaterial;
  private readonly validIconTex: CanvasTexture;
  private readonly invalidIconTex: CanvasTexture;

  constructor(
    private readonly assets: AssetRegistry,
    private readonly island: IslandModel,
  ) {
    this.group.name = 'props';
    const ghostBase = {
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      roughness: 0.9,
      metalness: 0,
    };
    this.ghostValid = new MeshStandardMaterial({ ...ghostBase, color: palette.accentMint });
    this.ghostInvalid = new MeshStandardMaterial({ ...ghostBase, color: palette.accentCoral });
    this.validIconTex = makeGlyphTexture('✓', '#2f9e5c');
    this.invalidIconTex = makeGlyphTexture('✕', '#c0392b');
  }

  /** World transform for a placement (origin: footprint center on the ground). */
  matrixFor(def: ItemDef, wx: number, wz: number, rot: 0 | 1 | 2 | 3, scale = def.scale): Matrix4 {
    const c = footprintCenter(wx, wz, def.footprint, rot);
    tmpPos.set(c.x, def.yOffset ?? 0, c.z);
    tmpQuat.setFromAxisAngle(new Vector3(0, 1, 0), rotYaw(rot));
    tmpScale.setScalar(scale);
    return new Matrix4().compose(tmpPos, tmpQuat, tmpScale);
  }

  /** Every model a def could render with. For a tile kit that's the fallback + all
   *  variant GLBs (auto-tiling can resolve to any of them, and neighbours re-resolve
   *  as the mask changes), so the whole kit must be present before we commit — the
   *  base being cached is NOT enough (the variants ride the same lazy phase and land
   *  at independent times within loadPhase's Promise.all). */
  private modelsFor(def: ItemDef): string[] {
    if (!def.tileKit) return [def.model];
    const kit = TILE_KITS[def.tileKit];
    if (!kit) return [def.model];
    return [def.model, kit.fallback, ...Object.values(kit.variants)];
  }

  private modelsReady(def: ItemDef): boolean {
    return this.modelsFor(def).every((m) => this.assets.has(m));
  }

  /** Instantly show a placement (no animation) — used for bulk rebuild on load. */
  show(placement: Placement): void {
    const def = itemDef(placement.def);
    if (!def) return;
    if (!this.modelsReady(def)) {
      this.deferShow(placement, def);
      return;
    }
    if (def.renderTier === 'instanced') {
      this.commitInstanced(placement, def);
    } else {
      const obj = this.assets.cloneModel(def.model);
      this.applyTransform(obj, def, placement);
      this.uniques.set(placement.id, obj);
      this.group.add(obj);
    }
  }

  /** Queue a placement whose model(s) haven't streamed in yet (S4). Kicks the on-demand
   *  loads (all of them, incl. a tile kit's variants — else commitInstanced would later
   *  resolve to an uncached variant and throw), then flushes to a plain `show()` — unless
   *  the placement was removed first. A load failure drops the entry (no leak / no
   *  unhandled rejection); a reload's rebuildAll retries from truth. */
  private deferShow(placement: Placement, def: ItemDef): void {
    this.pendingShow.set(placement.id, placement);
    void Promise.all(this.modelsFor(def).map((m) => this.assets.ensure(m)))
      .then(() => {
        if (this.pendingShow.get(placement.id) === placement) {
          this.pendingShow.delete(placement.id);
          this.show(placement);
        }
      })
      .catch((err: unknown) => {
        this.pendingShow.delete(placement.id);
        console.error(`[props] deferred model load failed for ${def.id}`, err);
      });
  }

  /**
   * Promote a placement to a temporary real Object3D (for juice), to be baked
   * with `bake()` when the animation finishes. Returns the temp object, placed
   * at its final transform (caller animates scale/position around it).
   */
  promote(placement: Placement): Object3D | null {
    const def = itemDef(placement.def);
    if (!def) return null;
    if (!this.modelsReady(def)) {
      // model(s) still streaming in: skip the pop-in juice this once, show it plain
      // the moment they land (never a crash on a freshly-unlocked interactive place,
      // incl. a tile kit whose variant GLBs haven't arrived — bake() would resolve
      // to an uncached variant otherwise).
      this.deferShow(placement, def);
      return null;
    }
    const obj = this.assets.cloneModel(def.model);
    this.applyTransform(obj, def, placement);
    this.group.add(obj);
    if (def.renderTier === 'unique') {
      this.uniques.set(placement.id, obj); // uniques keep their promoted object
    }
    return obj;
  }

  /** Finish a promote: instanced items bake into the pool; uniques just stay. */
  bake(placement: Placement, promoted: Object3D): void {
    const def = itemDef(placement.def);
    if (!def) return;
    if (def.renderTier === 'instanced') {
      this.group.remove(promoted);
      this.commitInstanced(placement, def);
    }
  }

  /**
   * Remove a placement's visual, returning a temporary clone for the pop-out
   * juice (caller disposes via `finishRemove`). Null if nothing was shown.
   */
  extract(placement: Placement): Object3D | null {
    const def = itemDef(placement.def);
    if (!def) return null;
    if (this.pendingShow.delete(placement.id)) return null; // removed before its model landed
    if (def.renderTier === 'instanced') {
      const key = def.tileKit ? this.groundPoolKey.get(placement.id) : def.id;
      const pool = key ? this.pools.get(key) : undefined;
      if (!pool?.remove(placement.id)) return null;
      if (def.tileKit) {
        this.groundPoolKey.delete(placement.id);
        this.refreshGroundNeighbors(def, placement.wx, placement.wz); // placement already gone from sim
      }
      const obj = this.assets.cloneModel(def.model);
      this.applyTransform(obj, def, placement);
      this.group.add(obj);
      return obj;
    }
    const obj = this.uniques.get(placement.id);
    if (!obj) return null;
    this.uniques.delete(placement.id);
    return obj;
  }

  /** Remove without animation (move-pickup, bulk clear). */
  hide(placement: Placement): void {
    const def = itemDef(placement.def);
    if (!def) return;
    if (this.pendingShow.delete(placement.id)) return; // hidden before its model landed
    if (def.renderTier === 'instanced') {
      const key = def.tileKit ? this.groundPoolKey.get(placement.id) : def.id;
      if (key) this.pools.get(key)?.remove(placement.id);
      if (def.tileKit) {
        this.groundPoolKey.delete(placement.id);
        this.refreshGroundNeighbors(def, placement.wx, placement.wz);
      }
    } else {
      const obj = this.uniques.get(placement.id);
      if (obj) {
        this.group.remove(obj);
        this.uniques.delete(placement.id);
      }
    }
  }

  finishRemove(obj: Object3D): void {
    this.group.remove(obj);
  }

  rebuildAll(placements: Placement[]): void {
    // clear uniques
    for (const obj of this.uniques.values()) this.group.remove(obj);
    this.uniques.clear();
    // clear pools (cheap: drop meshes entirely; pools re-created lazily)
    for (const pool of this.pools.values()) {
      this.group.remove(pool.mesh);
      pool.mesh.dispose();
    }
    this.pools.clear();
    this.groundPoolKey.clear();
    this.pendingShow.clear();
    for (const p of placements) this.show(p);
  }

  /** A ghost preview object for a def, with swappable validity tint. If the model
   *  hasn't streamed in yet (S4), a footprint-sized box stands in and the real GLB
   *  loads in the background — the preview is never a crash, just briefly a box.
   *  `dispose()` frees the ghost-owned badge material + placeholder geometry (the
   *  cloned model's geometry/materials are shared with the cache — never disposed);
   *  BuildSession calls it on teardown so repeated tool/item switches don't orphan. */
  makeGhost(
    defId: string,
  ): { object: Object3D; setValid: (valid: boolean) => void; dispose: () => void } | null {
    const def = itemDef(defId);
    if (!def) return null;
    const owned: Array<{ dispose: () => void }> = [];
    let object: Object3D;
    let hostScale: number;
    if (this.assets.has(def.model)) {
      object = this.assets.cloneModel(def.model, { castShadow: false, receiveShadow: false });
      object.scale.setScalar(def.scale);
      hostScale = def.scale;
    } else {
      void this.assets.ensure(def.model); // stream it in; the real ghost isn't rebuilt, but placement will show it
      const boxGeo = new BoxGeometry(Math.max(1, def.footprint.w) * 0.85, 1, Math.max(1, def.footprint.d) * 0.85);
      owned.push(boxGeo);
      const box = new Mesh(boxGeo, this.ghostValid);
      box.position.y = 0.5;
      const holder = new Group();
      holder.add(box);
      object = holder;
      hostScale = 1;
    }

    // Non-colour validity cue (GDD §11): a check/cross badge floating above the
    // ghost, so the valid/invalid state reads without relying on the mint/coral
    // tint. Sizes are divided by hostScale so the badge is a constant world size
    // regardless of the model it sits on. One-time alloc on ghost creation only.
    tmpBox.setFromObject(object);
    const topLocalY = tmpBox.isEmpty() ? 1 : tmpBox.max.y / hostScale;
    const iconMaterial = new SpriteMaterial({
      map: this.validIconTex,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    owned.push(iconMaterial);
    const icon = new Sprite(iconMaterial);
    icon.position.set(0, topLocalY + 0.35 / hostScale, 0);
    icon.scale.setScalar(0.6 / hostScale);
    object.add(icon);

    const setValid = (valid: boolean) => {
      const mat = valid ? this.ghostValid : this.ghostInvalid;
      object.traverse((o) => {
        if (o instanceof Mesh) o.material = mat;
      });
      iconMaterial.map = valid ? this.validIconTex : this.invalidIconTex;
      iconMaterial.needsUpdate = true;
    };
    setValid(true);
    return { object, setValid, dispose: () => owned.forEach((o) => o.dispose()) };
  }

  private pool(poolKey: string, modelId: string): InstancedPool {
    let pool = this.pools.get(poolKey);
    if (!pool) {
      let merged = this.merged.get(modelId);
      if (!merged) {
        merged = mergeModel(this.assets.sharedScene(modelId));
        this.merged.set(modelId, merged);
      }
      pool = new InstancedPool(this.group, merged.geometry, merged.materials);
      this.pools.set(poolKey, pool);
    }
    return pool;
  }

  // ——— auto-tiling (S10, v0.6) ———

  /** OR of DIRS bits for same-kit neighbours around (wx,wz). */
  private groundMask(tileKit: string, wx: number, wz: number): number {
    let mask = 0;
    for (const { dx, dz, bit } of DIRS) {
      const occ = this.island.occupantAt(wx + dx, wz + dz, { preferGround: true });
      if (occ && itemDef(occ.def)?.tileKit === tileKit) mask |= bit;
    }
    return mask;
  }

  /** Resolve a placement to its pool key + model + rotation. Non-kit items are
   *  identity (pool key = def.id, model = def.model, rot = placement.rot). */
  private resolveVariant(
    placement: Placement,
    def: ItemDef,
  ): { poolKey: string; modelId: string; rot: 0 | 1 | 2 | 3 } {
    if (!def.tileKit) return { poolKey: def.id, modelId: def.model, rot: placement.rot };
    const kit = TILE_KITS[def.tileKit]!;
    const { shape, rot } = resolveTileShape(this.groundMask(def.tileKit, placement.wx, placement.wz));
    const modelId = shape === 'isolated' ? kit.fallback : (kit.variants[shape] ?? kit.fallback);
    return { poolKey: `${def.id}::${shape}`, modelId, rot };
  }

  /** Commit an instanced placement into its resolved pool (moving pools if the
   *  shape changed), then ripple to same-kit neighbours whose shape may shift. */
  private commitInstanced(placement: Placement, def: ItemDef): void {
    const v = this.resolveVariant(placement, def);
    const prev = this.groundPoolKey.get(placement.id);
    if (prev === v.poolKey && this.pools.get(prev)?.has(placement.id)) return; // no-op
    if (prev) this.pools.get(prev)?.remove(placement.id);
    this.pool(v.poolKey, v.modelId).add(placement.id, this.matrixFor(def, placement.wx, placement.wz, v.rot));
    if (def.tileKit) {
      this.groundPoolKey.set(placement.id, v.poolKey);
      this.refreshGroundNeighbors(def, placement.wx, placement.wz);
    }
  }

  /** Re-resolve already-rendered same-kit neighbours (their mask just changed). */
  private refreshGroundNeighbors(def: ItemDef, wx: number, wz: number): void {
    for (const { dx, dz } of DIRS) {
      const occ = this.island.occupantAt(wx + dx, wz + dz, { preferGround: true });
      const nDef = occ && itemDef(occ.def);
      if (!occ || !nDef || nDef.tileKit !== def.tileKit) continue;
      if (!this.groundPoolKey.has(occ.id)) continue; // not currently shown
      this.commitInstanced(occ, nDef);
    }
  }

  private applyTransform(obj: Object3D, def: ItemDef, placement: Placement): void {
    const c = footprintCenter(placement.wx, placement.wz, def.footprint, placement.rot);
    obj.position.set(c.x, def.yOffset ?? 0, c.z);
    obj.rotation.y = rotYaw(placement.rot);
    obj.scale.setScalar(def.scale);
  }

  get stats(): { pools: number; instanced: number; uniques: number } {
    let instanced = 0;
    for (const pool of this.pools.values()) instanced += pool.count;
    return { pools: this.pools.size, instanced, uniques: this.uniques.size };
  }

  /** Debug: the resolved auto-tile shape a placement is currently rendered as. */
  shapeOf(placementId: PlacementId): string | null {
    const key = this.groundPoolKey.get(placementId);
    return key ? (key.split('::')[1] ?? null) : null;
  }
}
