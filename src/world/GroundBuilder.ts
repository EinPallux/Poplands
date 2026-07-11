/**
 * The buildable lawn (TECH §6.2 "GroundMesh"): per-block grass top quads with a
 * gentle hue checker, one merged mesh per chunk. Only the top surface lives
 * here — the island's sides/underside are the layered slab (SlabBuilder),
 * which wraps the traced outline just outside these quads.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { CHUNK_SIZE } from '@/core/grid';
import { hash2 } from '@/core/math';
import { THEMES } from '@/content/themes';
import type { IslandModel } from './IslandModel';

export function buildGround(island: IslandModel): Group {
  const group = new Group();
  group.name = 'ground';
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const c = new Color();
  const top = new Color();
  const light = new Color();

  for (const chunk of island.allChunks()) {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const palette = THEMES[island.themeAt(chunk.cx, chunk.cz)]; // biome tint (S7/v0.6)
    top.setHex(palette.grassTop);
    light.setHex(palette.grassLight);

    for (let bx = 0; bx < CHUNK_SIZE; bx++) {
      for (let bz = 0; bz < CHUNK_SIZE; bz++) {
        const wx = chunk.cx * CHUNK_SIZE + bx;
        const wz = chunk.cz * CHUNK_SIZE + bz;
        const jitter = ((hash2(wx, wz) % 1000) / 1000) * 0.5;
        c.copy(top).lerp(light, jitter);
        const base = positions.length / 3;
        positions.push(wx, 0, wz, wx, 0, wz + 1, wx + 1, 0, wz + 1, wx + 1, 0, wz);
        for (let i = 0; i < 4; i++) {
          normals.push(0, 1, 0);
          colors.push(c.r, c.g, c.b);
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

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
