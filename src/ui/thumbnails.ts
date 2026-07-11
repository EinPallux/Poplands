/**
 * Catalog thumbnails: each item rendered once at boot from its real model with
 * a tiny offscreen renderer (96², warm three-quarter view), returned as data
 * URLs. ~25 items ≈ a few ms each; renderer is disposed afterwards.
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  OrthographicCamera,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { AssetRegistry } from '@/assets/AssetRegistry';
import { CATALOG } from '@/content/catalog';

export function renderThumbnails(assets: AssetRegistry): Map<string, string> {
  const out = new Map<string, string>();
  const size = 96;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return out; // thumbnails are progressive enhancement
  }
  renderer.setSize(size, size);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.add(new AmbientLight('#dfeaff', 1.6));
  const sun = new DirectionalLight('#fff3d6', 2.2);
  sun.position.set(2, 3, 2.4);
  scene.add(sun);

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 50);

  for (const def of CATALOG) {
    if (!assets.has(def.model)) continue; // model in a not-yet-loaded phase (S4) — re-run on assets:phaseLoaded
    try {
      const model = assets.cloneModel(def.model, { castShadow: false, receiveShadow: false });
      scene.add(model);
      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      const sphere = box.getBoundingSphere(new Sphere());
      const radius = Math.max(sphere.radius, 0.001);
      const r = radius * 1.15;
      camera.left = -r;
      camera.right = r;
      camera.top = r;
      camera.bottom = -r;
      camera.position.copy(center).add(new Vector3(1, 0.9, 1).normalize().multiplyScalar(radius * 3));
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      out.set(def.id, renderer.domElement.toDataURL());
      scene.remove(model);
    } catch {
      // leave the card imageless — name/cost still render
    }
  }
  renderer.dispose();
  return out;
}
