/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Statistics page verify (post-1.0): active playtime accrues while the tab is open,
 * the Stats panel shows live counters (things placed etc.), and playtime PERSISTS
 * across a reload (Save v13). No page errors.
 *
 *   npm run build && npx tsx scripts/verify-stats.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'stats-page.png');
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

  // playtime accrues while the tab runs
  const p1 = await page.evaluate(() => (window as any).__poplands.playMs());
  await sleep(page, 1500);
  const p2 = await page.evaluate(() => (window as any).__poplands.playMs());
  check('active playtime accrues while the tab is open', p2 > p1 && p1 > 0, `p1=${p1} p2=${p2}`);

  // place a couple of things so the "Things placed" stat is non-zero
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    h.place('nature.tree', 4, 4, 0);
    h.place('nature.bush', 6, 6, 0);
  });
  await sleep(page, 300);

  // open the Stats panel and read the grid
  await page.click('.stats-btn');
  await sleep(page, 300);
  const grid = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.stat-card')];
    const byLabel: Record<string, string> = {};
    for (const c of cards) {
      const label = c.querySelector('.stat-label')?.textContent ?? '';
      const value = c.querySelector('.stat-value')?.textContent ?? '';
      byLabel[label] = value;
    }
    const playtime = document.querySelector('.stats-playtime')?.textContent ?? '';
    return { count: cards.length, placed: byLabel['Things placed'] ?? '?', playtime };
  });
  check('the Stats panel shows a full grid of counters', grid.count >= 12, `cards=${grid.count}`);
  check('the "Things placed" counter reflects placements', grid.placed === '2', `placed=${grid.placed}`);
  check('the playtime line shows a non-zero duration', /\d/.test(grid.playtime) && !grid.playtime.includes('0s '), `playtime=${grid.playtime}`);

  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── playtime PERSISTS across a reload (Save v13) ──
  const before = await page.evaluate(() => (window as any).__poplands.playMs());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(page, 9500);
  const after = await page.evaluate(() => (window as any).__poplands.playMs());
  check('playtime persists across a reload (keeps accruing)', after >= before && before > 0, `before=${before} after=${after}`);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await context.close(); await browser.close(); close();
  console.log('\n── Statistics page verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
