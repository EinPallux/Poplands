/**
 * Weather (post-1.0 backlog): the occasional gentle passing shower over the whole
 * diorama — a soft rain curtain (one LineSegments draw of streaks) that ramps in,
 * lingers a little, then clears to a low-poly rainbow arching over the island.
 *
 * Rare and slow by construction (a shower every minute-or-three, never busy), the
 * rainbow only shows by day (it needs "sun"), and everything self-wires to island
 * growth so the curtain always covers the current bounds and the arch stays
 * centred. The arch billboard-yaws to the camera so it reads from any orbit angle.
 * Reduced-motion holds the sky calm and clear (no rain, no fades) — matching how
 * ThemeAmbience freezes.
 */
import {
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  Mesh,
  RingGeometry,
} from 'three';
import { bus } from '@/core/events';
import { isReducedMotion } from '@/core/settingsStore';
import type { IslandModel } from './IslandModel';

const RAIN_MAX = 320;
const RAIN_TOP = 12; // curtain height (world units)
const RAIN_PAD = 4; // overhang past the island edge so corners get rain too
const SLANT_X = 0.55; // streaks lean with a light wind
const STREAK_LEN = 0.7;

// Weather modes.
const CLEAR = 0;
const RAINING = 1;
const CLEARING = 2;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

interface Drop {
  x: number;
  y: number;
  z: number;
  v: number; // fall speed
}

export class WeatherSystem {
  readonly group = new Group();

  private rain: LineSegments;
  private rainPos: BufferAttribute;
  private drops: Drop[] = [];
  private minX = 0;
  private minZ = 0;
  private maxX = 16;
  private maxZ = 16;

  private bowGroup = new Group();
  private bowMat: MeshBasicMaterial;

  private night = 0;
  private time = 0;

  // cycle state
  private mode = CLEAR;
  private modeT = 0;
  private nextIn = 45 + Math.random() * 90; // first shower lands a while in
  private rainDur = 0;
  private rainAmt = 0; // eased 0..1 curtain intensity
  private bowActive = false;
  private bowHold = 0;
  private bowAmt = 0; // eased 0..1 arch opacity

  private unsub: () => void;

