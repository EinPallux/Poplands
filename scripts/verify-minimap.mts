/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Minimap verify (post-1.0): the island overview renders the grown island (chunks
 * fill the canvas), and tapping the map recenters the camera (focusOn follows the
 * tapped world point). No page errors.
 *
 *   npm run build && npx tsx scripts/verify-minimap.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'minimap.png');
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json',
};
function serve(): Promise<{ url: string; close: () => void }> {
  const server = http.createServer(async (req, res) => {
    try {
      const p = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
      const file = path.join(DIST, p === '/' ? 'index.html' : p);
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => {
    const a = server.address(); r({ url: `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`, close: () => server.close() });
  }));
}
const checks: Array<{ n: string; ok: boolean; d?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => checks.push({ n, ok, ...(d !== undefined ? { d } : {}) });
const sleep = (page: Page, ms: number) => page.waitForTimeout(ms);

async function main(): Promise<void> {
  await mkdir(path.dirname(OUT), { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const errors: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(page, 9500);

  // grow the island + drop a few things so the map has chunks + dots
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    h.growTo(6);
    h.place('nature.tree', 3, 3, 0);
    h.place('nature.bush', 5, 5, 0);
    h.place('nature.flower.red', 7, 7, 0);
  });
  await sleep(page, 400);
  const chunks = await page.evaluate(() => (window as any).__poplands.chunkCount());
  check('the island grew to a multi-chunk overview', chunks >= 6, `chunks=${chunks}`);

  // open the map and check the canvas actually rendered (opaque pixels = chunks drawn)
  await page.evaluate(() => (window as any).__poplands.openMinimap());
  await sleep(page, 400);
  const opaque = await page.evaluate(() => {
    const c = document.querySelector('.minimap-canvas') as HTMLCanvasElement | null;
    if (!c) return -1;
    const ctx = c.getContext('2d');
    if (!ctx) return -1;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
    return n;
  });
  check('the minimap canvas renders the island (chunks drawn)', opaque > 1500, `opaquePixels=${opaque}`);

  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // focusOn follows a world point (the camera side of tap-to-recenter)
  await page.evaluate(() => (window as any).__poplands.focusOn(0, 0));
  await sleep(page, 1400);
  const near0 = await page.evaluate(() => (window as any).__poplands.camTarget());
  await page.evaluate(() => (window as any).__poplands.focusOn(40, 40));
  await sleep(page, 1400);
  const near40 = await page.evaluate(() => (window as any).__poplands.camTarget());
  check('focusOn recenters the camera toward the target point', near40.x > near0.x + 1 && near40.z > near0.z + 1, `at0=${JSON.stringify(near0)} at40=${JSON.stringify(near40)}`);

  // tapping the canvas itself recenters (end-to-end wiring through onJumpTo)
  const before = await page.evaluate(() => (window as any).__poplands.camTarget());
  const box = await page.evaluate(() => {
    const c = document.querySelector('.minimap-canvas') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  await page.mouse.click(box.x + 24, box.y + 24); // tap near the top-left of the map
  await sleep(page, 1400);
  const after = await page.evaluate(() => (window as any).__poplands.camTarget());
  const moved = Math.hypot(after.x - before.x, after.z - before.z) > 0.5;
  check('tapping the map recenters the camera', moved, `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await context.close(); await browser.close(); close();
  console.log('\n── Minimap verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
