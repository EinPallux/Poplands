/**
 * Full-arc balance pass (S14, v0.7) — an analytical model over the REAL curves &
 * catalog (imported, not copied), reporting the L1→L20 economy so tuning is grounded
 * in numbers, not vibes. Checks the no-grind covenant: the capstone goal (reach L20,
 * build The Wonder) must be reachable from guaranteed faucets without grinding, every
 * tier must be affordable near its unlock, and the XP curve must be humane.
 *
 *   npx tsx scripts/balance-v07.mts
 */
import { xpToNext, MAX_LEVEL } from '@/core/playerStore';
import { levelReward, placementXp, tierUnlockLevel } from '@/sim/progression';
import { chunkPrice, STARTER_CHUNKS, CHUNK_SOFT_CAP } from '@/content/expansion';
import { CATALOG, MAX_TIER, itemsInTier } from '@/content/catalog';
import { MILESTONES, POSTCARDS, TUTORIAL } from '@/content/quests';

const fmt = (n: number): string => n.toLocaleString('en-US');
const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const check = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

// ── XP curve ────────────────────────────────────────────────────────────────
let totalXp = 0;
const perLevel: number[] = [];
for (let L = 1; L < MAX_LEVEL; L++) {
  const x = xpToNext(L);
  perLevel.push(x);
  totalXp += x;
}
console.log('── XP curve (L1→L20) ──');
console.log(`total XP to L20: ${fmt(totalXp)}`);
console.log(`per-level: ${perLevel.map((x) => fmt(x)).join(' · ')}`);
// humane pacing: no cliff among levels that carry real weight (>300 XP; the tiny
// L1→L2 ramp of 60→180 is a rounding artifact, not a wall).
let worstJump = 1;
for (let i = 1; i < perLevel.length; i++) {
  if (perLevel[i - 1]! < 300) continue;
  worstJump = Math.max(worstJump, perLevel[i]! / perLevel[i - 1]!);
}
check('XP curve is smooth past the early ramp (steps ≤ 1.6×)', worstJump <= 1.6, `worst jump ×${worstJump.toFixed(2)}`);

// placement XP SCALES WITH COST, so model a realistic mixed basket, not a flat item:
// ~2× of every catalog item is a plausible developed island. Quests/secrets add more.
const basketXp = CATALOG.reduce((s, d) => s + placementXp(d.cost), 0) * 2;
console.log(`≈ placing 2× the catalog yields ${fmt(basketXp)} XP (need ${fmt(totalXp)}); real play adds quests+secrets on top`);
check('L20 reachable by a developed island (2× catalog XP ≥ total)', basketXp >= totalXp, `${fmt(basketXp)} ≥ ${fmt(totalXp)}`);

// ── Stardust ledger (the intended binding constraint) ─────────────────────────
let sdLevels = 0;
for (let L = 2; L <= MAX_LEVEL; L++) sdLevels += levelReward(L).stardust;
let sdMilestones = 0;
for (const m of MILESTONES) for (const t of m.tiers) sdMilestones += t.reward.stardust ?? 0;
let sdPostcards = 0;
for (const p of POSTCARDS) sdPostcards += p.rewards.stardust ?? 0;
// secrets: GDD/CONTENT_PLAN model ~45 ✦ across the run (chest/flora rolls). Model it
// as a documented external faucet, not invented here.
const sdSecretsModel = 45;
const sdGuaranteed = sdLevels + sdMilestones; // no RNG, no optional content
const sdWithContent = sdGuaranteed + sdPostcards + sdSecretsModel;

// sinks
let sdAllChunks = 0;
for (let owned = STARTER_CHUNKS; owned < CHUNK_SOFT_CAP; owned++) sdAllChunks += chunkPrice(owned).stardust;
const wonderSd = CATALOG.find((d) => d.id === 'decor.the-wonder')!.costStardust ?? 0;
// how many chunk buys can guaranteed faucets fund AFTER the Wonder is paid for?
let sdRunning = wonderSd;
let guaranteedBuys = 0;
for (let owned = STARTER_CHUNKS; owned < CHUNK_SOFT_CAP; owned++) {
  sdRunning += chunkPrice(owned).stardust;
  if (sdRunning <= sdGuaranteed) guaranteedBuys++;
  else break;
}
// and with content faucets (postcards + the secret trickle)?
let sdRunning2 = wonderSd;
let contentBuys = 0;
for (let owned = STARTER_CHUNKS; owned < CHUNK_SOFT_CAP; owned++) {
  sdRunning2 += chunkPrice(owned).stardust;
  if (sdRunning2 <= sdWithContent) contentBuys++;
  else break;
}
const sdGenerous = wonderSd + (() => { let s = 0; for (let o = STARTER_CHUNKS; o < 24; o++) s += chunkPrice(o).stardust; return s; })();

