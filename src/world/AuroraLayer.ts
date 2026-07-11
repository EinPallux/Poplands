/**
 * The Wonder's aurora (S20, v1.0 capstone): a soft, permanent ribbon of light that
 * hangs above The Wonder and lifts brighter at night. Lifecycle mirrors GlowLayer —
 * seed from `island.allPlacements()` (so it reappears on a returning save) + track
 * `item:placed`/`removed`/`moved`. Visual is two crossed additive gradient planes
 * (green→teal→violet) so it reads from every orbit angle; one shared CanvasTexture,
 * zero per-frame allocation. Reduced-motion freezes the shimmer but keeps it drawn.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Texture,
} from 'three';
import { bus } from '@/core/events';
import { footprintCenter } from '@/core/grid';
import { itemDef } from '@/content/catalog';
import { palette } from '@/render/palette';
import { isReducedMotion } from '@/core/settingsStore';
import type { IslandModel, Placement, PlacementId } from '@/world/IslandModel';

/** Which item raises an aurora, and how it sits above the footprint. */
const AURORA_DEF = 'decor.the-wonder';
const BASE_Y = 8; // centre height of the curtain above the building
const PLANE_W = 15;
const PLANE_H = 8;

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** A tall vertical gradient — transparent top & bottom, aurora bands in the middle. */
function makeAuroraTexture(): CanvasTexture {
  const w = 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, h, 0, 0); // bottom → top
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.3, `${hex(palette.auroraGreen)}99`);
    g.addColorStop(0.58, `${hex(palette.auroraTeal)}77`);
    g.addColorStop(0.82, `${hex(palette.auroraViolet)}44`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // faint tinted "curtain" streaks (soft, not bright white — keep it gentle)
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = hex(palette.auroraGreen);
    for (let i = 0; i < 5; i++) ctx.fillRect((i / 5) * w + 4, 0, 1, h);
  }
  const tex = new CanvasTexture(canvas);
  return tex;
}

interface AuroraHandle {
  group: Group;
  mats: MeshBasicMaterial[];
  phase: number;
}

export class AuroraLayer {
  readonly group = new Group();
  private auroras = new Map<PlacementId, AuroraHandle>();
  private tex: Texture;
  private geo: PlaneGeometry;
  private time = 0;
  private night = 0;

  constructor(private readonly island: IslandModel) {
    this.group.name = 'aurora';
    this.tex = makeAuroraTexture();
    this.geo = new PlaneGeometry(PLANE_W, PLANE_H);
    for (const p of island.allPlacements()) this.add(p);
    bus.on('item:placed', (e) => this.add(e));
    bus.on('item:removed', (e) => this.remove(e.id));
    bus.on('item:moved', (e) => {
      this.remove(e.id);
      this.add(e);
    });
  }

  private add(p: Placement): void {
    if (p.def !== AURORA_DEF) return;
    const def = itemDef(p.def);
    if (!def || this.auroras.has(p.id)) return;
    const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
    const g = new Group();
    g.position.set(c.x, BASE_Y, c.z);
    const mats: MeshBasicMaterial[] = [];
    for (let i = 0; i < 2; i++) {
      const mat = new MeshBasicMaterial({
        map: this.tex,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        fog: false,
      });
      const mesh = new Mesh(this.geo, mat);
      mesh.rotation.y = (i * Math.PI) / 2; // crossed planes → visible from all angles
      mesh.renderOrder = 3;
      g.add(mesh);
      mats.push(mat);
    }
    this.group.add(g);
    // deterministic per-placement phase (no Math.random in the render path)
    const phase = ((p.wx * 7 + p.wz * 13) % 10) / 10 * Math.PI * 2;
    this.auroras.set(p.id, { group: g, mats, phase });
  }

  private remove(id: PlacementId): void {
    const h = this.auroras.get(id);
    if (!h) return;
    this.group.remove(h.group);
    for (const m of h.mats) m.dispose();
    this.auroras.delete(id);
  }

  /** Shimmer + brighten at night. `nightFactor` 0 (day) … 1 (night). */
  update(dt: number, nightFactor: number): void {
    this.night = nightFactor;
    if (this.auroras.size === 0) return;
    const reduced = isReducedMotion();
    if (!reduced) this.time += dt;
    for (const h of this.auroras.values()) {
      // permanent but lifts at night (gentle): 0.14 by day → 0.36 at night
      const base = 0.14 + 0.22 * nightFactor;
      const shimmer = reduced ? 1 : 0.82 + 0.18 * Math.sin(this.time * 0.7 + h.phase);
      for (const m of h.mats) m.opacity = base * shimmer;
      if (!reduced) h.group.rotation.y += dt * 0.05; // slow curtain drift
    }
  }

  get count(): number {
    return this.auroras.size;
  }
}
