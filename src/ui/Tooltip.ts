/**
 * Custom tooltips (post-1.0, user 2026-07-12): a single delegated, cozy-styled
 * tooltip that replaces the browser's default `title=` bubbles across the HUD.
 *
 * Design: ONE floating element for the whole app, driven by event delegation on
 * `#ui` — any element carrying a `data-tip="…"` attribute gets a styled tooltip
 * on hover/focus, no per-widget listeners or state. It auto-flips above/below to
 * stay on-screen (top-bar chips point down, everything else points up) and clamps
 * horizontally to the viewport. Keyboard-accessible (focusin/focusout) and
 * reduced-motion aware (the preset skips the fade — never the caller's job).
 *
 * Anchored to `#ui` (never a transformed dock) with `position: fixed`, so its
 * viewport coordinates are honoured (the transformed-ancestor trap that bit the
 * stamp/gift popups). Set text with the `tip()` helper — it also strips any stale
 * browser `title` so the two never double up.
 */
import { isReducedMotion } from '@/core/settingsStore';

const SHOW_DELAY = 320; // ms hover before a tip appears — calm, not twitchy
const GAP = 10; // px between the element and the bubble

/** Tag an element with a custom tooltip (and remove any browser `title=`). */
export function tip(el: HTMLElement, text: string): void {
  el.dataset.tip = text;
  if (el.title) el.removeAttribute('title');
}

/** Clear a custom tooltip from an element. */
export function clearTip(el: HTMLElement): void {
  delete el.dataset.tip;
}

/** Escape a string for safe use inside a `data-tip="…"` attribute in innerHTML. */
export function attr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class Tooltip {
  private el: HTMLDivElement;
  private current: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'tooltip';
    this.el.setAttribute('role', 'tooltip');
    this.el.setAttribute('aria-hidden', 'true');
    root.appendChild(this.el);

    // delegate: hover/focus anything with [data-tip] inside the UI layer
    root.addEventListener('pointerover', this.onOver);
    root.addEventListener('pointerout', this.onOut);
    root.addEventListener('focusin', this.onFocus);
    root.addEventListener('focusout', this.onOut);
    // dismiss on any press or scroll so a tip never lingers over a fresh action
    root.addEventListener('pointerdown', this.hide, true);
    window.addEventListener('scroll', this.hide, true);
  }

  private tipTarget(node: EventTarget | null): HTMLElement | null {
    const start = node instanceof HTMLElement ? node : null;
    return start?.closest<HTMLElement>('[data-tip]') ?? null;
  }

  private onOver = (e: PointerEvent): void => {
    const target = this.tipTarget(e.target);
    if (!target || target === this.current) return;
    this.schedule(target);
  };

  private onFocus = (e: FocusEvent): void => {
    const target = this.tipTarget(e.target);
    if (target) this.schedule(target, true); // keyboard focus shows immediately
  };

  private onOut = (e: Event): void => {
    // only clear when actually leaving the tipped element (ignore inner bubbling)
    const related = (e as PointerEvent).relatedTarget;
    if (this.current && related instanceof Node && this.current.contains(related)) return;
    this.hide();
  };

  private schedule(target: HTMLElement, immediate = false): void {
    this.current = target;
    if (this.timer) clearTimeout(this.timer);
    const show = (): void => this.show(target);
    if (immediate || isReducedMotion()) show();
    else this.timer = setTimeout(show, SHOW_DELAY);
  }

  private show(target: HTMLElement): void {
    const text = target.dataset.tip;
    if (!text) return;
    this.el.textContent = text;
    this.el.classList.add('show');
    this.el.setAttribute('aria-hidden', 'false');
    // measure after content is set, then place around the target
    const r = target.getBoundingClientRect();
    const tb = this.el.getBoundingClientRect();
    const below = r.top < 130; // top-bar chips point down; the rest point up
    let top = below ? r.bottom + GAP : r.top - tb.height - GAP;
    let left = r.left + r.width / 2 - tb.width / 2;
    // clamp to the viewport with a small margin
    const m = 8;
    left = Math.max(m, Math.min(left, window.innerWidth - tb.width - m));
    top = Math.max(m, Math.min(top, window.innerHeight - tb.height - m));
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
    this.el.classList.toggle('below', below);
  }

  private hide = (): void => {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.current = null;
    this.el.classList.remove('show');
    this.el.setAttribute('aria-hidden', 'true');
  };
}
