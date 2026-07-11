/**
 * Landmarks — charming fixtures that aren't placements (yet). v0.2 has one:
 * the Old Windmill, composed live from Fantasy Town kit walls with the
 * separate rotor model spinning on top (S20's first ambient animation).
 * Its cells are blocked in the island model; a real windmill building joins
 * the catalog with the Village tier (v0.5, CONTENT §2).
 */
import { Group } from 'three';
import { blockCenter } from '@/core/grid';
import type { AssetRegistry } from '@/assets/AssetRegistry';
import type { IslandModel } from './IslandModel';

const WINDMILL_BLOCK = { wx: 3, wz: 3 };
const WINDMILL_SCALE = 1.15;
const ROTOR_SPEED = 0.6; // rad/s — lazy, cozy

function buildWindmill(assets: AssetRegistry): { group: Group; update: (dt: number) => void } {
  const s = WINDMILL_SCALE;
  const group = new Group();
  group.name = 'landmark-windmill';

  const addWall = (id: string, x: number, z: number, yawQuarter: number, y: number) => {
    const wall = assets.cloneModel(id);
    wall.scale.setScalar(s);
    wall.position.set(x, y, z);
    wall.rotation.y = (yawQuarter * Math.PI) / 2;
    group.add(wall);
  };

  // Kit walls are 1×1 panels, thin in X → yaw 1 quarter-turn makes them run east-west.
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
  // The spin group turns around its local X; the orient group aims that axis south.
  const rotorMesh = assets.cloneModel('building.windmill');
  rotorMesh.scale.setScalar(0.42 * s);
  const spin = new Group();
  spin.add(rotorMesh);
  const orient = new Group();
  orient.add(spin);
  orient.rotation.y = Math.PI / 2;
  orient.position.set(0, 2.55 * s, 0.72 * s);
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

export function buildLandmarks(
  assets: AssetRegistry,
  island: IslandModel,
): { group: Group; update: (dt: number) => void } {
  const group = new Group();
  group.name = 'landmarks';
  const windmill = buildWindmill(assets);
  group.add(windmill.group);
  island.markBlocked([WINDMILL_BLOCK]);
  return { group, update: windmill.update };
}
