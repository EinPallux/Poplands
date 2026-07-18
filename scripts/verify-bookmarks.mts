/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Camera bookmarks verify (post-1.0): save the current view, move away, jump back
 * and the camera returns to the saved viewpoint; the Views panel saves/renames/deletes;
 * and a saved view PERSISTS across a reload (Save v12). No page errors.
 *
 *   npm run build && npx tsx scripts/verify-bookmarks.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'camera-bookmarks.png');
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
  await sleep(page, 9500); // let the intro swoop finish (orbit/zoom are no-ops during it)

  const v0 = await page.evaluate(() => (window as any).__poplands.camView());
  check('camView reports the current viewpoint', typeof v0.azimuth === 'number' && typeof v0.distance === 'number', JSON.stringify(v0));

  // move the camera to a distinct angle/zoom, then save it as a bookmark
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    h.rig.orbitBy(0.9, 0.05); h.rig.zoomBy(1.4);
  });
  await sleep(page, 200);
  await page.evaluate(() => (window as any).__poplands.saveView('Corner'));
  await sleep(page, 200);
  const saved = await page.evaluate(() => (window as any).__poplands.bookmarks());
  check('saving captures the current view as a bookmark', saved.length === 1 && saved[0].name === 'Corner', JSON.stringify(saved[0] ?? null));
  const target = saved[0];

  // move somewhere else, then jump back — the camera goals should return to the saved view
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    h.rig.orbitBy(-1.6, -0.08); h.rig.zoomBy(0.55);
  });
  await sleep(page, 150);
  const moved = await page.evaluate(() => (window as any).__poplands.camView());
  const didMove = Math.abs(moved.azimuth - target.azimuth) > 0.2 || Math.abs(moved.distance - target.distance) > 1;
  check('the camera actually moved away before the jump', didMove, `moved=${JSON.stringify(moved)}`);

  await page.evaluate(() => (window as any).__poplands.jumpView(0));
  await sleep(page, 150);
  const back = await page.evaluate(() => (window as any).__poplands.camView());
  const near = (a: number, b: number, e = 0.02) => Math.abs(a - b) <= e;
  const restored = near(back.azimuth, target.azimuth) && near(back.polar, target.polar) && near(back.distance, target.distance, 0.05) && near(back.tx, target.tx, 0.05) && near(back.tz, target.tz, 0.05);
  check('jumping restores the saved viewpoint', restored, `back=${JSON.stringify(back)} target=${JSON.stringify({ azimuth: target.azimuth, polar: target.polar, distance: target.distance, tx: target.tx, tz: target.tz })}`);

  // — Views panel UI: open it, it lists the saved view; "Save current view" adds another
  await page.click('.bookmarks-btn');
  await sleep(page, 300);
  const listed = await page.evaluate(() => document.querySelectorAll('.bm-row').length);
  check('the Views panel lists the saved view', listed === 1, `rows=${listed}`);
  await page.click('.bm-save'); // add a second bookmark from the panel
  await sleep(page, 250);
  const listed2 = await page.evaluate(() => document.querySelectorAll('.bm-row').length);
  check('the "Save current view" button adds a bookmark', listed2 === 2, `rows=${listed2}`);

  // rename the first bookmark inline
  await page.fill('.bm-row:first-child .bm-name', 'Sunset spot');
  await page.keyboard.press('Tab'); // blur → change → onRename
  await sleep(page, 200);
  const renamed = await page.evaluate(() => (window as any).__poplands.bookmarks()[0].name);
  check('renaming a bookmark inline updates it', renamed === 'Sunset spot', `name=${renamed}`);

  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // delete the second one via its 🗑
  await page.click('.bm-row:last-child .bm-del');
  await sleep(page, 200);
  const afterDel = await page.evaluate(() => (window as any).__poplands.bookmarks().length);
  check('deleting a bookmark removes it', afterDel === 1, `count=${afterDel}`);

  // ── the surviving bookmark PERSISTS across a reload (Save v12) ──
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(page, 9500);
  const afterReload = await page.evaluate(() => (window as any).__poplands.bookmarks());
  check('a saved view persists across a reload', afterReload.length === 1 && afterReload[0].name === 'Sunset spot', JSON.stringify(afterReload));

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await context.close(); await browser.close(); close();
  console.log('\n── Camera bookmarks verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
