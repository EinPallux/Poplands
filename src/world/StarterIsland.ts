/**
 * The pre-built 2×2-chunk starter island (GDD §5.1): a lightly decorated, well-composed
 * vignette that photographs well from second zero and demonstrates good composition
 * (ART §6). Hardcoded layout for v0.1 — v0.2 replaces this with real placements
 * flowing through the placement system.
 *
 * Includes v0.1's animated showpiece: a small windmill tower composed from Fantasy
 * Town kit walls with the separate rotor model spinning on top (S20 tease).
 */
import { Group } from 'three';
import { blockCenter } from '@/core/grid';
import type { AssetRegistry } from '@/assets/AssetRegistry';

interface PropPlacement {
  id: string;
  wx: number;
  wz: number;
  /** Uniform scale to hit the design footprint (tuned against pipeline AABBs). */
  scale: number;
  /** Yaw in quarter turns (matches Rot semantics). */
  rot?: number;
  y?: number;
}

// Scales tuned against manifest AABBs: trees ~2.2 blocks tall, hut fills 3×3, etc.
const PROPS: PropPlacement[] = [
  // — buildings
  { id: 'building.house', wx: 10, wz: 5, scale: 3.0, rot: 2 }, // 3×4 home, door toward the path
  { id: 'building.stall', wx: 13, wz: 11, scale: 1.9, rot: 1 }, // 2×2 stall by the path

  // — path from the hut door heading south, then west (L-shape)
  ...[
    [10, 7],
    [10, 8],
    [10, 9],
    [10, 10],
    [9, 10],
    [8, 10],
    [7, 10],
    [6, 10],
    [5, 10],
  ].map(([wx, wz]) => ({ id: 'ground.path-stone', wx: wx ?? 0, wz: wz ?? 0, scale: 1, y: 0.001 })),

  // — fenced flower garden west side
  { id: 'deco.fence', wx: 4, wz: 8, scale: 1 },
  { id: 'deco.fence-gate', wx: 5, wz: 8, scale: 1 },
  { id: 'deco.fence', wx: 6, wz: 8, scale: 1 },
  { id: 'nature.flower-purple', wx: 4, wz: 5, scale: 2.0 },
  { id: 'nature.flower-red', wx: 5, wz: 5, scale: 2.0 },
  { id: 'nature.flower-yellow', wx: 6, wz: 5, scale: 2.0 },
  { id: 'nature.flower-red', wx: 4, wz: 7, scale: 2.0 },
  { id: 'nature.flower-yellow', wx: 5, wz: 6, scale: 2.0 },
  { id: 'nature.flower-purple', wx: 6, wz: 7, scale: 2.0 },

  // — seating & light along the path
  { id: 'deco.bench', wx: 8, wz: 11, scale: 1.1, rot: 2 },
  { id: 'deco.lantern', wx: 6, wz: 9, scale: 1 },
  { id: 'deco.lantern', wx: 11, wz: 10, scale: 1 },

  // — flowers near the stall
  { id: 'nature.flower-purple', wx: 14, wz: 12, scale: 2.0 },
  { id: 'nature.flower-red', wx: 12, wz: 13, scale: 2.0 },

  // — trees & shrubs framing the edges (tall stays central-ish, small at rims)
  { id: 'nature.tree', wx: 2, wz: 12, scale: 1.3 },
  { id: 'nature.tree', wx: 13, wz: 2, scale: 1.25, rot: 2 },
  { id: 'nature.tree', wx: 14, wz: 13, scale: 1.35, rot: 1 },
  { id: 'nature.pine', wx: 1, wz: 8, scale: 1.6 },
  { id: 'nature.pine', wx: 6, wz: 2, scale: 1.5, rot: 3 },
  { id: 'nature.bush', wx: 3, wz: 10, scale: 1.8 },
  { id: 'nature.bush', wx: 12, wz: 7, scale: 1.8, rot: 1 },
  { id: 'nature.bush', wx: 8, wz: 3, scale: 1.6, rot: 2 },

  // — small life scattered toward the rims
  { id: 'nature.grass', wx: 2, wz: 5, scale: 1.5 },
  { id: 'nature.grass', wx: 8, wz: 13, scale: 1.5, rot: 1 },
  { id: 'nature.grass', wx: 13, wz: 6, scale: 1.4, rot: 2 },
  { id: 'nature.grass', wx: 4, wz: 9, scale: 1.5, rot: 3 },
  { id: 'nature.grass', wx: 10, wz: 2, scale: 1.4 },
  { id: 'nature.grass', wx: 15, wz: 9, scale: 1.5, rot: 1 },
  { id: 'nature.grass', wx: 0, wz: 3, scale: 1.4 },
  { id: 'nature.mushroom', wx: 1, wz: 14, scale: 1.9 },
  { id: 'nature.rock-small', wx: 15, wz: 8, scale: 1.4 },
  { id: 'nature.rock-small', wx: 2, wz: 2, scale: 1.5, rot: 2 },
];

