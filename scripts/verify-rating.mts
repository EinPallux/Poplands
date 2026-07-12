/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Island Charm rating verify (post-1.0 batch, user 2026-07-12, #3 retention feature):
 * a ⭐ dock button opens a panel showing a star score, a six-axis breakdown, and gentle
 * "what to add next" tips. A fresh island earns a friendly half-star with encouraging
 * tips; building it up raises the score and shifts the tips to what's still missing.
 *
 *   npm run build && npx tsx scripts/verify-rating.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'rating-panel.png');
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(page, 9500);

  // ── a fresh island: a friendly half-star + encouraging tips ──
  const fresh = await page.evaluate(() => (window as any).__poplands.ratingView());
  check('a fresh island earns a friendly half-star (never 0)', fresh.stars === 0.5, `stars=${fresh.stars}`);
  check('the fresh verdict is encouraging, not harsh', fresh.verdictKey === 'rating.verdict.start', fresh.verdictKey);
  check('a fresh island gets actionable next-step tips', Array.isArray(fresh.tips) && fresh.tips.length >= 1, `tips=${fresh.tips.length}`);
  check('the breakdown has all six charm axes', fresh.categories.length === 6, `axes=${fresh.categories.length}`);

  // ── the panel opens with stars, a breakdown, and a tips list ──
  await page.evaluate(() => (window as any).__poplands.openRating());
  await sleep(page, 400);
  const panel = await page.evaluate(() => ({
    open: !!document.querySelector('.rating-panel') && (document.querySelector('.rating-panel') as HTMLElement).style.display !== 'none',
    stars: !!document.querySelector('.rating-stars .rs-fill'),
    axes: document.querySelectorAll('.rating-axis').length,
    tips: document.querySelectorAll('.rating-tips li').length,
    verdict: document.querySelector('.rating-verdict')?.textContent ?? '',
  }));
  check('the rating panel opens with a star meter', panel.open && panel.stars, JSON.stringify(panel));
  check('the panel lists all six axis bars', panel.axes === 6, `axes=${panel.axes}`);
  check('the panel shows at least one cozy tip', panel.tips >= 1, `tips=${panel.tips}`);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── build the island up → the score rises (inline loop; no named nested arrows,
  //    which esbuild would wrap in __name and break inside evaluate) ──
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    const wants = ['nature.tree', 'nature.tree', 'nature.tree', 'nature.tree', 'nature.tree', 'nature.tree',
      'nature.tree', 'nature.tree', 'nature.tree', 'nature.tree', 'nature.tree', 'nature.tree',
      'home.hut', 'home.hut', 'decor.bench', 'decor.lantern', 'decor.fountain', 'income.stall', 'income.stall'];
    let x = 2, z = 2;
    for (const def of wants) {
      let placed = false;
      for (let i = 0; i < 60 && !placed; i++) {
        placed = h.place(def, x, z, 0);
        x += 2;
        if (x > 14) { x = 2; z += 2; }
      }
    }
  });
  await sleep(page, 600);
  const after = await page.evaluate(() => (window as any).__poplands.ratingView());
  check('building the island raises the charm score', after.stars > fresh.stars, `${fresh.stars} → ${after.stars}`);
  check('the overall fraction climbs too', after.overall > fresh.overall, `${fresh.overall.toFixed(2)} → ${after.overall.toFixed(2)}`);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── Island Charm rating verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
