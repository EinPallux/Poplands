/**
 * v0.3 "Pops & Purpose" milestone beauty shots: boot the built game, capture the
 * full HUD/mailbox UI shell on a fresh island, then play the tutorial's cozy
 * corner (flowers → path → bench → stall → hut → lanterns) and capture the
 * lived-in island, a build-bar catalog view, and (best-effort) a ripe income
 * bubble after the stall accrues.
 *
 *   npm run build && PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx scripts/shots-v03.mts [outDir]
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'shots'));
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
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
      res.end('not found');
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
  island: {
    placementCount: number;
    hasBlock: (wx: number, wz: number) => boolean;
    occupantAt: (wx: number, wz: number) => unknown;
  };
  projectCell: (wx: number, wz: number) => { x: number; y: number };
}

async function settle(page: Page): Promise<void> {
  const start = Date.now();
  const read = () =>
    page.evaluate(() => (window as never as { __poplands?: Poplands }).__poplands?.island.placementCount ?? null).catch(() => null);
  while ((await read()) === null) {
    if (Date.now() - start > 40000) throw new Error('boot never finished');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3500); // shader warmup + intro swoop
  await page.keyboard.press('Home');
  await page.waitForTimeout(1500);
}

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

const placementCount = (page: Page) =>
  page.evaluate(() => (window as never as { __poplands: Poplands }).__poplands.island.placementCount);

async function placeN(page: Page, n: number, fw = 1, fd = 1): Promise<number> {
  let placed = 0;
  const cells = await candidateCells(page, fw, fd);
  for (const c of cells) {
    if (placed >= n) break;
    const before = await placementCount(page);
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(120);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(300);
    const after = await placementCount(page);
    if (after > before) placed++;
  }
  return placed;
}

async function build(page: Page, name: string, n: number, fw = 1, fd = 1): Promise<void> {
  await clickCard(page, name);
  const got = await placeN(page, n, fw, fd);
  console.log(`  · ${name}: ${got}/${n}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  await page.goto(`${url}/?debug=1`);
  await settle(page);

  // 1 — fresh island + the full v0.3 UI shell (wallet pills, level ring, mailbox)
  await page.screenshot({ path: path.join(OUT, 'v03-a-firstlight.png') });
  console.log('✓ v03-a-firstlight.png (fresh boot: HUD + mailbox + island)');

  // build the tutorial's cozy corner so the island feels lived-in
  console.log('building the cozy corner…');
  await build(page, 'Bellbloom', 3); // flowers → tut.flowers
  await build(page, 'Dirt Path', 3); // paths → tut.path
  await build(page, 'Garden Bench', 1); // → tut.bench
  await build(page, 'Flower Stall', 1, 2, 2); // income → tut.stall
  await build(page, 'Cozy Hut', 1, 3, 3); // home → tut.hut
  await build(page, 'Lantern', 2); // → tut.lanterns / cozy corner
  await build(page, 'Little Tree', 3); // a little grove for lushness

  await page.keyboard.press('Home');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, 'v03-b-livedin.png') });
  console.log('✓ v03-b-livedin.png (cozy corner built, tutorial advanced)');

  // 2 — build bar catalog: open, Nature tab (thumbnails, tiers, costs)
  await page.locator('.build-tab', { hasText: 'Nature' }).first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'v03-c-catalog.png') });
  console.log('✓ v03-c-catalog.png (build bar, Nature tab)');

  // orbit for a hero angle of the built island
  await page.mouse.move(800, 450);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(1180, 500, { steps: 28 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'v03-d-hero.png') });
  console.log('✓ v03-d-hero.png (orbit hero)');

  // 3 — let the stall accrue, then capture a ripe income bubble (best-effort)
  console.log('waiting ~45s for the stall to ripen…');
  await page.keyboard.press('Home');
  await page.waitForTimeout(45000);
  await page.screenshot({ path: path.join(OUT, 'v03-e-ripe.png') });
  console.log('✓ v03-e-ripe.png (stall income ripening)');

  await browser.close();
  close();
  console.log(`\nScreenshots → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
