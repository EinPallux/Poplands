/**
 * Top HUD (S21): wallet counters (Pops ●, Stardust ✦) with a spring tick on
 * change, and a level ring showing progress into the current level. Pure DOM
 * bound to playerStore signals.
 */
import { effect } from '@/core/signals';
import { popsSignal, stardustSignal, levelSignal, levelProgressSignal } from '@/core/playerStore';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';

const RING_R = 20;
const RING_C = 2 * Math.PI * RING_R;

export class Hud {
  /** Screen position of the Pops counter — coin arcs fly here. */
  readonly popsAnchor: HTMLElement;

  constructor(parent: HTMLElement) {
    const wallet = document.createElement('div');
    wallet.className = 'hud-wallet';
    wallet.innerHTML = `
      <div class="hud-pill hud-pops"><span class="pill-icon">●</span><span class="pill-value">0</span></div>
      <div class="hud-pill hud-stardust"><span class="pill-icon">✦</span><span class="pill-value">0</span></div>`;
    parent.appendChild(wallet);

    const popsPill = wallet.querySelector('.hud-pops') as HTMLElement;
    const popsValue = popsPill.querySelector('.pill-value') as HTMLElement;
    const sdPill = wallet.querySelector('.hud-stardust') as HTMLElement;
    const sdValue = sdPill.querySelector('.pill-value') as HTMLElement;
    this.popsAnchor = popsPill;

    bindCounter(popsValue, popsPill, () => Math.floor(popsSignal.get()));
    bindCounter(sdValue, sdPill, () => stardustSignal.get());

    // — level ring
    const ring = document.createElement('div');
    ring.className = 'hud-level';
    ring.innerHTML = `
      <svg viewBox="0 0 48 48" width="48" height="48">
        <circle class="ring-bg" cx="24" cy="24" r="${RING_R}" />
        <circle class="ring-fg" cx="24" cy="24" r="${RING_R}"
          stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"
          transform="rotate(-90 24 24)" />
      </svg>
      <span class="level-num">1</span>`;
    parent.appendChild(ring);
    const fg = ring.querySelector('.ring-fg') as SVGCircleElement;
    const num = ring.querySelector('.level-num') as HTMLElement;
    effect(() => {
      fg.style.strokeDashoffset = String(RING_C * (1 - levelProgressSignal.get()));
    });
    effect(() => {
      num.textContent = String(levelSignal.get());
    });
  }
}

/** Update text on change and spring-scale the pill (ART §8 counter tick). */
function bindCounter(valueEl: HTMLElement, pillEl: HTMLElement, read: () => number): void {
  let first = true;
  effect(() => {
    valueEl.textContent = String(read());
    if (first) {
      first = false;
      return;
    }
    if (isReducedMotion()) return;
    tweens.start({
      duration: 0.32,
      ease: easings.popBounce,
      onUpdate: (t) => {
        pillEl.style.transform = `scale(${1 + 0.14 * (1 - Math.abs(2 * t - 1))})`;
      },
      onComplete: () => (pillEl.style.transform = ''),
    });
  });
}
