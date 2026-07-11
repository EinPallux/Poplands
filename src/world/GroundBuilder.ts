/**
 * Ground & skirt construction (TECH §6.2 "GroundMesh", ART §5 "the skirt").
 *
 * Ground: custom vertex-colored boxes (grass top with per-block hue jitter, warm
 * dirt sides) merged into ONE mesh per island — the clean "lawn" read the art
 * direction wants, at 1–2 draw calls. Prop models supply the organic detail.
 * Skirt: warm-tinted rocky crags hang beneath the rim + a tapering keel cluster
 * under the center, so the underside is beautiful when players orbit low.
 * Deterministic per island via seeded RNG.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Matrix4,
  Quaternion,
  Vector3,
  Euler,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHUNK_SIZE, blockCenter } from '@/core/grid';
import { mulberry32, hash2, TAU } from '@/core/math';
import type { AssetRegistry } from '@/assets/AssetRegistry';
import type { IslandModel } from './IslandModel';

const GRASS_TOP = new Color('#7ecc5b');
const GRASS_TOP_LIGHT = new Color('#95d96e');
const DIRT_SIDE = new Color('#9a7a5c');
const DIRT_DEEP = new Color('#6b5d52');
const ROCK_WARM = new Color('#8a7b6e');

/** Collect (geometry, material) pairs from a model scene with world transforms baked. */
function collectMeshes(scene: Group): Array<{ geometry: BufferGeometry; material: Material }> {
  const out: Array<{ geometry: BufferGeometry; material: Material }> = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o instanceof Mesh) {
      const geo = (o.geometry as BufferGeometry).clone();
      geo.applyMatrix4(o.matrixWorld);
      out.push({ geometry: geo, material: o.material as Material });
    }
  });
  return out;
}

/** Merge many transformed copies of models into as few meshes as possible (per material). */
class MergeBucket {
  private byMaterial = new Map<Material, BufferGeometry[]>();

  constructor(private readonly materialMap?: (m: Material) => Material) {}

  addModel(scene: Group, transform: Matrix4): void {
    for (const { geometry, material } of collectMeshes(scene)) {
      geometry.applyMatrix4(transform);
      const mat = this.materialMap ? this.materialMap(material) : material;
      let list = this.byMaterial.get(mat);
      if (!list) {
        list = [];
        this.byMaterial.set(mat, list);
      }
      list.push(geometry);
    }
  }

  build(opts: { castShadow: boolean; receiveShadow: boolean }): Mesh[] {
    const meshes: Mesh[] = [];
    for (const [material, geos] of this.byMaterial) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new Mesh(merged, material);
      mesh.castShadow = opts.castShadow;
      mesh.receiveShadow = opts.receiveShadow;
      mesh.matrixAutoUpdate = false;
      meshes.push(mesh);
    }
    return meshes;
  }
}

const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const tmpEuler = new Euler();
const tmpScale = new Vector3();
const tmpPos = new Vector3();

function composeMatrix(
  x: number,
  y: number,
  z: number,
  yaw: number,
  scale: number,
  pitch = 0,
  roll = 0,
): Matrix4 {
  tmpEuler.set(pitch, yaw, roll);
  tmpQuat.setFromEuler(tmpEuler);
  tmpScale.setScalar(scale);
  tmpPos.set(x, y, z);
  return tmpMatrix.compose(tmpPos, tmpQuat, tmpScale).clone();
}

/**
 * Ground: hand-built face-culled mesh per chunk — per-block grass top quads
 * (with hue jitter), dirt side quads only on outward boundary edges, and a
 * bottom lid. No hidden internal faces → no z-fighting, minimal triangles.
 * Top surface at y = 0, blocks are 1 unit deep.
 */
