/**
 * Headless functional verification of the v0.4 expansion loop (ROADMAP v0.4):
 * boot → survey offers on free edges → grant funds → buy a chunk → the arrival set
 * piece plays → the island grows (model + blocks) → reload persistence.
 *
 *   npm run build && PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx scripts/verify-v04.mts
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
  '.png': 'image/png',
  '.map': 'application/json',
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

interface Survey {
  cx: number;
  cz: number;
  pops: number;
  stardust: number;
}
interface Poplands {
  chunkCount: () => number;
  surveys: () => Survey[];
  buyChunk: (cx: number, cz: number) => void;
  island: { hasBlock: (wx: number, wz: number) => boolean };
  state: { economy: { credit: (pops: number, stardust: number) => void } };
  wallet: () => { pops: number; stardust: number };
  secrets: () => Array<{ cx: number; cz: number; kind: string; found: boolean }>;
  clickSecret: (cx: number, cz: number) => void;
  milestones: () => { secretsFound: number };
}
type Win = { __poplands: Poplands };

const chunkCount = (page: Page) => page.evaluate(() => (window as never as Win).__poplands.chunkCount());

async function settle(page: Page): Promise<void> {
  const start = Date.now();
  const read = () =>
    page
      .evaluate(() => (window as never as { __poplands?: Poplands }).__poplands?.chunkCount() ?? null)
      .catch(() => null);
  while ((await read()) === null) {
    if (Date.now() - start > 40000) throw new Error('boot never finished');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3500);
  await page.keyboard.press('Home');
  await page.waitForTimeout(1500);
}

async function main(): Promise<void> {
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message);
    failures++;
  });

  await page.goto(`${url}/?debug=1`);
  await settle(page);

  // 1 — starter island = 4 chunks; surveys offered on its free edges
  const c0 = await chunkCount(page);
  check('starter island has 4 chunks', c0 === 4, `${c0}`);
  const surveys0 = await page.evaluate(() => (window as never as Win).__poplands.surveys());
  check('surveys offered on free edges (≤3)', surveys0.length > 0 && surveys0.length <= 3, `${surveys0.length}`);
  check(
    'first chunk priced 250 ● + 2 ✦',
    surveys0[0]?.pops === 250 && surveys0[0]?.stardust === 2,
    `${surveys0[0]?.pops}● ${surveys0[0]?.stardust}✦`,
  );
  check('survey markers render in the DOM', (await page.locator('.survey-chip').count()) >= 1);

  // 2 — grant funds, buy the first surveyed chunk → arrival set piece + growth
  await page.evaluate(() => (window as never as Win).__poplands.state.economy.credit(2000, 10));
  const slot = surveys0[0]!;
  await page.evaluate((s) => (window as never as Win).__poplands.buyChunk(s.cx, s.cz), slot);
  await page.waitForTimeout(3000); // let the ~2.2 s arrival play out

  const c1 = await chunkCount(page);
  check('island grew to 5 chunks after purchase', c1 === 5, `${c1}`);
  const gotBlock = await page.evaluate(
    (s) => (window as never as Win).__poplands.island.hasBlock(s.cx * 8 + 3, s.cz * 8 + 3),
    slot,
  );
  check('the new chunk is buildable (hasBlock)', gotBlock === true);
  await page.screenshot({ path: path.join(ROOT, 'shots/v04-1-expanded.png') });

  // 2b — discover the starter island's forced dig secret (S19: (0,0) = generous dig)
  const secrets = await page.evaluate(() => (window as never as Win).__poplands.secrets());
  const dig = secrets.find((s) => s.cx === 0 && s.cz === 0);
  check('starter chunk (0,0) has a forced dig secret', dig?.kind === 'dig', `${dig?.kind}`);
  const wPops = (await page.evaluate(() => (window as never as Win).__poplands.wallet())).pops;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as never as Win).__poplands.clickSecret(0, 0));
    await page.waitForTimeout(150);
  }
  const afterPops = (await page.evaluate(() => (window as never as Win).__poplands.wallet())).pops;
  const ms = await page.evaluate(() => (window as never as Win).__poplands.milestones());
  check('digging 3× discovers the secret (secretsFound=1)', ms.secretsFound === 1, `${ms.secretsFound}`);
  check('the dig reward (100 ●) lands in the wallet', afterPops === wPops + 100, `${afterPops} (was ${wPops})`);

  // 3 — persistence across reload
  await page.reload();
  await settle(page);
  const c2 = await chunkCount(page);
  check('the bought chunk persists across reload', c2 === 5, `${c2}`);
  const gotBlock2 = await page.evaluate(
    (s) => (window as never as Win).__poplands.island.hasBlock(s.cx * 8 + 3, s.cz * 8 + 3),
    slot,
  );
  check('the new chunk still buildable after reload', gotBlock2 === true);
  const ms2 = await page.evaluate(() => (window as never as Win).__poplands.milestones());
  check('the discovered secret persists across reload', ms2.secretsFound === 1, `${ms2.secretsFound}`);

  await browser.close();
  close();
  console.log(failures === 0 ? '\nALL v0.4 CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
