/**
 * Survey markers (S8/S21): world-anchored "call this chunk" chips floating over the
 * free-edge slots the ExpansionSystem offers. Pure DOM + events — clicking a chip
 * emits `cmd:buyChunk` (the purchase card is inline on the chip to stay cozy, not
 * modal). Fed by `chunk:offered`; projected from 3D each frame like WorldFx.
 */
import { bus } from '@/core/events';
import { popsSignal, stardustSignal } from '@/core/playerStore';
import { t } from '@/core/strings';
import { THEME_EMOJI } from '@/content/themes';
import type { ChunkTheme } from '@/core/grid';

type Project = (x: number, y: number, z: number) => { x: number; y: number; behind: boolean };

interface Slot {
  cx: number;
  cz: number;
  pops: number;
  stardust: number;
  theme: ChunkTheme;
}
interface Chip {
  el: HTMLButtonElement;
  wx: number;
  wz: number;
  slot: Slot;
}

const CHUNK = 8;
const MARKER_Y = 1.3; // float just above where the chunk will dock

export class SurveyLayer {
  private root: HTMLDivElement;
  private chips = new Map<string, Chip>();

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'survey-layer';
    parent.appendChild(this.root);
    bus.on('chunk:offered', (e) => this.rebuild(e.slots));
  }

  private rebuild(slots: readonly Slot[]): void {
    const wanted = new Set(slots.map((s) => `${s.cx},${s.cz}`));
    for (const [k, c] of this.chips) {
      if (!wanted.has(k)) {
        c.el.remove();
        this.chips.delete(k);
      }
    }
    for (const s of slots) {
      const k = `${s.cx},${s.cz}`;
      let c = this.chips.get(k);
      if (!c) {
        const el = document.createElement('button');
        el.className = 'survey-chip';
        el.addEventListener('click', () => bus.emit('cmd:buyChunk', { cx: s.cx, cz: s.cz }));
        this.root.appendChild(el);
        c = { el, wx: s.cx * CHUNK + CHUNK / 2, wz: s.cz * CHUNK + CHUNK / 2, slot: s };
        this.chips.set(k, c);
      }
      c.slot = s;
      c.el.innerHTML =
        `<span class="survey-balloon">${THEME_EMOJI[s.theme]}</span>` +
        `<span class="survey-label">${t('survey.call')}</span>` +
        `<span class="survey-price">● ${s.pops}<span class="afford-flag" aria-hidden="true"> ✕</span>${s.stardust ? ` <span class="sd">✦ ${s.stardust}</span>` : ''}</span>`;
    }
  }

  /** Project every marker to screen each frame (called by the App loop). */
  update(): void {
    if (this.chips.size === 0) return;
    const pops = popsSignal.get();
    const sd = stardustSignal.get();
    for (const c of this.chips.values()) {
      const proj = this.project(c.wx, MARKER_Y, c.wz);
      if (proj.behind) {
        c.el.style.display = 'none';
        continue;
      }
      c.el.style.display = '';
      c.el.style.transform = `translate(${proj.x}px, ${proj.y}px) translate(-50%, -50%)`;
      c.el.classList.toggle('unaffordable', pops < c.slot.pops || sd < c.slot.stardust);
    }
  }
}
