/**
 * Fishing world-FX (post-1.0): a world-anchored bobber over the active pond that
 * bobs while the line's out and jiggles with a "!" when a fish nibbles, plus the
 * catch popup (icon + name + reward, rarity-tinted, "New!" on a first catch) and a
 * gentle "it got away" wisp on a miss. Projected from 3D each frame like WorldFx;
 * reduced-motion drops the bob/rise to a still readout. Purely presentational —
 * it reads FishingSystem's domain events, never touches sim state.
 */
import { bus, type AppEvents } from '@/core/events';
import { t } from '@/core/strings';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';

type Project = (x: number, y: number, z: number) => { x: number; y: number; behind: boolean };
type Caught = AppEvents['fishing:caught'];
type Reward = Caught['rewards'];

export class FishingLayer {
  private root: HTMLDivElement;
  private bobber: HTMLDivElement;
  private prompt: HTMLDivElement;
  private active: { wx: number; wz: number; nibbling: boolean } | null = null;
  private time = 0;

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'fishing-fx';
    parent.appendChild(this.root);

    this.bobber = document.createElement('div');
    this.bobber.className = 'fishing-bobber';
    this.bobber.innerHTML = '<span class="fishing-mark">!</span>';
    this.bobber.style.display = 'none';
    this.root.appendChild(this.bobber);

    this.prompt = document.createElement('div');
    this.prompt.className = 'fishing-prompt';
    this.prompt.textContent = t('fishing.nibble');
    this.prompt.style.display = 'none';
    this.root.appendChild(this.prompt);

    bus.on('fishing:cast', (e) => this.onCast(e.wx, e.wz));
    bus.on('fishing:nibble', () => this.onNibble());
    bus.on('fishing:caught', (e) => this.onCaught(e));
    bus.on('fishing:missed', (e) => this.onMissed(e.wx, e.wz));
  }

  private onCast(wx: number, wz: number): void {
    this.active = { wx, wz, nibbling: false };
    this.bobber.classList.remove('nibbling');
    this.prompt.style.display = 'none';
    this.bobber.style.display = '';
  }

  private onNibble(): void {
    if (!this.active) return;
    this.active.nibbling = true;
    this.bobber.classList.add('nibbling');
    this.prompt.style.display = '';
  }

  private onMissed(wx: number, wz: number): void {
    this.clearBobber();
    this.floatText(wx, wz, t('fishing.missed'), 'miss');
  }

  private onCaught(e: Caught): void {
    this.clearBobber();
    this.spawnCatch(e);
  }

  private clearBobber(): void {
    this.active = null;
    this.bobber.style.display = 'none';
    this.bobber.classList.remove('nibbling');
    this.prompt.style.display = 'none';
  }

  /** Project + animate the bobber each frame (called by App's loop). */
  update(dt: number): void {
    this.time += dt;
    if (!this.active) return;
    const reduced = isReducedMotion();
    const wobble = this.active.nibbling ? 0.13 : 0.05;
    const rate = this.active.nibbling ? 9 : 2.2;
    const y = reduced ? 0.4 : 0.4 + Math.sin(this.time * rate) * wobble;
    const proj = this.project(this.active.wx, y, this.active.wz);
    if (proj.behind) {
      this.bobber.style.display = 'none';
      this.prompt.style.display = 'none';
      return;
    }
    this.bobber.style.display = '';
    this.bobber.style.transform = `translate(${proj.x}px, ${proj.y}px) translate(-50%, -50%)`;
    if (this.active.nibbling) {
      this.prompt.style.display = '';
      this.prompt.style.transform = `translate(${proj.x}px, ${proj.y - 46}px) translate(-50%, -50%)`;
    }
  }

  private rewardText(r: Reward): string {
    const parts: string[] = [];
    if (r.pops) parts.push(`+${r.pops} ●`);
    if (r.stardust) parts.push(`+${r.stardust} ✦`);
    return parts.join('   ');
  }

  private spawnCatch(e: Caught): void {
    const proj = this.project(e.wx, 1.3, e.wz);
    const sx = proj.behind ? window.innerWidth / 2 : proj.x;
    const sy = proj.behind ? window.innerHeight * 0.4 : proj.y;
    const card = document.createElement('div');
    card.className = `fishing-catch rarity-${e.rarity}`;
    card.innerHTML =
      `${e.isNew ? `<span class="fc-new">${t('fishing.new')}</span>` : ''}` +
      `<span class="fc-icon">${e.icon}</span>` +
      `<span class="fc-name">${t(e.nameKey)}</span>` +
      `<span class="fc-reward">${this.rewardText(e.rewards)}</span>`;
    this.root.appendChild(card);

    if (isReducedMotion()) {
      card.style.transform = `translate(${sx}px, ${sy - 60}px) translate(-50%, -50%)`;
      // no tween loop under reduced-motion — hold briefly, then remove
      window.setTimeout(() => card.remove(), 2000);
      return;
    }
    tweens.start({
      duration: 2.0,
      ease: easings.cubicOut,
      onUpdate: (tt) => {
        const rise = 30 + tt * 66;
        const pop = tt < 0.16 ? 0.6 + (tt / 0.16) * 0.4 : 1; // gentle pop-in
        card.style.transform = `translate(${sx}px, ${sy - rise}px) translate(-50%, -50%) scale(${pop})`;
        card.style.opacity = tt > 0.78 ? String((1 - tt) / 0.22) : '1';
      },
      onComplete: () => card.remove(),
    });
  }

  private floatText(wx: number, wz: number, text: string, cls: string): void {
    const proj = this.project(wx, 1.1, wz);
    if (proj.behind) return;
    const el = document.createElement('div');
    el.className = `fishing-float ${cls}`;
    el.textContent = text;
    this.root.appendChild(el);
    if (isReducedMotion()) {
      el.style.transform = `translate(${proj.x}px, ${proj.y}px) translate(-50%, -50%)`;
      window.setTimeout(() => el.remove(), 1500);
      return;
    }
    tweens.start({
      duration: 1.3,
      ease: easings.cubicOut,
      onUpdate: (tt) => {
        el.style.transform = `translate(${proj.x}px, ${proj.y - tt * 50}px) translate(-50%, -50%)`;
        el.style.opacity = tt > 0.6 ? String((1 - tt) / 0.4) : '1';
      },
      onComplete: () => el.remove(),
    });
  }
}
