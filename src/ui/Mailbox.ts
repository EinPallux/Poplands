/**
 * Mailbox (S21): the active tutorial step + postcards, with progress bars and a
 * "Later" skip for postcards. Reads questState signals (fed by quest:* events);
 * emits cmd:skipPostcard. Auto-complete model — no claim button (rewards land on
 * completion). Cozy and dismissable; never modal.
 */
import { effect } from '@/core/signals';
import { bus, type QuestReward } from '@/core/events';
import { t } from '@/core/strings';
import { activeQuestsSignal, type QuestView } from './questState';

export class Mailbox {
  private root: HTMLDivElement;
  private list: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mailbox';
    this.root.innerHTML = `<h2 class="mailbox-title">${t('mailbox.title')}</h2><div class="mailbox-list"></div>`;
    this.list = this.root.querySelector('.mailbox-list') as HTMLDivElement;
    parent.appendChild(this.root);

    effect(() => this.render(activeQuestsSignal.get()));
  }

  private render(quests: readonly QuestView[]): void {
    this.list.replaceChildren();
    this.root.classList.toggle('empty', quests.length === 0);
    for (const q of quests) this.list.appendChild(this.card(q));
  }

  private card(q: QuestView): HTMLElement {
    const el = document.createElement('div');
    el.className = `mail-card mail-${q.kind}`;
    const pct = q.target > 0 ? Math.round((Math.min(q.current, q.target) / q.target) * 100) : 0;
    const badge = q.kind === 'tutorial' && q.step ? t('hud.tutorialStep').replace('{n}', String(q.step)) : '';
    el.innerHTML = `
      ${badge ? `<span class="mail-step">${badge}</span>` : ''}
      <div class="mail-head">${t(q.titleKey)}</div>
      <div class="mail-desc">${t(q.descKey)}</div>
      <div class="mail-progress"><div class="mail-bar" style="width:${pct}%"></div><span class="mail-count">${Math.min(q.current, q.target)}/${q.target}</span></div>
      <div class="mail-foot"><span class="mail-reward">${rewardText(q.rewards)}</span></div>`;
    if (q.kind === 'postcard') {
      const skip = document.createElement('button');
      skip.className = 'mail-skip';
      skip.textContent = t('mailbox.skip');
      skip.addEventListener('click', () => bus.emit('cmd:skipPostcard', { id: q.id }));
      (el.querySelector('.mail-foot') as HTMLElement).appendChild(skip);
    }
    return el;
  }
}

function rewardText(r: QuestReward): string {
  const parts: string[] = [];
  if (r.pops) parts.push(`● ${r.pops}`);
  if (r.stardust) parts.push(`✦ ${r.stardust}`);
  if (r.xp) parts.push(`✚ ${r.xp} XP`);
  return parts.join('  ');
}
