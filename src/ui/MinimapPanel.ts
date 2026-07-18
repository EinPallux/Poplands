/**
 * Minimap / island overview (post-1.0): a top-down canvas map of the whole island —
 * each chunk tinted by its biome, a dot per placed thing (coloured by category), and
 * a ring marking where the camera is looking. Tap anywhere to recenter the camera
 * there. Increasingly handy as an island sprawls toward the 36-chunk cap.
 */
import { t } from '@/core/strings';
import { tip } from '@/ui/Tooltip';
import { bus } from '@/core/events';
import { CHUNK_SIZE, type ChunkTheme } from '@/core/grid';
import { THEMES } from '@/content/themes';
import type { Category } from '@/content/catalog';

export interface MinimapData {
  chunks: Array<{ cx: number; cz: number; theme: ChunkTheme }>;
  dots: Array<{ wx: number; wz: number; category: Category }>;
  /** Where the camera is currently looking (world blocks). */
  cam: { x: number; z: number };
}

const SIZE = 232; // canvas CSS px (square)
const PAD = 10;

const CATEGORY_DOT: Record<Category, string> = {
  nature: '#57b368',
  home: '#b07a45',
  income: '#f0b429',
  decor: '#e57ba0',
  ground: '#9aa0a8',
};

const hex6 = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export class MinimapPanel {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  open = false;
  /** Cached map→world transform so a click can invert it. */
  private xf: { scale: number; ox: number; oy: number; minX: number; minZ: number } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly data: () => MinimapData,
    /** Recenter the camera on a world point the player tapped on the map. */
    private readonly onJumpTo: (wx: number, wz: number) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'minimap-root';
    parent.appendChild(this.root);

    const btn = document.createElement('button');
    btn.className = 'minimap-btn';
    btn.setAttribute('aria-label', t('minimap.title'));
    tip(btn, t('minimap.title'));
    btn.textContent = '🗺️';
    btn.addEventListener('click', () => this.toggle());
    this.root.appendChild(btn);

    this.panel = document.createElement('div');
    this.panel.className = 'minimap-panel';
    this.panel.style.display = 'none';
    this.panel.innerHTML = `<h2>${t('minimap.title')}</h2>`;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap-canvas';
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.style.width = `${SIZE}px`;
    this.canvas.style.height = `${SIZE}px`;
    this.panel.appendChild(this.canvas);
    const hint = document.createElement('div');
    hint.className = 'minimap-hint';
    hint.textContent = t('minimap.hint');
    this.panel.appendChild(hint);
    this.root.appendChild(this.panel);

    this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));

    // keep the map fresh while it's open as the island changes
    const refresh = (): void => {
      if (this.open) this.render();
    };
    bus.on('item:placed', refresh);
    bus.on('item:removed', refresh);
    bus.on('island:grew', refresh);
    bus.on('chunk:reThemed', refresh);
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? '' : 'none';
    if (this.open) this.render();
  }

  private onCanvasClick(e: MouseEvent): void {
    if (!this.xf) return;
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { scale, ox, oy, minX, minZ } = this.xf;
    const wx = (cx - ox) / scale + minX;
    const wz = (cy - oy) / scale + minZ;
    this.onJumpTo(wx, wz);
  }

  private render(): void {
    const d = this.data();
    const ctx = this.canvas.getContext('2d');
    if (!ctx || d.chunks.length === 0) return;

    let minCx = Infinity, maxCx = -Infinity, minCz = Infinity, maxCz = -Infinity;
    for (const c of d.chunks) {
      if (c.cx < minCx) minCx = c.cx;
      if (c.cx > maxCx) maxCx = c.cx;
      if (c.cz < minCz) minCz = c.cz;
      if (c.cz > maxCz) maxCz = c.cz;
    }
    const blocksW = (maxCx - minCx + 1) * CHUNK_SIZE;
    const blocksH = (maxCz - minCz + 1) * CHUNK_SIZE;
    const avail = SIZE - PAD * 2;
    const scale = avail / Math.max(blocksW, blocksH);
    const ox = PAD + (avail - blocksW * scale) / 2;
    const oy = PAD + (avail - blocksH * scale) / 2;
    const minX = minCx * CHUNK_SIZE;
    const minZ = minCz * CHUNK_SIZE;
    this.xf = { scale, ox, oy, minX, minZ };

    ctx.clearRect(0, 0, SIZE, SIZE);

    // chunks, tinted by biome
    const cs = CHUNK_SIZE * scale;
    for (const c of d.chunks) {
      const x = ox + (c.cx - minCx) * cs;
      const y = oy + (c.cz - minCz) * cs;
      ctx.fillStyle = hex6(THEMES[c.theme].grassTop);
      ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
    }

    // placement dots, coloured by category
    const r = Math.max(1.4, scale * 0.9);
    for (const p of d.dots) {
      const x = ox + (p.wx - minX + 0.5) * scale;
      const y = oy + (p.wz - minZ + 0.5) * scale;
      ctx.fillStyle = CATEGORY_DOT[p.category];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // camera-look indicator (a small hollow ring)
    const camX = ox + (d.cam.x - minX) * scale;
    const camY = oy + (d.cam.z - minZ) * scale;
    ctx.strokeStyle = '#4a3f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(camX, camY, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}
