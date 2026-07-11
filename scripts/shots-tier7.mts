/**
 * Visual sanity shot for the Tier 7–10 "Riverside/Harbor" content: boot, jump to
 * L10 + fund, place a few marquee items, and screenshot to eyeball the AABB-tuned
 * scales against their footprints.
 *
 *   npm run build && PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx scripts/shots-tier7.mts
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

interface Poplands {
  island: { placementCount: number; hasBlock: (wx: number, wz: number) => boolean; occupantAt: (wx: number, wz: number) => unknown };
  projectCell: (wx: number, wz: number) => { x: number; y: number };
  state: { progression: { grantXp: (n: number, s: string) => void }; economy: { credit: (p: number, s: number) => void } };
}
type Win = { __poplands: Poplands };

async function settle(page: Page): Promise<void> {
  const start = Date.now();
  const read = () =>
    page.evaluate(() => (window as never as { __poplands?: Poplands }).__poplands?.island.placementCount ?? null).catch(() => null);
  while ((await read()) === null) {
    if (Date.now() - start > 40000) throw new Error('boot never finished');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3500);
  await page.keyboard.press('Home');
  await page.waitForTimeout(1200);
}

async function cells(page: Page, fw: number, fd: number): Promise<Array<{ x: number; y: number }>> {
  return page.evaluate(
    ({ fw, fd }) => {
      const p = (window as never as Win).__poplands;
      const out: Array<{ x: number; y: number }> = [];
      for (let wx = 3; wx < 13; wx++)
        for (let wz = 3; wz < 13; wz++) {
          let clear = true;
          for (let dx = 0; dx < fw; dx++)
            for (let dz = 0; dz < fd; dz++)
              if (!p.island.hasBlock(wx + dx, wz + dz) || p.island.occupantAt(wx + dx, wz + dz)) clear = false;
          if (!clear) continue;
          const s = p.projectCell(wx, wz);
          if (s.x > 340 && s.x < 1320 && s.y > 200 && s.y < 600) out.push(s);
        }
      return out;
    },
    { fw, fd },
  );
}

async function place(page: Page, name: string, fw = 1, fd = 1): Promise<void> {
  await page.locator('.build-card', { hasText: name }).first().click();
  await page.waitForTimeout(200);
  const cs = await cells(page, fw, fd);
  for (const c of cs) {
    const before = await page.evaluate(() => (window as never as Win).__poplands.island.placementCount);
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(100);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(280);
    const after = await page.evaluate(() => (window as never as Win).__poplands.island.placementCount);
    if (after > before) break;
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

async function main(): Promise<void> {
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));

  await page.goto(`${url}/?debug=1`);
  await settle(page);

  // jump to L10 (unlocks Tiers 7–10) + fund generously
  await page.evaluate(() => {
    const p = (window as never as Win).__poplands;
    p.state.progression.grantXp(9000, 'quest');
    p.state.economy.credit(100000, 40);
  });
  await page.waitForTimeout(600);

  // place a few marquee items (footprints matter for candidate cells)
  await place(page, 'Lighthouse', 2, 2);
  await place(page, 'Fish Market', 3, 3);
  await place(page, 'Palm Tree', 1, 1);
  await place(page, 'Palm Tree', 1, 1);
  await place(page, 'Moored Sloop', 3, 2);
  await place(page, 'Barrel', 1, 1);
  await place(page, 'Crate Stack', 1, 1);
  await place(page, 'Reed Cluster', 1, 1);
  await place(page, 'Lily Pads', 1, 1);

  await page.keyboard.press('Home');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(ROOT, 'shots/v04-4-tier7.png') });
  console.log('✓ shots/v04-4-tier7.png');

  await browser.close();
  close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
