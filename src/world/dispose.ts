/**
 * Free GPU resources for a discarded Object3D subtree (geometries + materials).
 * Used when the island base/ground are rebuilt on chunk growth so we don't leak
 * the old merged meshes (TECH §6.5 — heap must stay flat under the soak test).
 */
import type { Object3D, Mesh, Material } from 'three';

export function disposeObject(obj: Object3D): void {
  obj.traverse((o) => {
    const m = o as Partial<Mesh>;
    m.geometry?.dispose();
    const mat = m.material as Material | Material[] | undefined;
    if (Array.isArray(mat)) for (const x of mat) x.dispose();
    else mat?.dispose();
  });
}
