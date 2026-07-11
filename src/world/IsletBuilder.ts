/**
 * Distant parallax islets (ART §5): tiny grass-topped rocks with a single tree,
 * orbiting far from the island. Non-interactive set dressing — they make the
 * world feel bigger than your island.
 */
import { BoxGeometry, BufferAttribute, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { mulberry32 } from '@/core/math';
import type { AssetRegistry } from '@/assets/AssetRegistry';

const GRASS = new Color('#7ecc5b');
const DIRT = new Color('#8a6f56');
const DIRT_DEEP = new Color('#6b5d52');
const ROCK_WARM = new Color('#8a7b6e');

function paintIsletBlock(geo: BoxGeometry): void {
  const pos = geo.getAttribute('position');
  const normal = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  const params = geo.parameters;
  for (let i = 0; i < pos.count; i++) {
    if (normal.getY(i) > 0.5) c.copy(GRASS);
    else c.copy(DIRT).lerp(DIRT_DEEP, Math.min(Math.max(-pos.getY(i) / params.height + 0.5, 0), 1));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
}

export function buildIslet(assets: AssetRegistry, index: number): Group {
  const rng = mulberry32(910 + index * 131);
  const group = new Group();
  group.name = `islet-${index}`;

  const width = 2.2 + rng() * 1.6;
  const topGeo = new BoxGeometry(width, 0.8, width * (0.8 + rng() * 0.4));
  topGeo.translate(0, -0.4, 0);
  paintIsletBlock(topGeo);
  const top = new Mesh(
    topGeo,
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  group.add(top);

  // warm-tinted crag hanging below
  const crag = assets.cloneModel(index % 2 === 0 ? 'skirt.crag-a' : 'skirt.crag-c', {
    castShadow: false,
    receiveShadow: false,
  });
  crag.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh) {
      const mat = (mesh.material as MeshStandardMaterial).clone();
      if (mat.color) {
        mat.color.lerp(ROCK_WARM, 0.5);
        mat.emissive.copy(mat.color).multiplyScalar(0.32); // same shadow lift as the skirt
      }
      mesh.material = mat;
    }
  });
  const cragScale = width * (0.9 + rng() * 0.3);
  crag.scale.setScalar(cragScale);
  crag.rotation.x = Math.PI;
  crag.rotation.y = rng() * Math.PI;
  crag.position.y = -0.7 - cragScale * 0.25;
  group.add(crag);

  const tree = assets.cloneModel(index % 3 === 0 ? 'nature.pine' : 'nature.tree', {
    castShadow: false,
    receiveShadow: false,
  });
  tree.scale.setScalar(1.1 + rng() * 0.5);
  tree.position.set((rng() - 0.5) * width * 0.4, 0, (rng() - 0.5) * width * 0.4);
  group.add(tree);

  return group;
}