export function buildGround(island: IslandModel): Group {
  const group = new Group();
  group.name = 'ground';
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });

  for (const chunk of island.allChunks()) {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const c = new Color();

    const quad = (
      corners: [number, number, number][],
      normal: [number, number, number],
      vertexColors: Color[],
    ) => {
      const base = positions.length / 3;
      for (let i = 0; i < 4; i++) {
        const corner = corners[i];
        const col = vertexColors[i];
        if (!corner || !col) continue;
        positions.push(...corner);
        normals.push(...normal);
        colors.push(col.r, col.g, col.b);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    const x0 = chunk.cx * CHUNK_SIZE;
    const z0 = chunk.cz * CHUNK_SIZE;

    for (let bx = 0; bx < CHUNK_SIZE; bx++) {
      for (let bz = 0; bz < CHUNK_SIZE; bz++) {
        const wx = x0 + bx;
        const wz = z0 + bz;
        const jitter = ((hash2(wx, wz) % 1000) / 1000) * 0.55;
        c.copy(GRASS_TOP).lerp(GRASS_TOP_LIGHT, jitter);
        const top = c.clone();
        // top lid (ccw seen from above → normal +Y)
        quad(
          [
            [wx, 0, wz],
            [wx, 0, wz + 1],
            [wx + 1, 0, wz + 1],
            [wx + 1, 0, wz],
          ],
          [0, 1, 0],
          [top, top, top, top],
        );
        // outward side faces where the neighbor block is off-island
        const sides: Array<{ nx: number; nz: number; corners: [number, number][] }> = [
          { nx: 1, nz: 0, corners: [[wx + 1, wz + 1], [wx + 1, wz]] },
          { nx: -1, nz: 0, corners: [[wx, wz], [wx, wz + 1]] },
          { nx: 0, nz: 1, corners: [[wx, wz + 1], [wx + 1, wz + 1]] },
          { nx: 0, nz: -1, corners: [[wx + 1, wz], [wx, wz]] },
        ];
        for (const side of sides) {
          if (island.hasBlock(wx + side.nx, wz + side.nz)) continue;
          const [a, b] = side.corners;
          if (!a || !b) continue;
          quad(
            [
              [a[0], 0, a[1]],
              [b[0], 0, b[1]],
              [b[0], -1, b[1]],
              [a[0], -1, a[1]],
            ],
            [side.nx, 0, side.nz],
            [DIRT_SIDE, DIRT_SIDE, DIRT_DEEP, DIRT_DEEP],
          );
        }
      }
    }
    // bottom lid (facing down)
    quad(
      [
        [x0, -1, z0],
        [x0 + CHUNK_SIZE, -1, z0],
        [x0 + CHUNK_SIZE, -1, z0 + CHUNK_SIZE],
        [x0, -1, z0 + CHUNK_SIZE],
      ],
      [0, -1, 0],
      [DIRT_DEEP, DIRT_DEEP, DIRT_DEEP, DIRT_DEEP],
    );

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    geo.setIndex(indices);
    const mesh = new Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  return group;
}

/** The rocky underside: rim crags and a central tapering keel. */
export function buildSkirt(island: IslandModel, assets: AssetRegistry, seed = 7): Group {
  const rng = mulberry32(seed);
  const group = new Group();
  group.name = 'skirt';

  // Warm-tint the crag materials toward the palette's stone color (cached clones).
  const tintCache = new Map<Material, Material>();
  const warmTint = (m: Material): Material => {
    let tinted = tintCache.get(m);
    if (!tinted) {
      tinted = (m as MeshStandardMaterial).clone();
      const std = tinted as MeshStandardMaterial;
      if (std.color) {
        std.color.lerp(ROCK_WARM, 0.45);
        // flipped crags face away from every light — lift their shadow side so
        // the underbelly reads warm stone, not a black void
        std.emissive.copy(std.color).multiplyScalar(0.32);
      }
      tintCache.set(m, tinted);
    }
    return tinted;
  };
  const bucket = new MergeBucket(warmTint);

  const cragIds = ['skirt.crag-a', 'skirt.crag-b', 'skirt.crag-c'];
  const pick = () => assets.sharedScene(cragIds[Math.floor(rng() * cragIds.length)] ?? 'skirt.crag-a');

  // Rim ring: crags tucked UNDER the island edge (inset, overlapping the dirt
  // band) so they read as continuous bedrock, not dangling teeth.
  for (const edge of island.edgeCells()) {
    if (rng() < 0.22) continue;
    const { x, z } = blockCenter(edge.wx, edge.wz);
    // pull inward from the open edge so the crag body hides under the ground
    const ix = -edge.nx * (0.3 + rng() * 0.25);
    const iz = -edge.nz * (0.3 + rng() * 0.25);
    const scale = 1.7 + rng() * 1.0;
    bucket.addModel(
      pick(),
      composeMatrix(
        x + ix + (rng() - 0.5) * 0.5,
        -0.55 - rng() * 0.3, // top overlaps the dirt band (ground bottom is −1)
        z + iz + (rng() - 0.5) * 0.5,
        rng() * TAU,
        scale,
        Math.PI + (rng() - 0.5) * 0.4, // flipped: pointy end down
        (rng() - 0.5) * 0.4,
      ),
    );
    // (hanging moss was tried here and cut — its thin planes read as black
    // shards when backfacing; revisit with a DoubleSide material in v0.2)
  }

  // Central keel: inverted crags tapering to a point beneath the middle.
  const { x: cx, z: cz } = island.center();
  const b = island.bounds();
  const islandRadius = Math.min(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
  const keelDepth = Math.max(3.2, islandRadius * 0.55);
  const layers = 4;
  for (let layer = 0; layer < layers; layer++) {
    const t = layer / (layers - 1); // 0 top … 1 tip
    const layerRadius = islandRadius * (0.68 - 0.56 * t);
    const layerY = -0.5 - keelDepth * t;
    const count = Math.max(1, Math.round((1 - t) * 8));
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const r = layerRadius * (0.35 + rng() * 0.65);
      const scale = (2.6 - 1.3 * t) * (1.6 + rng() * 0.9);
      bucket.addModel(
        pick(),
        composeMatrix(
          cx + Math.cos(a) * r,
          layerY - scale * 0.25,
          cz + Math.sin(a) * r,
          rng() * TAU,
          scale,
          Math.PI + (rng() - 0.5) * 0.3,
          (rng() - 0.5) * 0.3,
        ),
      );
    }
  }

  const meshes = bucket.build({ castShadow: false, receiveShadow: false });
  group.add(...meshes);
  return group;
}
