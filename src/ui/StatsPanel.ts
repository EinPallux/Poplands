/**
 * Statistics page (post-1.0): a cozy at-a-glance summary of this island — active
 * playtime, things placed, Pops collected, fish caught, biggest island, and more.
 * Read-only; pulls a fresh snapshot each open. A dock flyout. Text via the strings.
 */
import { t, type StringKey } from '@/core/strings';
import { tip } from '@/ui/Tooltip';

export interface StatsData {
  playMs: number;
  createdAt: number;
  level: number;
  itemsPlaced: number;
  popsCollected: number;
  questsDone: number;
  secretsFound: number;
  fishTotal: number;
  cropsHarvested: number;
  neighbours: number;
  pals: number;
  chunks: number;
  stamps: number;
  giftClaims: number;
  museumDonated: number;
}

/** Human-friendly duration: "2h 34m", "12m", or "45s" for a brand-new island. */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.max(0, Math.floor(ms / 1000))}s`;
}

interface Stat {
  icon: string;
  labelKey: StringKey;
  value: string;
}

export class StatsPanel {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  open = false;

  constructor(
    parent: HTMLElement,
    private readonly data: () => StatsData,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'stats-root';
    parent.appendChild(this.root);

    const btn = document.createElement('button');
    btn.className = 'stats-btn';
    btn.setAttribute('aria-label', t('statspage.title'));
    tip(btn, t('statspage.title'));
    btn.textContent = '📊';
    btn.addEventListener('click', () => this.toggle());
    this.root.appendChild(btn);

    this.panel = document.createElement('div');
    this.panel.className = 'stats-panel';
    this.panel.style.display = 'none';
    this.root.appendChild(this.panel);
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? '' : 'none';
    if (this.open) this.render();
  }

  private render(): void {
    const d = this.data();
    const since = new Date(d.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const stats: Stat[] = [
      { icon: '⭐', labelKey: 'statspage.level', value: String(d.level) },
      { icon: '🧩', labelKey: 'statspage.placed', value: String(d.itemsPlaced) },
      { icon: '●', labelKey: 'statspage.pops', value: String(d.popsCollected) },
      { icon: '🧭', labelKey: 'statspage.chunks', value: String(d.chunks) },
      { icon: '🧑', labelKey: 'statspage.neighbours', value: String(d.neighbours) },
      { icon: '🐾', labelKey: 'statspage.pals', value: String(d.pals) },
      { icon: '🐟', labelKey: 'statspage.fish', value: String(d.fishTotal) },
      { icon: '🌾', labelKey: 'statspage.crops', value: String(d.cropsHarvested) },
      { icon: '✨', labelKey: 'statspage.secrets', value: String(d.secretsFound) },
      { icon: '💌', labelKey: 'statspage.quests', value: String(d.questsDone) },
      { icon: '🎖️', labelKey: 'statspage.stamps', value: String(d.stamps) },
      { icon: '🎁', labelKey: 'statspage.gifts', value: String(d.giftClaims) },
    ];
    const cards = stats
      .map(
        (s) =>
          `<div class="stat-card"><span class="stat-icon">${s.icon}</span>` +
          `<span class="stat-value">${s.value}</span>` +
          `<span class="stat-label">${t(s.labelKey)}</span></div>`,
      )
      .join('');

    this.panel.innerHTML = `
      <h2>${t('statspage.title')}</h2>
      <div class="stats-head">
        <div class="stats-playtime"><span class="stat-icon">🕒</span> <b>${formatDuration(d.playMs)}</b> ${t('statspage.playtime')}</div>
        <div class="stats-since">${t('statspage.since').replace('{date}', since)}</div>
      </div>
      <div class="stats-grid">${cards}</div>`;
  }
}
