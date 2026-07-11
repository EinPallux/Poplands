/**
 * The island base — a chunky layered slab in the style of the user's reference
 * (2026-07-11 review): a grass lip that slightly overhangs, a sandy dirt band,
 * and a tall terracotta rock band tapering to a rounded bottom. The silhouette
 * wobbles organically via smooth value noise sampled in world space, so it is
 * deterministic and seamless as the island grows chunk by chunk.
 *
 * Built by extruding the traced block outline (core/outline) through a ring
 * profile. Each vertical band is an independent strip (duplicated vertices) so
 * color transitions stay crisp while shading within a band stays smooth.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeUtils,
  Vector2,
} from 'three';
import { traceOutlines, refineLoop } from '@/core/outline';
import { valueNoise2 } from '@/core/math';
import { slabColors } from '@/render/palette';
import type { IslandModel } from './IslandModel';

interface ProfileRing {
  /** Base outward offset from the block edge, in blocks. */
  off: number;
  y: number;
  /** How strongly the wobble noise scales this ring's offset. */
  wob: number;
}

interface BandDef {
  top: ProfileRing;
  bottom: ProfileRing;
  colorTop: Color;
  colorBottom: Color;
}

const GRASS_TOP = new Color(slabColors.grassTop);
const GRASS_SIDE = new Color(slabColors.grassSide);
const SAND = new Color(slabColors.sand);
const ROCK = new Color(slabColors.rock);
const ROCK_DEEP = new Color(slabColors.rockDeep);

/** The reference profile: lip → grass side → sand band → rock belly → taper. */
function defaultBands(depthScale = 1): BandDef[] {
  const d = depthScale;
  const r = (off: number, y: number, wob: number): ProfileRing => ({ off, y: y * d, wob });
  const lipOut = r(0.16, 0, 0.1);
  const grassBottom = r(0.16, -0.4, 0.1);
  const sandTop = r(0.05, -0.5, 0.1);
  const sandBottom = r(0.1, -1.25, 0.12);
  const rockTop = r(0.17, -1.5, 0.14);
  const rockLow = r(-0.08, -2.65, 0.16);
  const bottomRim = r(-0.8, -3.25, 0.08);
  return [
    { top: r(0, 0, 0), bottom: lipOut, colorTop: GRASS_TOP, colorBottom: GRASS_TOP }, // horizontal lip
    { top: lipOut, bottom: grassBottom, colorTop: GRASS_SIDE, colorBottom: GRASS_SIDE },
    { top: grassBottom, bottom: sandTop, colorTop: SAND, colorBottom: SAND }, // tuck under lip
    { top: sandTop, bottom: sandBottom, colorTop: SAND, colorBottom: SAND },
    { top: sandBottom, bottom: rockTop, colorTop: ROCK, colorBottom: ROCK }, // rock shoulder
    { top: rockTop, bottom: rockLow, colorTop: ROCK, colorBottom: ROCK_DEEP },
    { top: rockLow, bottom: bottomRim, colorTop: ROCK_DEEP, colorBottom: ROCK_DEEP },
  ];
}

/** Organic wobble sampled in world space (two octaves, signed). */
function wobbleAt(x: number, z: number): number {
  const n1 = valueNoise2(x * 0.33 + 11.7, z * 0.33 + 5.1) - 0.5;
  const n2 = valueNoise2(x * 0.08 + 3.3, z * 0.08 + 9.9) - 0.5;
  return (n1 * 0.7 + n2 * 0.6) * 2; // ≈ [-1.3, 1.3]
}

/**
 * Build the slab for a set of blocks. `depthScale` shrinks the profile for
 * mini-islands (distant islets). Returns one merged mesh per outline loop set.
 */
