/**
 * Theme ambience (S20, v0.6): per-biome atmosphere — a Spooky Grove gets faint
 * ground mist + bats, a Snowcap gets gentle snowfall, a Sandbar gets sun-glinting
 * sand drift. Cheap by construction: one fixed-size pool per effect regardless of
 * how many themed chunks exist (mirrors AmbientLife's fireflies), driven by the
 * day-night `nightFactor`. Reduced-motion holds everything frozen. Self-wires to
 * `chunk:unlocked` so growth needs no extra App wiring.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  type Texture,
} from 'three';
import { bus } from '@/core/events';
import { isReducedMotion } from '@/core/settingsStore';
import { CHUNK_SIZE, chunksBounds, type ChunkCoord } from '@/core/grid';
import { TAU } from '@/core/math';
import type { IslandModel } from './IslandModel';

function makeSoftDot(): CanvasTexture {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

function chunkCenter(c: ChunkCoord): { x: number; z: number } {
  return { x: c.cx * CHUNK_SIZE + CHUNK_SIZE / 2, z: c.cz * CHUNK_SIZE + CHUNK_SIZE / 2 };
}

const MIST_MAX = 18;
const BAT_MAX = 8;
const SNOW_MAX = 220;
const SAND_MAX = 26;

interface MistPuff {
  sprite: Sprite;
  anchorX: number;
  anchorZ: number;
  angle: number;
  radius: number;
  speed: number;
  y: number;
  phase: number;
}
interface Bat {
  sprite: Sprite;
  anchorX: number;
  anchorZ: number;
  t: number;
  speed: number;
  radius: number;
  y: number;
}
interface SandMote {
  sprite: Sprite;
  angle: number;
  speed: number;
  phase: number;
}
type Bounds = { minX: number; minZ: number; maxX: number; maxZ: number } | null;

export class ThemeAmbience {
  readonly group = new Group();
  private tex: Texture;
  private night = 0;
  private time = 0;

  private spookyChunks: ChunkCoord[] = [];
  private snowChunks: ChunkCoord[] = [];
  private sandChunks: ChunkCoord[] = [];

  private mistGroup = new Group();
  private mist: MistPuff[] = [];
  private batGroup = new Group();
  private bats: Bat[] = [];
  private snowPoints: Points;
  private snowVel = new Float32Array(SNOW_MAX);
  private snowBounds: Bounds = null;
  private sandGroup = new Group();
  private sand: SandMote[] = [];
  private sandBounds: Bounds = null;

  private unsub: () => void;

  constructor(private readonly island: IslandModel) {
    this.group.name = 'theme-ambience';
    this.tex = makeSoftDot();
    this.group.add(this.mistGroup, this.batGroup, this.sandGroup);

    this.buildMistPool();
    this.buildBatPool();
    this.snowPoints = this.buildSnow();
    this.group.add(this.snowPoints);
    this.buildSandPool();

    this.rescan();
    this.unsub = bus.on('chunk:unlocked', () => this.rescan());
  }

  dispose(): void {
    this.unsub();
  }

  /** Re-bucket the biome chunk sets from island truth, then re-lay the pools. Runs
   *  on construction + each chunk purchase (never per frame). Rebuild-from-truth so
   *  it's correct regardless of how a chunk got added (event or debug). */
  rescan(): void {
    this.spookyChunks.length = 0;
    this.snowChunks.length = 0;
    this.sandChunks.length = 0;
    for (const c of this.island.allChunks()) {
      const theme = this.island.themeAt(c.cx, c.cz);
      if (theme === 'spooky') this.spookyChunks.push({ cx: c.cx, cz: c.cz });
      else if (theme === 'snowcap') this.snowChunks.push({ cx: c.cx, cz: c.cz });
      else if (theme === 'sandbar') this.sandChunks.push({ cx: c.cx, cz: c.cz });
    }
    this.layout();
  }

  private buildMistPool(): void {
    for (let i = 0; i < MIST_MAX; i++) {
      const sprite = new Sprite(
        new SpriteMaterial({ map: this.tex, color: new Color('#39304f'), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }),
      );
      sprite.scale.set(3.2, 1.1, 1);
      this.mistGroup.add(sprite);
      this.mist.push({ sprite, anchorX: 0, anchorZ: 0, angle: Math.random() * TAU, radius: 0, speed: 0.05 + Math.random() * 0.08, y: 0.15, phase: Math.random() * TAU });
    }
  }

  private buildBatPool(): void {
    for (let i = 0; i < BAT_MAX; i++) {
      const sprite = new Sprite(
        new SpriteMaterial({ map: this.tex, color: new Color('#14101c'), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }),
      );
      sprite.scale.set(0.5, 0.3, 1);
      this.batGroup.add(sprite);
      this.bats.push({ sprite, anchorX: 0, anchorZ: 0, t: Math.random() * TAU, speed: 0.6 + Math.random() * 0.4, radius: 2 + Math.random() * 1.5, y: 3.5 + Math.random() * 1.5 });
    }
  }

  private buildSnow(): Points {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(SNOW_MAX * 3), 3));
    const mat = new PointsMaterial({ map: this.tex, color: '#ffffff', size: 0.22, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
    const pts = new Points(geo, mat);
    pts.visible = false;
    pts.frustumCulled = false;
    return pts;
  }

  private buildSandPool(): void {
    for (let i = 0; i < SAND_MAX; i++) {
      const sprite = new Sprite(
        new SpriteMaterial({ map: this.tex, color: new Color('#ffe3a3'), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }),
      );
      sprite.scale.setScalar(0.16);
      this.sandGroup.add(sprite);
      this.sand.push({ sprite, angle: Math.random() * TAU, speed: 0.08 + Math.random() * 0.15, phase: Math.random() * TAU });
    }
  }

  /** Reassign the fixed pools to the current themed-chunk set. Cheap: runs once at
   *  construction and once per chunk purchase, never per frame. */
  private layout(): void {
    const spooky = this.spookyChunks;
    this.mistGroup.visible = spooky.length > 0;
    this.batGroup.visible = spooky.length > 0;
    if (spooky.length > 0) {
      for (let i = 0; i < this.mist.length; i++) {
        const c = chunkCenter(spooky[i % spooky.length]!);
        const m = this.mist[i]!;
        m.anchorX = c.x;
        m.anchorZ = c.z;
        m.radius = 0.5 + Math.random() * (CHUNK_SIZE * 0.35);
      }
      for (let i = 0; i < this.bats.length; i++) {
        const c = chunkCenter(spooky[(i * 3) % spooky.length]!);
        const b = this.bats[i]!;
        b.anchorX = c.x;
        b.anchorZ = c.z;
      }
    }

    this.sandBounds = chunksBounds(this.sandChunks);
    this.sandGroup.visible = this.sandBounds !== null;

    this.snowBounds = chunksBounds(this.snowChunks);
    this.snowPoints.visible = this.snowBounds !== null;
    if (this.snowBounds) this.seedSnow(this.snowBounds);
  }

  private seedSnow(b: NonNullable<Bounds>): void {
    const pos = this.snowPoints.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < SNOW_MAX; i++) {
      pos.setXYZ(i, b.minX + Math.random() * (b.maxX - b.minX), Math.random() * 6, b.minZ + Math.random() * (b.maxZ - b.minZ));
      this.snowVel[i] = 0.6 + Math.random() * 0.8;
    }
    pos.needsUpdate = true;
  }

  update(dt: number, nightFactor: number): void {
    this.night = nightFactor;
    this.time += dt;
    const reduced = isReducedMotion();
    this.updateMist(dt, reduced);
    this.updateBats(dt, reduced);
    this.updateSnow(dt, reduced);
    this.updateSand(dt, reduced);
  }

  private updateMist(dt: number, reduced: boolean): void {
    if (!this.mistGroup.visible) return;
    for (const m of this.mist) {
      if (!reduced) m.angle += m.speed * dt;
      const bob = reduced ? 0 : Math.sin(this.time * 0.4 + m.phase) * 0.4;
      m.sprite.position.set(m.anchorX + Math.cos(m.angle) * m.radius, m.y + bob, m.anchorZ + Math.sin(m.angle) * m.radius);
      m.sprite.material.opacity = 0.05 + 0.27 * this.night; // faint always, stronger at night
    }
  }

  private updateBats(dt: number, reduced: boolean): void {
    if (!this.batGroup.visible) return;
    const active = this.night > 0.35; // nocturnal
    for (const b of this.bats) {
      if (!reduced && active) b.t += b.speed * dt;
      const flap = reduced ? 0.4 : 0.22 + 0.18 * Math.abs(Math.sin(this.time * 9 + b.t * 3));
      b.sprite.scale.set(1.5 * flap, 0.3, 1); // squash/stretch = wingbeat
      b.sprite.position.set(b.anchorX + Math.sin(b.t) * b.radius, b.y + Math.sin(b.t * 2) * 0.4, b.anchorZ + Math.sin(b.t * 0.5) * b.radius);
      const target = active ? 0.85 : 0;
      b.sprite.material.opacity += (target - b.sprite.material.opacity) * Math.min(1, dt * 2);
    }
  }

  private updateSnow(dt: number, reduced: boolean): void {
    if (!this.snowPoints.visible || !this.snowBounds || reduced) return; // reduced: hold frame
    const pos = this.snowPoints.geometry.getAttribute('position') as BufferAttribute;
    const b = this.snowBounds;
    for (let i = 0; i < SNOW_MAX; i++) {
      let y = pos.getY(i) - this.snowVel[i]! * dt;
      if (y < 0) {
        y = 5 + Math.random() * 2;
        pos.setX(i, b.minX + Math.random() * (b.maxX - b.minX));
        pos.setZ(i, b.minZ + Math.random() * (b.maxZ - b.minZ));
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  private updateSand(dt: number, reduced: boolean): void {
    if (!this.sandGroup.visible || !this.sandBounds) return;
    const b = this.sandBounds;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const spread = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
    for (const s of this.sand) {
      if (!reduced) s.angle += s.speed * dt;
      const bob = reduced ? 0 : Math.sin(this.time * 1.1 + s.phase) * 0.15;
      s.sprite.position.set(cx + Math.cos(s.angle) * spread * 0.7, 0.1 + bob, cz + Math.sin(s.angle) * spread * 0.7);
      const flicker = reduced ? 0.75 : 0.5 + 0.5 * Math.sin(this.time * 4 + s.phase);
      s.sprite.material.opacity = (1 - this.night) * flicker * 0.8; // sun-glint reads by day
    }
  }

  /** Debug: which effects are currently active (for headless verification). */
  get counts(): { mist: boolean; snow: boolean; sand: boolean } {
    return { mist: this.mistGroup.visible, snow: this.snowPoints.visible, sand: this.sandGroup.visible };
  }
}
