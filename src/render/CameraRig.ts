/**
 * The diorama camera (GDD §11.1, S6): perspective 35°, damped orbit around the
 * island, clamped polar & distance, pan limited to island bounds + margin.
 * Nothing else may move the camera; juice never shakes it (ART rule).
 */
import { PerspectiveCamera, Vector3, MathUtils } from 'three';
import { damp, dampAngle } from '@/core/spring';
import { clamp, TAU } from '@/core/math';
import { tweens, easings } from '@/core/tween';
import { bus } from '@/core/events';
import type { IslandBounds } from './Lights';

const DEG = Math.PI / 180;

const POLAR_MIN = 30 * DEG;
const POLAR_MAX = 65 * DEG;
const POLAR_DEFAULT = 50 * DEG;
const DIST_MIN = 10;
const DIST_MAX = 70;
const AZIMUTH_DEFAULT = -38 * DEG;
const PAN_MARGIN = 7;
const RESPONSIVENESS = 9; // damping lambda — snappy but cushioned

export class CameraRig {
  readonly camera: PerspectiveCamera;

  // goals (set by input) vs current (damped toward goals each frame)
  private azimuthGoal = AZIMUTH_DEFAULT;
  private polarGoal = POLAR_DEFAULT;
  private distanceGoal = 32;
  private targetGoal = new Vector3(8, 0, 8);

  private azimuth = AZIMUTH_DEFAULT;
  private polar = POLAR_DEFAULT;
  private distance = 32;
  private target = new Vector3(8, 0, 8);

  private defaultDistance = 32;
  private defaultTarget = new Vector3(8, 0, 8);
  private bounds: IslandBounds = { minX: 0, minZ: 0, maxX: 16, maxZ: 16 };
  private moved = false;
  private introPlaying = false;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(35, aspect, 0.5, 900);
    this.applyImmediate();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Frame the island: center target, fit distance to bounds (eases there). */
  frameIsland(bounds: IslandBounds): void {
    this.bounds = bounds;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const radius = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2;
    const fitDist = clamp((radius * 1.32) / Math.tan((this.camera.fov * DEG) / 2), DIST_MIN, DIST_MAX);
    this.defaultTarget.set(cx, 0, cz);
    this.defaultDistance = fitDist;
    this.targetGoal.copy(this.defaultTarget);
    this.distanceGoal = fitDist;
  }

  orbitBy(dAzimuth: number, dPolar: number): void {
    if (this.introPlaying) return;
    this.azimuthGoal += dAzimuth;
    this.polarGoal = clamp(this.polarGoal + dPolar, POLAR_MIN, POLAR_MAX);
  }

  /** Snap azimuth to the next 45° step in the given direction (Q/E). */
  snapAzimuth(direction: 1 | -1): void {
    if (this.introPlaying) return;
    const step = 45 * DEG;
    const current = Math.round(this.azimuthGoal / step);
    this.azimuthGoal = (current + direction) * step;
  }

  /** Pan in screen space (pixels are pre-scaled by caller); clamped to island bounds. */
  panBy(rightAmount: number, forwardAmount: number): void {
    if (this.introPlaying) return;
    const sin = Math.sin(this.azimuth);
    const cos = Math.cos(this.azimuth);
    // camera right on ground plane, and camera-forward flattened to the ground
    const rx = cos;
    const rz = -sin;
    const fx = -sin;
    const fz = -cos;
    this.targetGoal.x += rx * rightAmount + fx * forwardAmount;
    this.targetGoal.z += rz * rightAmount + fz * forwardAmount;
    this.targetGoal.x = clamp(this.targetGoal.x, this.bounds.minX - PAN_MARGIN, this.bounds.maxX + PAN_MARGIN);
    this.targetGoal.z = clamp(this.targetGoal.z, this.bounds.minZ - PAN_MARGIN, this.bounds.maxZ + PAN_MARGIN);
  }

  zoomBy(factor: number): void {
    if (this.introPlaying) return;
    this.distanceGoal = clamp(this.distanceGoal * factor, DIST_MIN, DIST_MAX);
  }

  reset(): void {
    if (this.introPlaying) return;
    this.azimuthGoal = AZIMUTH_DEFAULT;
    this.polarGoal = POLAR_DEFAULT;
    this.distanceGoal = this.defaultDistance;
    this.targetGoal.copy(this.defaultTarget);
  }

  /** Load-in swoop: start high & far, glide to the default framing (skippable feel, 2.4 s). */
  introSwoop(onDone?: () => void): void {
    this.introPlaying = true;
    const fromDistance = this.defaultDistance * 2.1;
    const fromPolar = 63 * DEG;
    const fromAzimuth = AZIMUTH_DEFAULT + 55 * DEG;
    this.distance = fromDistance;
    this.polar = fromPolar;
    this.azimuth = fromAzimuth;
    this.distanceGoal = fromDistance;
    this.polarGoal = fromPolar;
    this.azimuthGoal = fromAzimuth;
    this.applyImmediate();

    tweens.start({
      duration: 2.4,
      ease: easings.cubicInOut,
      onUpdate: (t) => {
        this.distanceGoal = MathUtils.lerp(fromDistance, this.defaultDistance, t);
        this.polarGoal = MathUtils.lerp(fromPolar, POLAR_DEFAULT, t);
        this.azimuthGoal = MathUtils.lerp(fromAzimuth, AZIMUTH_DEFAULT, t);
      },
      onComplete: () => {
        this.introPlaying = false;
        onDone?.();
      },
    });
  }

  /** Scale factor so pan/orbit gestures feel identical at any zoom. */
  get panWorldPerPixel(): number {
    return (this.distance * Math.tan((this.camera.fov * DEG) / 2) * 2) / window.innerHeight;
  }

  get state(): { azimuth: number; polar: number; distance: number } {
    return { azimuth: ((this.azimuth % TAU) + TAU) % TAU, polar: this.polar, distance: this.distance };
  }

  update(dt: number): void {
    const before = this.moved;
    this.azimuth = dampAngle(this.azimuth, this.azimuthGoal, RESPONSIVENESS, dt);
    this.polar = damp(this.polar, this.polarGoal, RESPONSIVENESS, dt);
    this.distance = damp(this.distance, this.distanceGoal, RESPONSIVENESS, dt);
    this.target.x = damp(this.target.x, this.targetGoal.x, RESPONSIVENESS, dt);
    this.target.y = damp(this.target.y, this.targetGoal.y, RESPONSIVENESS, dt);
    this.target.z = damp(this.target.z, this.targetGoal.z, RESPONSIVENESS, dt);
    this.applyImmediate();
    if (before !== this.moved) bus.emit('camera:moved', undefined);
  }

  private applyImmediate(): void {
    const sinP = Math.sin(this.polar);
    this.camera.position.set(
      this.target.x + Math.sin(this.azimuth) * sinP * this.distance,
      this.target.y + Math.cos(this.polar) * this.distance,
      this.target.z + Math.cos(this.azimuth) * sinP * this.distance,
    );
    this.camera.lookAt(this.target);
    this.moved = true;
  }
}
