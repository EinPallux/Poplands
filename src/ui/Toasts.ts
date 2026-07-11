/**
 * Toast notifications (S21): small cream pills that slide in near the top,
 * auto-dismiss, and never stack more than three.
 */

let container: HTMLDivElement | null = null;

export function initToasts(parent: HTMLElement): void {
  container = document.createElement('div');
  container.className = 'toasts';
  parent.appendChild(container);
}

export function showToast(message: string, ms = 2600): void {
  if (!container) return;
  while (container.children.length >= 3) container.firstChild?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-in'));
  setTimeout(() => {
    toast.classList.remove('toast-in');
    setTimeout(() => toast.remove(), 350);
  }, ms);
}
