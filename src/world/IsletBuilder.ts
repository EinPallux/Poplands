/**
 * Distant parallax islets (ART §5): miniature versions of the island — same
 * layered-slab base at reduced depth, a tree on top. Non-interactive set
 * dressing that makes The Drift feel bigger than your island.
 */
import { Group } from 'three';
import { mulberry32 } from '@/core/math';
import { buildSlabFromBlocks } from './SlabBuilder';
import type { AssetRegistry } from '@/assets/AssetRegistry';

/** Tiny fake block-islands, one per islet, far from the real island's grid. */
const ISLET_SHAPES: Array<Array<[number, number]>> = [
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
];

export function buildIslet(assets: AssetRegistry, index: number): Group {
  const rng = mulberry32(910 + index * 131);
  const group = new Group();
  group.name = `islet-${index}`;

  const shape = ISLET_SHAPES[index % ISLET_SHAPES.length]!;
  const cells = new Set(shape.map(([x, z]) => `${x},${z}`));
  const hasBlock = (wx: number, wz: number) => cells.has(`${wx},${wz}`);
  const blocks = shape.map(([wx, wz]) => ({ wx, wz }));

  const slab = buildSlabFromBlocks(blocks, hasBlock, 0.55, { topQuads: true });
  slab.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  group.add(slab);

  const tree = assets.cloneModel(index % 3 === 0 ? 'nature.pine' : 'nature.tree', {
    castShadow: false,
    receiveShadow: false,
  });
  const cx = shape.reduce((s, [x]) => s + x + 0.5, 0) / shape.length;
  const cz = shape.reduce((s, [, z]) => s + z + 0.5, 0) / shape.length;
  tree.scale.setScalar(1.1 + rng() * 0.5);
  tree.position.set(cx + (rng() - 0.5) * 0.5, 0, cz + (rng() - 0.5) * 0.5);
  group.add(tree);

  // center the islet group on its own footprint so drift orbiting looks right
  group.children.forEach((child) => {
    child.position.x -= cx;
    child.position.z -= cz;
  });

  return group;
}
