/**
 * Top status bar (UI rework): the game-like header strip. Groups what used to float
 * in separate corners — an island crest + name, a player badge (level ring + XP bar),
 * the wallet pills (Pops ●, Stardust ✦), and a live world-status cluster (time of day,
 * season, weather). Pure DOM bound to playerStore signals; the status cluster is
 * refreshed each frame from an injected provider (diffed, so no per-frame churn).
 * Replaces the old minimal `Hud` — exposes `popsAnchor` for the coin-arc target.
 */
import { effect } from '@/core/signals';
import { popsSignal, stardustSignal, levelSignal, levelProgressSignal } from '@/core/playerStore';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';
import { t } from '@/core/strings';

export interface WorldStatus {
  dayPhase: 'dawn' | 'day' | 'dusk' | 'night';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  weather: 'clear' | 'rain' | 'rainbow';
}

const DAY_ICON: Record<WorldStatus['dayPhase'], string> = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' };
const SEASON_ICON: Record<WorldStatus['season'], string> = { spring: '🌷', summer: '🌻', autumn: '🍂', winter: '❄️' };
const WEATHER_ICON: Record<WorldStatus['weather'], string> = { clear: '⛅', rain: '🌧️', rainbow: '🌈' };

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

export class TopBar {
  readonly popsAnchor: HTMLElement;
  private timeEl: HTMLElement;
  private seasonEl: HTMLElement;
  private weatherEl: HTMLElement;
  private lastStatus = '';

  constructor(
    parent: HTMLElement,
    private readonly status: () => WorldStatus,
  ) {
    const bar = document.createElement('div');
    bar.className = 'topbar';
    bar.innerHTML = `
      <div class="tb-player">
        <div class="tb-ring">
          <svg viewBox="0 0 36 36" width="36" height="36">
            <circle class="tb-ring-bg" cx="18" cy="18" r="${RING_R}" />
            <circle class="tb-ring-fg" cx="18" cy="18" r="${RING_R}"
              stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}" transform="rotate(-90 18 18)" />
          </svg>
          <span class="tb-lv">1</span>
        </div>
        <div class="tb-pmeta">
          <div class="tb-name">${t('app.title')}</div>
          <div class="tb-xp"><div class="tb-xpfill"></div></div>
        </div>
      </div>
      <div class="tb-wallet">
        <div class="hud-pill hud-pops"><span class="pill-icon">●</span><span class="pill-value">0</span></div>
        <div class="hud-pill hud-stardust"><span class="pill-icon">✦</span><span class="pill-value">0</span></div>
      </div>
      <div class="tb-status">
        <div class="tb-stat tb-time"><span class="tb-stat-icon">☀️</span><span class="tb-stat-label">${t('status.day')}</span></div>
        <div class="tb-stat tb-season"><span class="tb-stat-icon">🌷</span></div>
        <div class="tb-stat tb-weather"><span class="tb-stat-icon">⛅</span></div>
      </div>`;
    parent.appendChild(bar);

    const popsPill = bar.querySelector('.hud-pops') as HTMLElement;
    const sdPill = bar.querySelector('.hud-stardust') as HTMLElement;
    this.popsAnchor = popsPill;
    bindCounter(popsPill, () => Math.floor(popsSignal.get()));
    bindCounter(sdPill, () => stardustSignal.get());

    const fg = bar.querySelector('.tb-ring-fg') as SVGCircleElement;
    const lv = bar.querySelector('.tb-lv') as HTMLElement;
    const xp = bar.querySelector('.tb-xpfill') as HTMLElement;
    effect(() => {
      const p = levelProgressSignal.get();
      fg.style.strokeDashoffset = String(RING_C * (1 - p));
      xp.style.width = `${Math.round(p * 100)}%`;
    });
    effect(() => (lv.textContent = String(levelSignal.get())));

    this.timeEl = bar.querySelector('.tb-time') as HTMLElement;
    this.seasonEl = bar.querySelector('.tb-season .tb-stat-icon') as HTMLElement;
    this.weatherEl = bar.querySelector('.tb-weather .tb-stat-icon') as HTMLElement;
  }

  /** Refresh the world-status cluster (called each frame; diffed so it's cheap). */
  update(): void {
    const s = this.status();
    const key = `${s.dayPhase}|${s.season}|${s.weather}`;
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    this.timeEl.innerHTML = `<span class="tb-stat-icon">${DAY_ICON[s.dayPhase]}</span><span class="tb-stat-label">${t(`status.${s.dayPhase}`)}</span>`;
    this.seasonEl.textContent = SEASON_ICON[s.season];
    this.seasonEl.parentElement!.title = t(`season.${s.season}`);
    this.weatherEl.textContent = WEATHER_ICON[s.weather];
    this.weatherEl.parentElement!.title = t(`weather.${s.weather}`);
  }
}

/** Update text on change and spring-scale the pill (ART §8 counter tick). */
function bindCounter(pillEl: HTMLElement, read: () => number): void {
  const valueEl = pillEl.querySelector('.pill-value') as HTMLElement;
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
      onUpdate: (tt) => {
        pillEl.style.transform = `scale(${1 + 0.14 * (1 - Math.abs(2 * tt - 1))})`;
      },
      onComplete: () => (pillEl.style.transform = ''),
    });
  });
}
