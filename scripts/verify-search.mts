/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Catalog search/filter verify (post-1.0): the build bar's search box narrows the
 * cards by name, "affordable only" hides items you can't pay for, "not placed" hides
 * items already on the island, and a no-match search shows the empty state. No errors.
 *
 *   npm run build && npx tsx scripts/verify-search.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'search-filter.png');
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

// count visible (not display:none) build cards, optionally within a def id
const visibleCount = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('.build-card')].filter((c) => (c as HTMLElement).style.display !== 'none').length);

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

  const total = await visibleCount(page);
  check('the catalog opens with all items visible', total > 20, `visible=${total}`);

  // — search by name: "tree" should narrow to a handful of tree items
  await page.fill('.build-search-input', 'tree');
  await sleep(page, 250);
  const treeCount = await visibleCount(page);
  const treeNames = await page.evaluate(() =>
    [...document.querySelectorAll('.build-card')]
      .filter((c) => (c as HTMLElement).style.display !== 'none')
      .map((c) => c.querySelector('.card-name')?.textContent ?? ''));
  const allTree = treeNames.every((n) => n.toLowerCase().includes('tree'));
  check('searching "tree" narrows to tree items only', treeCount > 0 && treeCount < total && allTree, `n=${treeCount} names=${treeNames.join('|')}`);

  // — a nonsense query shows the empty-state
  await page.fill('.build-search-input', 'zzzqqq');
  await sleep(page, 250);
  const gibberish = await visibleCount(page);
  const emptyShown = await page.evaluate(() => {
    const e = document.querySelector('.build-empty') as HTMLElement | null;
    return !!e && e.style.display !== 'none';
  });
  check('a no-match search shows the empty state', gibberish === 0 && emptyShown, `visible=${gibberish} empty=${emptyShown}`);

  // clear the search
  await page.fill('.build-search-input', '');
  await sleep(page, 200);

  // — "affordable only": with 150 starting Pops, only cheap items remain, all ≤ budget
  await page.click('.build-filter:has-text("Affordable")');
  await sleep(page, 250);
  const affordInfo = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('.build-card')].filter((c) => (c as HTMLElement).style.display !== 'none');
    // parse the "● NN" cost from each visible card
    const costs = vis.map((c) => {
      const txt = c.querySelector('.card-cost')?.textContent ?? '';
      const m = txt.match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    });
    return { count: vis.length, max: Math.max(0, ...costs) };
  });
  check('"affordable only" hides items over budget', affordInfo.count > 0 && affordInfo.count < total && affordInfo.max <= 150, JSON.stringify(affordInfo));
  await page.click('.build-filter:has-text("Affordable")'); // toggle back off
  await sleep(page, 200);

  // — "not placed": place a tree, then the filter should hide that one card
  await page.evaluate(() => (window as any).__poplands.place('nature.tree', 4, 4, 0));
  await sleep(page, 300);
  await page.click('.build-filter:has-text("Not placed")');
  await sleep(page, 250);
  const placedHidden = await page.evaluate(() => {
    const card = document.querySelector('.build-card[data-def="nature.tree"]') as HTMLElement | null;
    return !!card && card.style.display === 'none';
  });
  const stillOthers = await visibleCount(page);
  check('"not placed" hides an item already on the island', placedHidden && stillOthers > 0, `treeHidden=${placedHidden} others=${stillOthers}`);

  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await context.close(); await browser.close(); close();
  console.log('\n── Catalog search/filter verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