  constructor(private readonly island: IslandModel) {
    this.group.name = 'weather';

    // — rain: RAIN_MAX two-vertex streaks in one geometry, mutated in place —
    const geo = new BufferGeometry();
    this.rainPos = new BufferAttribute(new Float32Array(RAIN_MAX * 2 * 3), 3);
    geo.setAttribute('position', this.rainPos);
    const rainMat = new LineBasicMaterial({
      color: new Color('#dce8f5'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.rain = new LineSegments(geo, rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.group.add(this.rain);

    this.bowGroup.add(this.buildRainbow());
    this.bowMat = (this.bowGroup.children[0] as Mesh).material as MeshBasicMaterial;
    this.bowGroup.visible = false;
    this.group.add(this.bowGroup);

    this.rescan();
    for (let i = 0; i < RAIN_MAX; i++) this.seedDrop(i, true);
    this.writeDrops();

    this.unsub = bus.on('chunk:unlocked', () => this.rescan());
  }

  dispose(): void {
    this.unsub();
  }

  /** Re-fetch island bounds + centre so the curtain covers growth and the arch
   *  stays over the middle. Cheap — construction + each chunk purchase only. */
  rescan(): void {
    const b = this.island.bounds();
    this.minX = b.minX - RAIN_PAD;
    this.minZ = b.minZ - RAIN_PAD;
    this.maxX = b.maxX + RAIN_PAD;
    this.maxZ = b.maxZ + RAIN_PAD;
    const c = this.island.center();
    this.bowGroup.position.set(c.x, 0, c.z);
  }

  private buildRainbow(): Mesh {
    const inner = 24;
    const outer = 31;
    const geo = new RingGeometry(inner, outer, 64, 6, 0, Math.PI); // upper-half annulus = an arch
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const col = new Color();
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      const frac = clamp01((r - inner) / (outer - inner)); // 0 = inner, 1 = outer
      col.setHSL(0.78 * (1 - frac), 0.7, 0.62); // outer band red → inner band violet
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    const mat = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
      fog: false,
    });
    return new Mesh(geo, mat);
  }

  private seedDrop(i: number, spread: boolean): void {
    const y = spread ? Math.random() * RAIN_TOP : RAIN_TOP + Math.random() * 3;
    this.drops[i] = {
      x: this.minX + Math.random() * (this.maxX - this.minX),
      y,
      z: this.minZ + Math.random() * (this.maxZ - this.minZ),
      v: 13 + Math.random() * 9,
    };
  }

  /** Push the current drop positions into the shared buffer (each drop = 2 verts). */
  private writeDrops(): void {
    const p = this.rainPos;
    for (let i = 0; i < RAIN_MAX; i++) {
      const d = this.drops[i]!;
      p.setXYZ(i * 2, d.x, d.y, d.z);
      p.setXYZ(i * 2 + 1, d.x + SLANT_X, d.y + STREAK_LEN, d.z);
    }
    p.needsUpdate = true;
  }

  update(dt: number, nightFactor: number, camera?: Camera): void {
    this.night = nightFactor;
    this.time += dt;
    const reduced = isReducedMotion();

    if (reduced) {
      // hold the sky calm: fade any lingering effect out, spawn nothing.
      this.rainAmt += (0 - this.rainAmt) * Math.min(1, dt * 3);
      this.bowAmt += (0 - this.bowAmt) * Math.min(1, dt * 3);
    } else {
      this.tickCycle(dt);
      this.updateRain(dt);
    }
    this.applyRain();
    this.applyBow(camera);
  }

  private tickCycle(dt: number): void {
    let target = this.rainAmt;
    if (this.mode === CLEAR) {
      target = 0;
      this.nextIn -= dt;
      if (this.nextIn <= 0) {
        this.mode = RAINING;
        this.modeT = 0;
        this.rainDur = 14 + Math.random() * 12;
      }
    } else if (this.mode === RAINING) {
      target = 1;
      this.modeT += dt;
      if (this.modeT >= this.rainDur) {
        this.mode = CLEARING;
        this.modeT = 0;
        if (this.night < 0.4) this.triggerRainbow(); // a passing shower leaves an arch by day
      }
    } else {
      // CLEARING
      target = 0;
      this.modeT += dt;
      if (this.modeT >= 3 && this.rainAmt < 0.02) {
        this.mode = CLEAR;
        this.nextIn = 70 + Math.random() * 140;
      }
    }
    // ease the curtain in/out slowly so showers arrive and leave gently
    this.rainAmt += (target - this.rainAmt) * Math.min(1, dt * 0.8);

    // rainbow lifetime (independent slow fade)
    if (this.bowActive) {
      this.bowHold -= dt;
      const bowTarget = this.bowHold > 0 ? 1 : 0;
      this.bowAmt += (bowTarget - this.bowAmt) * Math.min(1, dt * 0.5);
      if (this.bowHold <= 0 && this.bowAmt < 0.02) this.bowActive = false;
    } else {
      this.bowAmt += (0 - this.bowAmt) * Math.min(1, dt * 0.5);
    }
  }

  private updateRain(dt: number): void {
    if (this.rainAmt < 0.01) return; // clear → skip the buffer churn entirely
    for (let i = 0; i < RAIN_MAX; i++) {
      const d = this.drops[i]!;
      d.y -= d.v * dt;
      if (d.y < 0) this.seedDrop(i, false);
    }
    this.writeDrops();
  }

  private applyRain(): void {
    const vis = this.rainAmt > 0.01;
    this.rain.visible = vis;
    if (vis) (this.rain.material as LineBasicMaterial).opacity = this.rainAmt * 0.5;
  }

  private applyBow(camera?: Camera): void {
    const vis = this.bowAmt * Math.max(0, 1 - this.night); // day only, even if triggered near dusk
    const on = vis > 0.01;
    this.bowGroup.visible = on;
    if (!on) return;
    this.bowMat.opacity = vis * 0.6;
    if (camera) {
      const dx = camera.position.x - this.bowGroup.position.x;
      const dz = camera.position.z - this.bowGroup.position.z;
      this.bowGroup.rotation.y = Math.atan2(dx, dz); // face the viewer from any orbit
    }
  }

  private triggerRainbow(): void {
    this.bowActive = true;
    this.bowHold = 11; // linger ~11 s after the rain clears
  }

  /** Debug (headless verify): jump straight into a shower / arch. */
  forceShower(): void {
    this.mode = RAINING;
    this.modeT = 0;
    this.rainDur = 20;
    this.nextIn = 9999;
  }
  forceRainbow(): void {
    this.triggerRainbow();
    this.bowAmt = 1; // skip the fade so a headless frame sees it immediately
  }

  /** Debug: is rain / the arch currently drawing? */
  get counts(): { raining: boolean; rainbow: boolean } {
    return { raining: this.rain.visible, rainbow: this.bowGroup.visible };
  }
}
