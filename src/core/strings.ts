/**
 * String table — every user-facing string flows through here (TECH §10, user decision
 * 2026-07-11: English-first, i18n-ready). Never hardcode UI text in components.
 * Adding a language later = adding a table, not a refactor.
 */

const en = {
  'app.title': 'Poplands',
  'app.tagline': 'Grow a cozy island in the sky, one pop at a time.',
  'loading.label': 'Un-fogging the sky…',
  'loading.hint': 'Drag to orbit · Scroll to zoom · WASD to pan',
  'error.webgl': 'Poplands needs WebGL2 — this browser or device doesn’t seem to support it.',
  'error.boot': 'Something went wrong while waking the island. Please refresh to try again.',
  'debug.title': 'Debug',
} as const;

export type StringKey = keyof typeof en;

const tables: Record<string, Partial<Record<StringKey, string>>> = { en };
let locale = 'en';

export function setLocale(next: string): void {
  if (tables[next]) locale = next;
}

export function t(key: StringKey): string {
  const table = tables[locale];
  const value = table?.[key] ?? en[key];
  if (value === undefined) {
    console.warn(`[strings] missing key: ${key}`);
    return key;
  }
  return value;
}

/** Exposed for tests (completeness checks) and future locale tables. */
export const stringTable = en;
