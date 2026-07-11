/**
 * The whole look from two lights (ART §4): one warm directional sun with a
 * tight shadow frustum fitted to the island, one hemisphere fill.
 */
import { DirectionalLight, HemisphereLight, Group, Vector3 } from 'three';
import { palette } from './palette';
import type { QualityConfig } from './Quality';

export interface IslandBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export class Lights {
  readonly group = new Group();
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  /** Normalized direction the sunlight travels FROM (toward the island). */
  readonly sunDirection = new Vector3(-0.55, 1.0, 0.42).normalize();

  constructor() {
    // Ratio tuned so shadowed faces stay warm and readable, never black (ART §4).
    this.hemi = new HemisphereLight(palette.hemiSky, palette.hemiGround, 1.35);
    this.sun = new DirectionalLight(palette.sun, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.group.add(this.hemi, this.sun, this.sun.target);
  }

  /** Refit the ortho shadow box to the island (called on growth, not per frame — S5). */
  fitShadowsTo(bounds: IslandBounds): void {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    // Half-diagonal + margin covers any sun azimuth; +air for tall props & skirt.
    const radius = Math.hypot(spanX, spanZ) / 2 + 6;

    this.sun.position.copy(this.sunDirection).multiplyScalar(46).add(new Vector3(cx, 0, cz));
    this.sun.target.position.set(cx, 0, cz);

    const cam = this.sun.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.updateProjectionMatrix();
  }

  applyQuality(config: QualityConfig): void {
    const size = config.shadowMapSize;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.castShadow = config.shadowsEnabled;
  }
}
