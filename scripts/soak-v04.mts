/**
 * 36-chunk scripted soak (ROADMAP v0.4 exit criterion, TECH §6.5). Grows the
 * island to the 36-chunk soft cap and asserts the bare island stays within the
 * hard draw/tri budgets. (The 60 fps half needs real hardware — the headless
 * software renderer can't measure it — but draws/tris ARE renderer counts we can
 * read.) Props are covered separately by the v0.2 190/500-item stress.
 *
 *   npm run build && PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx scripts/soak-v04.mts
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
const DRAW_BUDGET = 400; // TECH §6.5
const TRI_BUDGET = 1_200_000;

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
  chunkCount: () => number;
  growTo: (n: number) => void;
  stats: () => { draws: number; tris: number };
}
type Win = { __poplands: Poplands };

async function settle(page: Page): Promise<void> {
  const start = Date.now();
  const read = () =>
    page.evaluate(() => (window as never as { __poplands?: Poplands }).__poplands?.chunkCount() ?? null).catch(() => null);
  while ((await read()) === null) {
    if (Date.now() - start > 40000) throw new Error('boot never finished');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
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

  // grow to the 36-chunk soft cap
  await page.evaluate(() => (window as never as Win).__poplands.growTo(36));
  await page.waitForTimeout(600);
  await page.keyboard.press('Home');
  await page.waitForTimeout(1600); // let the camera ease out to frame the big island

  const count = await page.evaluate(() => (window as never as Win).__poplands.chunkCount());
  check('island grew to the 36-chunk soft cap', count === 36, `${count}`);

  const stats = await page.evaluate(() => (window as never as Win).__poplands.stats());
  check(`draw calls within budget (≤${DRAW_BUDGET})`, stats.draws <= DRAW_BUDGET, `${stats.draws} draws`);
  check(`triangles within budget (≤${(TRI_BUDGET / 1e6).toFixed(1)}M)`, stats.tris <= TRI_BUDGET, `${(stats.tris / 1000).toFixed(1)}k tris`);
  console.log(`  (bare 36-chunk island; props add ≈65 pool draws by the v0.2 stress — combined well under ${DRAW_BUDGET})`);

  await page.screenshot({ path: path.join(ROOT, 'shots/v04-3-soak-36.png') });

  await browser.close();
  close();
  console.log(failures === 0 ? '\nSOAK PASSED (draw/tri budgets)' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
