/**
 * Camera bookmarks (post-1.0): save & jump to favourite viewpoints. A dock flyout
 * lists the saved views — each with a 📍 jump button, an editable name, and a 🗑 to
 * forget it — plus a "Save current view" button that captures where the camera is
 * now. Persisted per island (Save v12). Text via the string table.
 */
import { t } from '@/core/strings';
import { tip, attr } from '@/ui/Tooltip';
import type { SaveBookmark } from '@/core/save';

export class CameraBookmarks {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  open = false;

  constructor(
    parent: HTMLElement,
    private readonly data: () => readonly SaveBookmark[],
    /** Capture the current camera view and save it. */
    private readonly onSaveView: () => void,
    /** Ease the camera to the saved view at `index`. */
    private readonly onJump: (index: number) => void,
    private readonly onRename: (index: number, name: string) => void,
    private readonly onDelete: (index: number) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'bookmarks-root';
    parent.appendChild(this.root);

    const btn = document.createElement('button');
    btn.className = 'bookmarks-btn';
    btn.setAttribute('aria-label', t('bookmarks.title'));
    tip(btn, t('bookmarks.title'));
    btn.textContent = '🔖';
    btn.addEventListener('click', () => this.toggle());
    this.root.appendChild(btn);

    this.panel = document.createElement('div');
    this.panel.className = 'bookmarks-panel';
    this.panel.style.display = 'none';
    this.root.appendChild(this.panel);

    // delegate: jump / delete / rename-commit on the rendered rows
    this.panel.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const jump = el.closest('.bm-jump') as HTMLElement | null;
      if (jump) {
        this.onJump(Number(jump.dataset['i']));
        return;
      }
      const del = el.closest('.bm-del') as HTMLElement | null;
      if (del) {
        this.onDelete(Number(del.dataset['i']));
        this.render();
        return;
      }
      if (el.closest('.bm-save')) {
        this.onSaveView();
        this.render();
      }
    });
    this.panel.addEventListener('change', (e) => {
      const input = e.target as HTMLElement;
      if (input.classList.contains('bm-name')) {
        this.onRename(Number(input.dataset['i']), (input as HTMLInputElement).value);
      }
    });
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? '' : 'none';
    if (this.open) this.render();
  }

  private render(): void {
    const views = this.data();
    const rows = views
      .map((bm, i) => {
        const name = attr(bm.name);
        return (
          `<li class="bm-row">` +
          `<button class="bm-jump" data-i="${i}" data-tip="${attr(t('bookmarks.jump'))}" aria-label="${attr(t('bookmarks.jump'))}">📍</button>` +
          `<input class="bm-name" data-i="${i}" maxlength="20" value="${name}" aria-label="${attr(t('bookmarks.name'))}">` +
          `<button class="bm-del" data-i="${i}" data-tip="${attr(t('bookmarks.delete'))}" aria-label="${attr(t('bookmarks.delete'))}">🗑</button>` +
          `</li>`
        );
      })
      .join('');

    this.panel.innerHTML = `
      <h2>${t('bookmarks.title')}</h2>
      <button class="bm-save">＋ ${t('bookmarks.save')}</button>
      ${views.length ? `<ul class="bm-list">${rows}</ul>` : `<div class="bm-empty">${t('bookmarks.empty')}</div>`}`;
  }
}
