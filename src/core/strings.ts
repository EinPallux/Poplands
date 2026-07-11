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
  'build.blocked.afford': 'Not enough Pops yet',
  'build.locked': 'Unlocks at Level {level}',
  'toast.levelUp': 'Level {level}! ✨ New things to build',
  'toast.questDone': 'Postcard complete! 💌',
  'toast.secretFound': 'A discovery! ✨',

  // expansion (S8) — survey markers on the island's free edges
  'survey.call': 'Call this chunk',
  'chunk.popup.title': 'New chunk!',
  'chunk.popup.sub': 'Chunk {n} floated up to join your island 🌱',

  // mailbox
  'mailbox.title': 'Postcards',
  'mailbox.empty': 'No postcards right now — just enjoy your island.',
  'mailbox.skip': 'Later',
  'mailbox.reward': 'Reward:',
  'hud.tutorialStep': 'Step {n}',

  // — tutorial "Welcome to the Drift"
  'quest.tut.flowers.t': 'A splash of color',
  'quest.tut.flowers.d': 'Open the catalog and plant 3 wildflowers anywhere.',
  'quest.tut.path.t': 'Find your footing',
  'quest.tut.path.d': 'Lay 3 path tiles to start a little walkway.',
  'quest.tut.bench.t': 'A place to sit',
  'quest.tut.bench.d': 'Set down a Garden Bench.',
  'quest.tut.stall.t': 'Your first earnings',
  'quest.tut.stall.d': 'Build a Flower Stall — it makes Pops over time.',
  'quest.tut.collect.t': 'Ripe and ready',
  'quest.tut.collect.d': 'Wait for the stall to ripen, then click it to collect Pops.',
  'quest.tut.hut.t': 'Somewhere to call home',
  'quest.tut.hut.d': 'Build a Cozy Hut. (Islanders move in a little later!)',
  'quest.tut.cozycorner.t': 'Cozy corner',
  'quest.tut.cozycorner.d': 'Place a Lantern within 2 tiles of your Hut.',
  'quest.tut.lanterns.t': 'Light the way',
  'quest.tut.lanterns.d': 'Place 2 Lanterns around your island.',
  'quest.tut.level2.t': 'Rising star',
  'quest.tut.level2.d': 'Reach Level 2. You’ll earn Stardust ✦ — the rare currency.',
  'quest.tut.pops150.t': 'Tidy sum',
  'quest.tut.pops150.d': 'Collect 150 Pops in total.',
  'quest.tut.level3.t': 'Growing up',
  'quest.tut.level3.d': 'Reach Level 3. The Drift will grow once you’re ready — for now, keep leveling.',
  'quest.tut.capstone.t': 'A little world of your own',
  'quest.tut.capstone.d': 'Fill your island — have 30 things placed. The Drift is waking up!',

  // — postcards
  'quest.pc.grove.t': 'Little grove',
  'quest.pc.grove.d': 'Plant 5 trees.',
  'quest.pc.paved.t': 'Winding ways',
  'quest.pc.paved.d': 'Lay 8 path tiles.',
  'quest.pc.blooming.t': 'In full bloom',
  'quest.pc.blooming.d': 'Place 10 nature items.',
  'quest.pc.cozycorner.t': 'Reading nook',
  'quest.pc.cozycorner.d': 'Put a Lantern within 2 tiles of a Garden Bench.',
  'quest.pc.firstearnings.t': 'Pocket money',
  'quest.pc.firstearnings.d': 'Collect 200 Pops.',
  'quest.pc.homeward.t': 'Homeward',
  'quest.pc.homeward.d': 'Have 2 homes on your island.',
  'quest.pc.greenthumb.t': 'Green thumb',
  'quest.pc.greenthumb.d': 'Own 20 nature items.',
  'quest.pc.farmlife.t': 'Farm life',
  'quest.pc.farmlife.d': 'Build a Pumpkin Patch or a Wheat Field.',
  'quest.pc.tidysum.t': 'Nest egg',
  'quest.pc.tidysum.d': 'Collect 500 Pops.',
  'quest.pc.village.t': 'A proper village',
  'quest.pc.village.d': 'Have 3 homes and 3 income buildings.',
  'quest.pc.treasure.t': 'X marks the spot',
  'quest.pc.treasure.d': 'Uncover a secret hidden on one of your chunks.',

  // — milestones (Album labels, surfaced in v0.6)
  'quest.ms.placed': 'Things placed',
  'quest.ms.pops': 'Pops collected',
  'quest.ms.quests': 'Postcards completed',

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
  // Tier 3-6
  'item.income.pumpkin-patch': 'Pumpkin Patch',
  'item.income.wheat-field': 'Wheat Field',
  'item.nature.apple-tree': 'Apple Tree',
  'item.nature.berry-bush': 'Berry Bush',
  'item.nature.corn': 'Corn Stalk',
  'item.decor.hay-bale': 'Hay Bale',
  'item.decor.campfire': 'Campfire',
  'item.home.farmhouse': 'Farmhouse',
  'item.decor.cart': 'Wooden Cart',
  'item.decor.log-pile': 'Log Pile',
  'item.nature.carrot': 'Carrot Row',
  'item.income.market-stall': 'Market Stall',
  'item.income.bakery': 'Bakery',
  'item.home.village-house': 'Village House',
  'item.decor.fountain': 'Fountain',
  'item.decor.lightpost': 'Street Lamp',
  'item.decor.banner': 'Town Banner',
  'item.income.watermill': 'Watermill',
  'item.decor.statue': 'Stone Statue',
  'item.decor.stone-bridge': 'Stone Bridge',
  // Tier 7–8 "Riverside"
  'item.income.fish-market': 'Fish Market',
  'item.ground.river': 'River Tile',
  'item.decor.wooden-bridge': 'Wooden Bridge',
  'item.nature.lily-pad': 'Lily Pads',
  'item.nature.reeds': 'Reed Cluster',
  'item.income.cider-mill': 'Cider Mill',
  'item.home.fishing-hut': 'Fishing Hut',
  'item.decor.canoe': 'Canoe',
  // Tier 9–10 "Harbor"
  'item.income.harbor-market': 'Harbor Market',
  'item.decor.dock': 'Dock',
  'item.nature.palm': 'Palm Tree',
  'item.nature.beach-rock': 'Beach Rocks',
  'item.decor.crate': 'Crate Stack',
  'item.decor.barrel': 'Barrel',
  'item.income.lighthouse': 'Lighthouse',
  'item.decor.moored-sloop': 'Moored Sloop',
  'item.decor.pennant': 'Pennant Flag',
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
