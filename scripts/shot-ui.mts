/* eslint-disable @typescript-eslint/no-explicit-any -- UI screenshot helper */
/**
 * UI screenshot helper (dev): boots the built app, optionally places some content via
 * debug hooks to populate the HUD, frames the island, and captures a screenshot so the
 * UI rework can be eyeballed headlessly.
 *
 *   npm run build && npx tsx scripts/shot-ui.mts [outfile]
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', process.argv[2] ?? 'ui-rework.png');
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
const sleep = (page: Page, ms: number) => page.waitForTimeout(ms);

async function main(): Promise<void> {
  await mkdir(path.dirname(OUT), { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(page, 9500);

  // populate: a few homes (neighbours + a Pal), a chunk, a garden mid-grow — so the HUD has life
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    let n = 0;
    for (const [x, z] of [[6, 6], [10, 6], [6, 10]]) if (h.place('home.house', x, z, 0)) n++;
    for (let i = 0; i < 8; i++) h.place('nature.tree', 2 + i, 14, 0); // nudge a Pal in
    h.place('nature.garden', 12, 11, 0);
    const g = h.placementsOf('nature.garden')[0];
    if (g) h.plantCrop(g, 'crop.tomato');
    return n;
  });
  await sleep(page, 800);
  await page.keyboard.press('Home');
  await sleep(page, 3400); // let boot celebration toasts fade before the shot
  await page.evaluate(() => { const d = document.querySelector('.debug-hud') as HTMLElement | null; if (d) d.style.display = 'none'; });
  const key = process.argv[3];
  if (key) { await page.keyboard.press(key); await sleep(page, 400); }
  await page.screenshot({ path: OUT });
  await browser.close(); close();
  console.log('✓ shot →', OUT, errors.length ? `(errors: ${errors.slice(0, 2).join(' | ')})` : '(no errors)');
}
main().catch((e) => { console.error(e); process.exit(1); });
