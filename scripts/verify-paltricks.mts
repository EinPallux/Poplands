/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Pal tricks verify (post-1.0): pet a Pal enough and it learns a trick — a "learned a
 * trick!" toast + a playful dance, a ⭐ beside it in the Album, and the trick STICKS
 * across a reload (Save v10). No page errors.
 *
 *   npm run build && npx tsx scripts/verify-paltricks.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'paltricks-album.png');
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
  // one persistent context so localStorage survives the reload
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(page, 9500);

  // plant a bunch of nature → a Pal scampers in
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    const kinds = ['nature.tree', 'nature.bush', 'nature.flower.red', 'nature.grass'];
    let x = 2, z = 2, n = 0;
    for (let i = 0; i < 40 && n < 12; i++) {
      if (h.place(kinds[i % kinds.length], x, z, 0)) n++;
      x += 1; if (x > 14) { x = 2; z += 1; }
    }
  });
  await sleep(page, 1500);
  const pal = await page.evaluate(() => (window as any).__poplands.palRoster()[0] ?? null);
  check('planting nature brings a Pal', pal !== null, `pal=${pal}`);

  // pet it three times → it learns a trick
  await page.evaluate((id) => {
    const h = (window as any).__poplands;
    h.clickPal(id); h.clickPal(id); h.clickPal(id);
  }, pal);
  await sleep(page, 600);
  const learned = await page.evaluate((id) => {
    const h = (window as any).__poplands;
    return { count: h.petCount(id), tricks: h.palTricks() };
  }, pal);
  check('petting three times learns a trick', learned.count === 3 && learned.tricks.includes(pal), JSON.stringify(learned));

  // the Album marks the trick with a ⭐
  await page.keyboard.press('KeyJ');
  await sleep(page, 400);
  const albumStar = await page.evaluate(() => !!document.querySelector('.album-trick'));
  check('the Album shows a ⭐ on the trick-Pal', albumStar === true, '');
  await page.keyboard.press('KeyJ');
  await page.keyboard.press('Home');
  await sleep(page, 700);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── the trick STICKS across a reload (Save v10) ──
  await page.reload({ waitUntil: 'domcontentloaded' }); // pagehide flushes the save first
  await sleep(page, 9500);
  const afterReload = await page.evaluate((id) => {
    const h = (window as any).__poplands;
    return { tricks: h.palTricks(), count: h.petCount(id) };
  }, pal);
  check('the learned trick persists across a reload', afterReload.tricks.includes(pal) && afterReload.count >= 3, JSON.stringify(afterReload));

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await context.close(); await browser.close(); close();
  console.log('\n── Pal tricks verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
