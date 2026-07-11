/**
 * Season ambience (post-1.0): the falling touch that sells the season — spring
 * petals, autumn leaves, winter snow, summer's lazy gold motes. One fixed Points
 * pool over the island bounds (cost independent of island size, mirrors
 * WeatherSystem's curtain), re-coloured/re-tuned when the season changes. Reads
 * `seasonSignal` itself ('auto' → real month) so it needs no render-layer coupling.
 * Reduced-motion holds the sky calm (hidden). Self-wires to island growth.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
  type Texture,
} from 'three';
import { bus } from '@/core/events';
import { effect } from '@/core/signals';
import { seasonSignal, isReducedMotion } from '@/core/settingsStore';
import { resolveSeason, seasonDef, type SeasonAmbientKind } from '@/content/seasons';
import type { IslandModel } from './IslandModel';

const POOL = 140;
const TOP = 10; // fall height above the island
const PAD = 3; // overhang past the edge

interface KindParams {
  size: number;
  fall: [number, number];
  sway: number;
  opacity: number;
  colors: number[];
}

const KINDS: Record<SeasonAmbientKind, KindParams> = {
  petals: { size: 0.3, fall: [0.8, 1.4], sway: 0.9, opacity: 0.9, colors: [0xffd4e4, 0xffe0ec, 0xffc0d8, 0xffffff] },
  leaves: { size: 0.34, fall: [1.2, 2.0], sway: 0.6, opacity: 0.95, colors: [0xe8913a, 0xd2622a, 0xc9962f, 0xa8471f] },
  snow: { size: 0.24, fall: [0.7, 1.2], sway: 0.2, opacity: 0.9, colors: [0xffffff, 0xf2f8ff] },
  motes: { size: 0.16, fall: [0.15, 0.4], sway: 0.5, opacity: 0.55, colors: [0xffe8a0, 0xfff0c0, 0xffdd88] },
};

function makeSoftDot(): CanvasTexture {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

export class SeasonAmbience {
  readonly group = new Points();
  private tex: Texture;
  private mat: PointsMaterial;
  private baseX = new Float32Array(POOL);
  private baseZ = new Float32Array(POOL);
  private y = new Float32Array(POOL);
  private vFall = new Float32Array(POOL);
  private phase = new Float32Array(POOL);
  private swaySpeed = new Float32Array(POOL);
  private params: KindParams = KINDS.petals;
  private time = 0;
  private minX = 0;
  private minZ = 0;
  private maxX = 16;
  private maxZ = 16;
  private readonly unsubs: Array<() => void> = [];

  constructor(private readonly island: IslandModel) {
    this.tex = makeSoftDot();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(POOL * 3), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(POOL * 3), 3));
    this.mat = new PointsMaterial({
      map: this.tex,
      vertexColors: true,
      transparent: true,
      size: 0.3,
      sizeAttenuation: true,
      depthWrite: false,
      opacity: 0.9,
      fog: false,
    });
    this.group.geometry = geo;
    this.group.material = this.mat;
    this.group.frustumCulled = false;
    this.group.name = 'season-ambience';

    this.rescan();
    // effect runs immediately (sets params + colours) and re-runs on season change
    this.unsubs.push(
      effect(() => {
        this.applyKind();
        this.writeColors();
      }),
      bus.on('chunk:unlocked', () => this.rescan()),
    );
    for (let i = 0; i < POOL; i++) this.seed(i, true); // uses the resolved kind's fall range
    this.writePositions();
  }

  dispose(): void {
    for (const off of this.unsubs) off();
  }

  private currentKind(): SeasonAmbientKind {
    const month = typeof Date === 'undefined' ? 0 : new Date().getMonth();
    return seasonDef(resolveSeason(seasonSignal.get(), month)).ambient;
  }

  private applyKind(): void {
    this.params = KINDS[this.currentKind()];
    this.mat.size = this.params.size;
    this.mat.opacity = this.params.opacity;
  }

  private rescan(): void {
    const b = this.island.bounds();
    this.minX = b.minX - PAD;
    this.minZ = b.minZ - PAD;
    this.maxX = b.maxX + PAD;
    this.maxZ = b.maxZ + PAD;
  }

  private seed(i: number, spread: boolean): void {
    this.baseX[i] = this.minX + Math.random() * (this.maxX - this.minX);
    this.baseZ[i] = this.minZ + Math.random() * (this.maxZ - this.minZ);
    this.y[i] = spread ? Math.random() * TOP : TOP + Math.random() * 2;
    const [lo, hi] = this.params.fall;
    this.vFall[i] = lo + Math.random() * (hi - lo);
    this.phase[i] = Math.random() * Math.PI * 2;
    this.swaySpeed[i] = 0.5 + Math.random() * 1.1;
  }

  private writeColors(): void {
    const attr = this.group.geometry.getAttribute('color') as BufferAttribute;
    const c = new Color();
    const palette = this.params.colors;
    for (let i = 0; i < POOL; i++) {
      c.setHex(palette[i % palette.length]!);
      attr.setXYZ(i, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  }

  private writePositions(): void {
    const attr = this.group.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < POOL; i++) {
      const sway = this.params.sway;
      const sx = Math.sin(this.time * this.swaySpeed[i]! + this.phase[i]!) * sway;
      const sz = Math.cos(this.time * this.swaySpeed[i]! * 0.7 + this.phase[i]!) * sway * 0.5;
      attr.setXYZ(i, this.baseX[i]! + sx, this.y[i]!, this.baseZ[i]! + sz);
    }
    attr.needsUpdate = true;
  }

  update(dt: number): void {
    if (isReducedMotion()) {
      this.group.visible = false; // hold the sky calm
      return;
    }
    this.group.visible = true;
    this.time += dt;
    for (let i = 0; i < POOL; i++) {
      this.y[i]! -= this.vFall[i]! * dt;
      if (this.y[i]! < 0) this.seed(i, false);
    }
    this.writePositions();
  }
}