console.log('\n── Stardust ✦ ledger ──');
console.log(`faucets: levels ${sdLevels} + milestones ${sdMilestones} = ${sdGuaranteed} guaranteed; +postcards ${sdPostcards} +secrets~${sdSecretsModel} = ~${sdWithContent} with content`);
console.log(`Wonder (${wonderSd}✦) + guaranteed faucets funds ${guaranteedBuys} bonus chunk-buys (a ${STARTER_CHUNKS + guaranteedBuys}-chunk island); with content faucets, ${contentBuys} buys (a ${STARTER_CHUNKS + contentBuys}-chunk island).`);
console.log(`sinks: generous 24-chunk + Wonder ${sdGenerous} · full 36-chunk + Wonder ${sdAllChunks + wonderSd}`);
// the covenant: the CAPSTONE must be reachable from guaranteed faucets, with room to grow.
check('the Wonder capstone is affordable from guaranteed ✦ faucets alone', sdGuaranteed >= wonderSd, `guaranteed ${sdGuaranteed} ≥ Wonder ${wonderSd}`);
check('guaranteed faucets fund the Wonder + doubling the starter island (≥4 buys)', guaranteedBuys >= 4, `${guaranteedBuys} bonus buys`);
check('content faucets fund the Wonder + a generous 24-chunk island', sdWithContent >= sdGenerous, `~${sdWithContent} ≥ ${sdGenerous}`);
// full 36-chunk maxing intentionally needs the ongoing trickle ("always a star to catch").
console.log(`(full 36-chunk + Wonder = ${sdAllChunks + wonderSd}✦ — by design a long-tail goal fed by the shooting-star/secret trickle, not a grind)`);

// ── Pops affordability per tier (no cost wall) ────────────────────────────────
// cumulative guaranteed Pops by level L = start 150 + Σ levelReward.pops (L'≤L).
// (income + quests + secrets add MORE on top — this is a conservative floor.)
console.log('\n── Pops ● affordability floor per tier ──');
let cumPops = 150;
const cumByLevel: Record<number, number> = { 1: 150 };
for (let L = 2; L <= MAX_LEVEL; L++) {
  cumPops += levelReward(L).pops;
  cumByLevel[L] = cumPops;
}
let allTiersOk = true;
for (let tier = 1; tier <= MAX_TIER; tier++) {
  const items = itemsInTier(tier);
  if (items.length === 0) continue;
  const cheapest = Math.min(...items.map((d) => d.cost));
  const unlockL = tierUnlockLevel(tier);
  // guaranteed floor by the unlock level (income makes the real number much higher)
  const floor = cumByLevel[Math.min(unlockL, MAX_LEVEL)] ?? 150;
  // the cheapest item should be within reach of a modest income buffer — flag only
  // if it's absurd vs the level-reward floor alone (income is the real faucet).
  const reachable = cheapest <= floor * 8 + 500; // generous: income dominates late
  if (!reachable) allTiersOk = false;
  console.log(`T${String(tier).padStart(2)} unlock L${String(unlockL).padStart(2)}  cheapest ${fmt(cheapest).padStart(6)}●  floor≈${fmt(floor)}●  ${reachable ? 'ok' : '⚠ WALL'}`);
}
check('no tier has an impossible cheapest-item cost wall', allTiersOk, 'see per-tier table');

// The Wonder Pops cost vs plausible end-game income. A developed L20 island owns many
// income buildings; model ~12 of the best (a realistic late catalog spread).
const wonderPops = CATALOG.find((d) => d.id === 'decor.the-wonder')!.cost;
const incomeItems = CATALOG.filter((d) => d.income).sort((a, b) => b.income!.ratePerMin - a.income!.ratePerMin);
const devRate = incomeItems.slice(0, 12).reduce((s, d) => s + d.income!.ratePerMin, 0);
const minsForWonder = wonderPops / Math.max(1, devRate);
console.log(`\nThe Wonder: ${fmt(wonderPops)}● — a developed island's top income makes ~${fmt(devRate)}●/min → ~${minsForWonder.toFixed(0)} min of banked income (a session-scale capstone goal, plus level/quest/secret Pops on top)`);
check('The Wonder is a session-scale (not multi-day) Pops goal (< 150 min banked)', minsForWonder < 150, `~${minsForWonder.toFixed(0)} min`);

// ── quests exist to fund the early arc ────────────────────────────────────────
const tutorialXp = TUTORIAL.reduce((s, q) => s + (q.rewards.xp ?? 0), 0);
console.log(`\n── quest XP faucet ── tutorial grants ${fmt(tutorialXp)} XP across ${TUTORIAL.length} steps (funds ~L${(() => { let L = 1, x = tutorialXp; while (L < MAX_LEVEL && x >= xpToNext(L)) { x -= xpToNext(L); L++; } return L; })()})`);

// ── report ────────────────────────────────────────────────────────────────────
console.log('\n══ balance verdict ══');
let allPass = true;
for (const r of results) {
  console.log(`${r.pass ? '✓' : '✗'} ${r.name}  (${r.detail})`);
  if (!r.pass) allPass = false;
}
console.log(allPass ? '\nBALANCE OK' : '\nBALANCE FLAGS ABOVE — tune before v1.0');
process.exit(allPass ? 0 : 1);
