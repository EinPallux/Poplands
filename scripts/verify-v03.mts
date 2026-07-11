/**
 * Headless functional verification of the v0.3 loop (ROADMAP v0.3 exit criteria):
 * boot → tutorial live → place flowers advances the tutorial + charges/rewards →
 * build a Tier-2 income building (proves tier gating allows it at L1) → wallet
 * math → reload persistence.
 *
 *   npm run build && npx tsx scripts/verify-v03.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
};

function serve(): Promise<{ url: string; close: () => void }> {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
      const filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
      const data = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

interface Poplands {
  wallet: () => { pops: number; stardust: number; level: number; xp: number };
  quests: () => { tutorial: { activeId: string | null; done: string[] } };
  island: {
    placementCount: number;
    hasBlock: (wx: number, wz: number) => boolean;
    occupantAt: (wx: number, wz: number) => unknown;
  };
  state: { economy: { collectAll: (now?: number) => number } };
  projectCell: (wx: number, wz: number) => { x: number; y: number };
}

const wallet = (page: Page) => page.evaluate(() => (window as never as { __poplands: Poplands }).__poplands.wallet());
const activeTutorial = (page: Page) =>
  page.evaluate(() => (window as never as { __poplands: Poplands }).__poplands.quests().tutorial.activeId);

async function settle(page: Page, timeoutMs = 40000): Promise<void> {
  const start = Date.now();
  const read = () =>
    page.evaluate(() => (window as never as { __poplands?: Poplands }).__poplands?.wallet().pops ?? null).catch(() => null);
  while ((await read()) === null) {
    if (Date.now() - start > timeoutMs) throw new Error('boot never finished');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
  await page.keyboard.press('Home');
  await page.waitForTimeout(1500);
}

/** Candidate empty cells (with a clear footprint) whose screen pos avoids the UI. */
async function candidateCells(page: Page, fw: number, fd: number): Promise<Array<{ x: number; y: number }>> {
  return page.evaluate(
    ({ fw, fd }) => {
      const p = (window as never as { __poplands: Poplands }).__poplands;
      const out: Array<{ x: number; y: number }> = [];
      for (let wx = 3; wx < 13; wx++) {
        for (let wz = 3; wz < 13; wz++) {
          let clear = true;
          for (let dx = 0; dx < fw; dx++)
            for (let dz = 0; dz < fd; dz++)
              if (!p.island.hasBlock(wx + dx, wz + dz) || p.island.occupantAt(wx + dx, wz + dz)) clear = false;
          if (!clear) continue;
          const s = p.projectCell(wx, wz);
          // avoid the left mailbox (<300), the bottom build bar (>600), the top HUD (<170)
          if (s.x > 320 && s.x < 1360 && s.y > 180 && s.y < 600) out.push(s);
        }
      }
      return out;
    },
    { fw, fd },
  );
}

async function clickCard(page: Page, name: string): Promise<void> {
  await page.locator('.build-card', { hasText: name }).first().click();
  await page.waitForTimeout(250);
}

/** Place up to `n` items of the currently-selected def, retrying across cells. */
async function placeN(page: Page, n: number, fw = 1, fd = 1): Promise<number> {
  let placed = 0;
  const cells = await candidateCells(page, fw, fd);
  for (const c of cells) {
    if (placed >= n) break;
    const before = await page.evaluate(
      () => (window as never as { __poplands: Poplands }).__poplands.island.placementCount,
    );
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(140);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(320);
    const after = await page.evaluate(
      () => (window as never as { __poplands: Poplands }).__poplands.island.placementCount,
    );
    if (after > before) placed++;
  }
  return placed;
}

async function main(): Promise<void> {
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message);
    failures++;
  });

  await page.goto(`${url}/?debug=1`);
  await settle(page);

  // 1 — fresh save state
  const w0 = await wallet(page);
  check('fresh wallet = 150 Pops, level 1', w0.pops === 150 && w0.level === 1, `${w0.pops}●, L${w0.level}`);
  check('tutorial live on first step', (await activeTutorial(page)) === 'tut.flowers');
  check('mailbox shows a postcard card', (await page.locator('.mail-card').count()) >= 1);

  // 2 — plant 3 flowers → completes tut.flowers, advances to tut.path, charges + rewards
  await clickCard(page, 'Bellbloom'); // nature.flower.purple, cost 12
  const flowersPlaced = await placeN(page, 3);
  check('planted 3 flowers', flowersPlaced === 3, `${flowersPlaced}`);
  await page.keyboard.press('Escape'); // leave build mode
  await page.waitForTimeout(400);
  const w1 = await wallet(page);
  // 150 - 3*12 + 30 (tut.flowers reward) = 144 ; xp = 3 placement + 12 quest = 15
  check('flowers charged + tutorial reward credited', w1.pops === 144, `${w1.pops}● (expected 144)`);
  check('placement + quest XP gained', w1.xp === 15, `${w1.xp} xp (expected 15)`);
  check('tutorial advanced to tut.path', (await activeTutorial(page)) === 'tut.path', `${await activeTutorial(page)}`);
  await page.screenshot({ path: path.join(ROOT, 'shots/v03-1-tutorial.png') });

  // 3 — Tier-2 income building must be BUILDABLE at level 1 (tier-gate fix)
  await clickCard(page, 'Flower Stall'); // income.stall, cost 100, tier 2, 2×2
  const stallPlaced = await placeN(page, 1, 2, 2);
  check('Tier-2 stall buildable at L1 and placed', stallPlaced === 1, `${stallPlaced}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const w2 = await wallet(page);
  check('stall charged 100 Pops', w2.pops === 44, `${w2.pops}● (expected 44)`);

  // 3.5 — collect the stall's income (deterministic: bank as of +5 min, no real wait).
  //  Stall accrues 2 Pops/min → 10 whole Pops banked. Proves the collect path end-to-end.
  const collected = await page.evaluate(
    () => (window as never as { __poplands: Poplands }).__poplands.state.economy.collectAll(Date.now() + 300_000),
  );
  await page.waitForTimeout(400);
  const w2c = await wallet(page);
  check('collectAll banks the stall income', collected === 10, `${collected}● collected (expected 10)`);
  check('collected Pops land in the wallet', w2c.pops === 54, `${w2c.pops}● (expected 54)`);

  // 4 — persistence across reload
  const countBefore = await page.evaluate(() => (window as never as { __poplands: Poplands }).__poplands.island.placementCount);
  await page.reload();
  await settle(page);
  const w3 = await wallet(page);
  const countAfter = await page.evaluate(() => (window as never as { __poplands: Poplands }).__poplands.island.placementCount);
  check('wallet persists across reload', w3.pops === 54, `${w3.pops}● (expected 54)`);
  check('placements persist across reload', countAfter === countBefore, `${countAfter} vs ${countBefore}`);
  check('tutorial progress persists', (await activeTutorial(page)) !== 'tut.flowers');

  // (the mid-move data-loss regression is covered by a pure unit test of
  //  withCarried() in tests/save.test.ts — reliable, no flaky headless pickup)

  await browser.close();
  close();
  console.log(failures === 0 ? '\nALL v0.3 CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
