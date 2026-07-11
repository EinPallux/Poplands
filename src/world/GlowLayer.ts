/**
 * Night glow (S7/S20): soft additive halos over lanterns, lampposts, campfires,
 * and the lighthouse that fade in as dusk falls — the "windows glow at dusk" beat.
 * One shared radial texture, additive sprites, opacity driven by the day-night
 * `nightFactor`. Tracks placements via the bus so newly-placed lamps light up too.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Sprite,
  SpriteMaterial,
  type Texture,
} from 'three';
import { bus } from '@/core/events';
import { footprintCenter } from '@/core/grid';
import { itemDef } from '@/content/catalog';
import type { IslandModel, Placement, PlacementId } from '@/world/IslandModel';

interface GlowSpec {
  color: string;
  y: number;
  scale: number;
  intensity: number;
}

const GLOW: Record<string, GlowSpec> = {
  'decor.lantern': { color: '#ffd98a', y: 0.95, scale: 1.7, intensity: 0.9 },
  'decor.lightpost': { color: '#ffe0a0', y: 1.7, scale: 2.1, intensity: 1.0 },
  'decor.campfire': { color: '#ff9a4a', y: 0.5, scale: 2.4, intensity: 1.1 },
  'income.lighthouse': { color: '#fff2c0', y: 3.6, scale: 3.2, intensity: 1.2 },
};

function makeGlowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

export class GlowLayer {
  readonly group = new Group();
  private sprites = new Map<PlacementId, { sprite: Sprite; base: number }>();
  private tex: Texture;
  private night = 0;

  constructor(private readonly island: IslandModel) {
    this.group.name = 'glow';
    this.tex = makeGlowTexture();
    for (const p of island.allPlacements()) this.add(p);
    bus.on('item:placed', (e) => this.add(e));
    bus.on('item:removed', (e) => this.remove(e.id));
    bus.on('item:moved', (e) => {
      this.remove(e.id);
      this.add(e);
    });
  }

  private add(p: Placement): void {
    const spec = GLOW[p.def];
    const def = itemDef(p.def);
    if (!spec || !def || this.sprites.has(p.id)) return;
    const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
    const sprite = new Sprite(
      new SpriteMaterial({
        map: this.tex,
        color: new Color(spec.color),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: this.night * spec.intensity,
        fog: false,
      }),
    );
    sprite.position.set(c.x, spec.y, c.z);
    sprite.scale.setScalar(spec.scale);
    this.group.add(sprite);
    this.sprites.set(p.id, { sprite, base: spec.intensity });
  }

  private remove(id: PlacementId): void {
    const g = this.sprites.get(id);
    if (!g) return;
    this.group.remove(g.sprite);
    g.sprite.material.dispose();
    this.sprites.delete(id);
  }

  /** Drive halo opacity from the day-night night factor (0 day … 1 night). */
  update(nightFactor: number): void {
    if (nightFactor === this.night) return;
    this.night = nightFactor;
    for (const { sprite, base } of this.sprites.values()) {
      sprite.material.opacity = nightFactor * base;
    }
  }

  get count(): number {
    return this.sprites.size;
  }
}
