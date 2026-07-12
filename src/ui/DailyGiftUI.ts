/**
 * Daily gift UI (post-1.0): a glowing present that pops in when a gift is ready
 * (DailyGiftSystem emits `gift:available` on start), invites a click, and plays a
 * cheerful open-the-present celebration on `gift:claimed`. Purely presentational —
 * it emits `cmd:claimGift` and reads domain events; the sim owns the state, the
 * economy credits the reward. Reduced-motion collapses the animations.
 */
import { bus, type QuestReward } from '@/core/events';
import { t } from '@/core/strings';
import { tip } from '@/ui/Tooltip';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';

export class DailyGiftUI {
  private root: HTMLDivElement;
  private btn: HTMLButtonElement;

  constructor(private readonly parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'gift-root';

    this.btn = document.createElement('button');
    this.btn.className = 'gift-btn';
    this.btn.textContent = '🎁';
    tip(this.btn, t('gift.ready'));
    this.btn.setAttribute('aria-label', t('gift.ready'));
    this.btn.style.display = 'none';
    this.btn.addEventListener('click', () => bus.emit('cmd:claimGift', undefined));
    this.root.appendChild(this.btn);
    parent.appendChild(this.root);

    bus.on('gift:available', () => this.showReady());
    bus.on('gift:claimed', (e) => this.celebrate(e.day, e.rewards));
  }

  private showReady(): void {
    this.btn.style.display = '';
    this.btn.classList.add('ready');
  }

  private celebrate(day: number, rewards: QuestReward): void {
    this.btn.classList.remove('ready');
    this.btn.style.display = 'none'; // claimed — tuck the present away until tomorrow

    const card = document.createElement('div');
    card.className = 'gift-popup';
    card.innerHTML =
      `<span class="gp-icon">🎉</span>` +
      `<span class="gp-day">${t('gift.day').replace('{n}', String(day))}</span>` +
      `<span class="gp-reward">${rewardText(rewards)}</span>` +
      `<span class="gp-note">${t('gift.claimed')}</span>`;
    // append to #ui (not the transformed .gift-root) so position:fixed centres on the viewport
    this.parent.appendChild(card);

    const remove = (): void => card.remove();
    if (isReducedMotion()) {
      window.setTimeout(remove, 2600);
      return;
    }
    tweens.start({
      duration: 2.8,
      ease: easings.cubicOut,
      onUpdate: (tt) => {
        // a springy pop-in, hold, then float up + fade
        const pop = tt < 0.14 ? easings.backOut(tt / 0.14) : 1;
        const rise = tt > 0.72 ? (tt - 0.72) / 0.28 : 0;
        card.style.transform = `translate(-50%, ${-rise * 40}px) scale(${pop})`;
        card.style.opacity = tt > 0.72 ? String(1 - rise) : '1';
      },
      onComplete: remove,
    });
  }
}

function rewardText(r: QuestReward): string {
  const parts: string[] = [];
  if (r.pops) parts.push(`+${r.pops} ●`);
  if (r.stardust) parts.push(`+${r.stardust} ✦`);
  return parts.join('   ');
}
