/**
 * Pooled particle puffs (S12): tiny flat-shaded spheres — matching the world's
 * puffball-cloud language — for dust rings, removal poofs, and later hearts &
 * confetti. Zero allocation on emit; one InstancedMesh, one draw call.
 */
import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { isReducedMotion } from '@/core/settingsStore';

const MAX = 128;
const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const tmpScaleV = new Vector3();
const tmpPos = new Vector3();

interface Puff {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

const DUST = new Color('#efe3c4');
const POOF = new Color('#ffffff');

export class Particles {
  readonly mesh: InstancedMesh;
  private puffs: Puff[] = [];

  constructor() {
    const geo = new SphereGeometry(0.5, 6, 4);
    const mat = new MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: 0.35,
      flatShading: true,
      roughness: 1,
    });
    this.mesh = new InstancedMesh(geo, mat, MAX);
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  }

  /** Ground-level ring of dust kicked outward (placement landing). */
  dustRing(x: number, z: number, radius = 0.45): void {
    if (isReducedMotion()) return;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      this.spawn({
        x: x + Math.cos(a) * radius * 0.5,
        y: 0.08,
        z: z + Math.sin(a) * radius * 0.5,
        vx: Math.cos(a) * (1.6 + Math.random() * 0.7),
        vy: 0.6 + Math.random() * 0.5,
        vz: Math.sin(a) * (1.6 + Math.random() * 0.7),
        life: 0,
        maxLife: 0.38 + Math.random() * 0.12,
        size: 0.16 + Math.random() * 0.1,
      }, DUST);
    }
  }

  /** Puffy cloud burst (removal, chest pops…). */
  poof(x: number, y: number, z: number, scale = 1): void {
    if (isReducedMotion()) return;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.3 * scale;
      this.spawn({
        x: x + Math.cos(a) * r,
        y: y + Math.random() * 0.3,
        z: z + Math.sin(a) * r,
        vx: Math.cos(a) * (0.8 + Math.random() * 0.6) * scale,
        vy: 1.1 + Math.random() * 0.9,
        vz: Math.sin(a) * (0.8 + Math.random() * 0.6) * scale,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.15,
        size: (0.22 + Math.random() * 0.14) * scale,
      }, POOF);
    }
  }

  private spawn(p: Puff, color: Color): void {
    if (this.puffs.length >= MAX) this.puffs.shift(); // shed oldest gracefully
    this.puffs.push(p);
    const index = this.puffs.length - 1;
    this.mesh.setColorAt(index, color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    const list = this.puffs;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!;
      p.life += dt;
      if (p.life >= p.maxLife) {
        const last = list.length - 1;
        if (i !== last) list[i] = list[last]!;
        list.pop();
        continue;
      }
      p.vy -= 1.6 * dt; // soft gravity pull after the initial rise
      p.vx *= 1 - 2.5 * dt;
      p.vz *= 1 - 2.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    // write matrices (compact array — order changes are invisible for puffs)
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      const t = p.life / p.maxLife;
      const s = p.size * (1 + t * 1.6) * (1 - t * t); // grow then shrink out
      tmpPos.set(p.x, p.y, p.z);
      tmpScaleV.setScalar(Math.max(s, 0.0001));
      this.mesh.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScaleV));
    }
    this.mesh.count = list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