export function buildSlabFromBlocks(
  blocks: Array<{ wx: number; wz: number }>,
  hasBlock: (wx: number, wz: number) => boolean,
  depthScale = 1,
  opts?: { topQuads?: boolean },
): Group {
  const group = new Group();
  group.name = 'island-base';
  const bands = defaultBands(depthScale);
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Optional grass lids (used by islets; the main island's lawn is GroundBuilder's).
  if (opts?.topQuads) {
    for (const { wx, wz } of blocks) {
      const base = positions.length / 3;
      positions.push(wx, 0, wz, wx, 0, wz + 1, wx + 1, 0, wz + 1, wx + 1, 0, wz);
      for (let i = 0; i < 4; i++) {
        normals.push(0, 1, 0);
        colors.push(GRASS_TOP.r, GRASS_TOP.g, GRASS_TOP.b);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  const loops = traceOutlines(blocks, hasBlock);
  for (const loop of loops) {
    const ring = refineLoop(loop, 2); // points every 0.5 blocks
    const n = ring.length;

    // Per-point wobble, shared by all rings of this column (keeps walls vertical-ish).
    const wobble = ring.map((p) => wobbleAt(p.x, p.z));

    const ringPositions = (def: ProfileRing): Array<[number, number, number]> =>
      ring.map((p, i) => {
        const w = (wobble[i] ?? 0) * def.wob;
        // never let the top rings dip inside the block edge (would open a gap)
        const off = def.off === 0 ? 0 : Math.max(def.off + w, def.off > 0 ? 0.02 : -1.5);
        return [p.x + p.nx * off, def.y, p.z + p.nz * off];
      });

    for (const band of bands) {
      const topPts = ringPositions(band.top);
      const botPts = ringPositions(band.bottom);
      const base = positions.length / 3;
      for (let i = 0; i < n; i++) {
        const t = topPts[i];
        const b = botPts[i];
        if (!t || !b) continue;
        positions.push(...t, ...b);
        // provisional outward normals; smoothed by computeVertexNormals later
        const p = ring[i]!;
        normals.push(p.nx, 0, p.nz, p.nx, 0, p.nz);
        colors.push(
          band.colorTop.r,
          band.colorTop.g,
          band.colorTop.b,
          band.colorBottom.r,
          band.colorBottom.g,
          band.colorBottom.b,
        );
      }
      for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n;
        const a = base + i * 2;
        const b = base + i * 2 + 1;
        const c = base + i2 * 2;
        const d = base + i2 * 2 + 1;
        indices.push(a, b, c, c, b, d);
      }
    }

    // Bottom cap from the lowest ring (earcut triangulation, faces down).
    const bottomDef = bands[bands.length - 1]!.bottom;
    const capPts = ringPositions(bottomDef);
    const contour = capPts.map(([x, , z]) => new Vector2(x, z));
    const area = ShapeUtils.area(contour);
    const ordered = area < 0 ? contour : [...contour].reverse(); // ensure consistent winding
    const shape = new Shape(ordered);
    const tris = ShapeUtils.triangulateShape(shape.getPoints(), []);
    const capBase = positions.length / 3;
    for (const v of shape.getPoints()) {
      positions.push(v.x, bottomDef.y, v.y);
      normals.push(0, -1, 0);
      colors.push(ROCK_DEEP.r, ROCK_DEEP.g, ROCK_DEEP.b);
    }
    for (const tri of tris) {
      // wind so the face points downward
      indices.push(capBase + tri[0]!, capBase + tri[2]!, capBase + tri[1]!);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new Mesh(geo, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  group.add(mesh);
  return group;
}

/** Convenience wrapper for the real island. */
export function buildIslandBase(island: IslandModel): Group {
  const blocks: Array<{ wx: number; wz: number }> = [];
  for (const c of island.allChunks()) {
    for (let bx = 0; bx < 8; bx++) {
      for (let bz = 0; bz < 8; bz++) {
        blocks.push({ wx: c.cx * 8 + bx, wz: c.cz * 8 + bz });
      }
    }
  }
  return buildSlabFromBlocks(blocks, (wx, wz) => island.hasBlock(wx, wz));
}