const WINDMILL_BLOCK = { wx: 3, wz: 3 };
const WINDMILL_SCALE = 1.15;
const ROTOR_SPEED = 0.6; // rad/s — lazy, cozy

function buildWindmill(assets: AssetRegistry): { group: Group; update: (dt: number) => void } {
  const s = WINDMILL_SCALE;
  const group = new Group();
  group.name = 'windmill';

  const addWall = (id: string, x: number, z: number, yawQuarter: number, y: number) => {
    const wall = assets.cloneModel(id);
    wall.scale.setScalar(s);
    wall.position.set(x, y, z);
    wall.rotation.y = (yawQuarter * Math.PI) / 2;
    group.add(wall);
  };

  // Kit walls are 1×1 panels, thin in X → yaw 1 quarter-turn makes them run east-west.
  // Warm wood variants — the stone set reads cold on a meadow (ART palette).
  for (const floor of [0, 1]) {
    const y = floor * s;
    addWall(floor === 0 ? 'kit.wall-wood-door' : 'kit.wall-wood-window', 0, s / 2, 1, y); // south
    addWall('kit.wall-wood', 0, -s / 2, 1, y); // north
    addWall('kit.wall-wood', -s / 2, 0, 0, y); // west
    addWall(floor === 0 ? 'kit.wall-wood' : 'kit.wall-wood-window', s / 2, 0, 0, y); // east
  }
  const roof = assets.cloneModel('kit.roof-point');
  roof.scale.setScalar(s);
  roof.position.y = 2 * s;
  group.add(roof);

  // Rotor: the pack's `windmill` model is the 4-blade rotor (thin in X → faces ±X).
  // spin group turns around its local X; the orient group aims that axis south.
  const rotorMesh = assets.cloneModel('building.windmill');
  rotorMesh.scale.setScalar(0.42 * s);
  const spin = new Group();
  spin.add(rotorMesh);
  const orient = new Group();
  orient.add(spin);
  orient.rotation.y = Math.PI / 2; // rotor plane faces ±Z (south)
  orient.position.set(0, 2.55 * s, 0.72 * s); // hub snug against the roof face
  group.add(orient);

  const { x, z } = blockCenter(WINDMILL_BLOCK.wx, WINDMILL_BLOCK.wz);
  group.position.set(x, 0, z);

  return {
    group,
    update: (dt) => {
      spin.rotation.x += dt * ROTOR_SPEED;
    },
  };
}

export function buildStarterIsland(assets: AssetRegistry): {
  group: Group;
  update: (dt: number) => void;
} {
  const group = new Group();
  group.name = 'starter-props';

  for (const p of PROPS) {
    const model = assets.cloneModel(p.id);
    const { x, z } = blockCenter(p.wx, p.wz);
    model.position.set(x, p.y ?? 0, z);
    model.scale.setScalar(p.scale);
    if (p.rot) model.rotation.y = (p.rot * Math.PI) / 2;
    group.add(model);
  }

  const windmill = buildWindmill(assets);
  group.add(windmill.group);

  return { group, update: windmill.update };
}
