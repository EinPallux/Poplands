/**
 * Achievements — the "Stamp Book" (post-1.0), as data. Each stamp is earned by
 * crossing a lifetime milestone across the game's systems (building, community,
 * economy, exploration, fishing, mastery). Earning is one-way and never expires —
 * the no-grind / no-FOMO covenant (GDD §7.5): stamps only ever accumulate.
 *
 * Each def carries a pure `check(stats)` predicate over a plain snapshot the sim
 * assembles from the live systems — so this stays content-as-data (no new code
 * paths per stamp) and three.js-free. Ids are STABLE save contracts: never rename.
 */
import type { StringKey } from '@/core/strings';
import { MAX_ISLANDERS } from '@/content/roster';
import { MAX_PALS } from '@/content/pals';
import { FISH } from '@/content/fish';

/** The lifetime snapshot every stamp predicate reads (plain numbers — no three.js). */
export interface AchievementStats {
  level: number;
  chunks: number;
  itemsPlaced: number; // lifetime placements (milestone counter)
  popsCollected: number; // lifetime Pops collected (milestone counter)
  questsDone: number; // lifetime quests completed
  secretsFound: number; // lifetime secrets dug up
  ownedItems: number; // live placements on the island now
  homes: number; // live homes placed
  incomes: number; // live income buildings placed
  fishSpecies: number; // distinct species caught
  fishTotal: number; // lifetime catches
  museumDonated: number; // fish on display in the Collections Hall
  islanders: number; // neighbours moved in
  pals: number; // Pals adopted
  giftClaims: number; // daily gifts claimed
  cropsHarvested: number; // crops harvested from Garden Patches
  hasWonder: boolean; // The Wonder is built
}

export type AchievementCategory = 'building' | 'social' | 'economy' | 'explore' | 'fishing' | 'mastery';

export interface AchievementDef {
  id: string; // stable save contract
  nameKey: StringKey;
  descKey: StringKey;
  icon: string; // emoji stamp
  category: AchievementCategory;
  check: (s: AchievementStats) => boolean;
}

const a = (
  id: string,
  icon: string,
  category: AchievementCategory,
  check: (s: AchievementStats) => boolean,
): AchievementDef => ({
  id,
  icon,
  category,
  check,
  nameKey: `ach.${id}.name` as StringKey,
  descKey: `ach.${id}.desc` as StringKey,
});

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // — building —
  a('first-build', '🌱', 'building', (s) => s.itemsPlaced >= 1),
  a('builder', '🔨', 'building', (s) => s.itemsPlaced >= 25),
  a('architect', '🏛️', 'building', (s) => s.itemsPlaced >= 100),
  a('master-builder', '🏙️', 'building', (s) => s.itemsPlaced >= 300),
  a('decorated', '🪑', 'building', (s) => s.ownedItems >= 50),
  // — social —
  a('first-home', '🏠', 'social', (s) => s.homes >= 1),
  a('welcoming', '👋', 'social', (s) => s.islanders >= 3),
  a('bustling', '🎉', 'social', (s) => s.islanders >= 8),
  a('full-house', '🏘️', 'social', (s) => s.islanders >= MAX_ISLANDERS),
  a('first-pal', '🐾', 'social', (s) => s.pals >= 1),
  a('menagerie', '🐈', 'social', (s) => s.pals >= MAX_PALS),
  // — economy —
  a('first-coins', '🪙', 'economy', (s) => s.popsCollected >= 1000),
  a('tycoon', '💰', 'economy', (s) => s.popsCollected >= 10000),
  a('entrepreneur', '🏪', 'economy', (s) => s.incomes >= 5),
  a('helper', '📮', 'economy', (s) => s.questsDone >= 10),
  a('devoted', '🎁', 'economy', (s) => s.giftClaims >= 7),
  // — explore —
  a('first-chunk', '🧭', 'explore', (s) => s.chunks >= 5),
  a('sprawling', '🗺️', 'explore', (s) => s.chunks >= 12),
  a('continent', '🌍', 'explore', (s) => s.chunks >= 24),
  a('treasure-hunter', '💎', 'explore', (s) => s.secretsFound >= 1),
  a('secret-seeker', '🔍', 'explore', (s) => s.secretsFound >= 10),
  a('first-harvest', '🌾', 'explore', (s) => s.cropsHarvested >= 1),
  a('green-thumb', '🧑‍🌾', 'explore', (s) => s.cropsHarvested >= 25),
  // — fishing —
  a('first-fish', '🎣', 'fishing', (s) => s.fishTotal >= 1),
  a('angler', '🐟', 'fishing', (s) => s.fishSpecies >= 5),
  a('master-angler', '🐠', 'fishing', (s) => s.fishSpecies >= FISH.length),
  a('curator', '🖼️', 'fishing', (s) => s.museumDonated >= 1),
  a('full-collection', '🏆', 'fishing', (s) => s.museumDonated >= FISH.length),
  // — mastery —
  a('level-5', '⭐', 'mastery', (s) => s.level >= 5),
  a('level-10', '🌟', 'mastery', (s) => s.level >= 10),
  a('level-20', '👑', 'mastery', (s) => s.level >= 20),
  a('the-wonder', '🌈', 'mastery', (s) => s.hasWonder),
];

const byId = new Map(ACHIEVEMENTS.map((d) => [d.id, d]));
export function achievementDef(id: string): AchievementDef | undefined {
  return byId.get(id);
}
