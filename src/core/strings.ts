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

  // build UI
  'build.tab.all': 'All',
  'build.tab.nature': 'Nature',
  'build.tab.decor': 'Decor',
  'build.tab.home': 'Homes',
  'build.tab.income': 'Income',
  'build.tab.ground': 'Ground',
  'build.tool.move': 'Move',
  'build.tool.remove': 'Remove',
  'build.hint.place': 'Click to place · R rotates · Esc done',
  'build.hint.move': 'Click something to pick it up',
  'build.hint.carrying': 'Click to drop · R rotates · Esc puts it back',
  'build.hint.remove': 'Click something to remove it',
  'build.blocked.occupied': 'Something is already there',
  'build.blocked.island': 'That’s open sky!',

  // settings
  'settings.title': 'Settings',
  'settings.quality': 'Quality',
  'settings.quality.auto': 'Auto',
  'settings.quality.high': 'High',
  'settings.quality.medium': 'Medium',
  'settings.quality.low': 'Low',
  'settings.volume': 'Sound',
  'settings.reducedMotion': 'Reduce motion',
  'settings.export': 'Export save',
  'settings.import': 'Import save',
  'settings.exported': 'Save copied — keep it somewhere cozy.',
  'settings.imported': 'Island restored!',
  'settings.importFailed': 'That didn’t look like a Poplands save.',

  // item names (stable keys per catalog ids)
  'item.nature.tree': 'Little Tree',
  'item.nature.bush': 'Round Bush',
  'item.nature.flower.purple': 'Bellbloom',
  'item.nature.flower.red': 'Poppykiss',
  'item.nature.flower.yellow': 'Sunnybud',
  'item.nature.grass': 'Grass Tuft',
  'item.nature.mushroom': 'Toadstool',
  'item.nature.pebble': 'Pebble Patch',
  'item.nature.rock': 'Small Rock',
  'item.nature.clover': 'Leafy Clover',
  'item.nature.fern': 'Fern Fan',
  'item.nature.pine': 'Tall Pine',
  'item.decor.fence': 'Wooden Fence',
  'item.decor.fence.gate': 'Picket Gate',
  'item.decor.bench': 'Garden Bench',
  'item.decor.pot': 'Clay Pot',
  'item.decor.stump': 'Log Seat',
  'item.decor.sign': 'Signpost',
  'item.decor.lantern': 'Lantern',
  'item.decor.hedge': 'Hedge',
  'item.ground.path.dirt': 'Dirt Path',
  'item.ground.path.stone': 'Stepping Stones',
  'item.income.stall': 'Flower Stall',
  'item.home.hut': 'Cozy Hut',
  'item.home.house': 'Wildwood House',
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
