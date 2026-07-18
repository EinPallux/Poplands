/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Happiness meter verify (post-1.0): the neighbours' mood is derived from the cosy
 * amenities around them, shows in the Album + Island Charm panel, rises as you build,
 * and lifts the liveliness dividend. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-happiness.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'happiness-album.png');
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

  // a couple of homes → neighbours, but nothing cosy yet → a modest mood
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    let x = 3, z = 3, placed = 0;
    for (let i = 0; i < 60 && placed < 2; i++) {
      if (h.place('home.hut', x, z, 0)) placed++;
      x += 3; if (x > 13) { x = 3; z += 3; }
    }
  });
  await sleep(page, 800);
  const before = await page.evaluate(() => {
    const h = (window as any).__poplands;
    return { happy: h.happiness(), bonus: h.livelinessBonus() };
  });
  check('neighbours have a mood (always positive)', before.happy.score >= 0 && !!before.happy.moodKey, JSON.stringify(before.happy.moodKey));

  // deck the island out with nature + decor → the mood should climb
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    const kinds = ['nature.tree', 'nature.bush', 'nature.flower.red', 'decor.bench', 'decor.lantern'];
    let x = 2, z = 6;
    for (let i = 0; i < 30; i++) {
      const def = kinds[i % kinds.length];
      let placed = false;
      for (let j = 0; j < 40 && !placed; j++) { placed = h.place(def, x, z, 0); x += 1; if (x > 14) { x = 2; z += 1; } }
    }
  });
  await sleep(page, 800);
  const after = await page.evaluate(() => {
    const h = (window as any).__poplands;
    return { happy: h.happiness(), bonus: h.livelinessBonus() };
  });
  check('decking the island out lifts the mood', after.happy.score > before.happy.score, `${before.happy.score.toFixed(2)} → ${after.happy.score.toFixed(2)}`);
  check('a happier island pays a bigger liveliness dividend', after.bonus > before.bonus, `${before.bonus.toFixed(2)} → ${after.bonus.toFixed(2)}`);

  // the Island Charm panel shows the mood line
  await page.evaluate(() => (window as any).__poplands.openRating());
  await sleep(page, 400);
  const charm = await page.evaluate(() => {
    const el = document.querySelector('.rating-mood');
    return { present: !!el, text: el?.textContent ?? '' };
  });
  check('the Island Charm panel shows the neighbours’ mood', charm.present === true, charm.text.trim());

  // the Album shows the mood line
  await page.keyboard.press('KeyJ');
  await sleep(page, 400);
  const album = await page.evaluate(() => {
    const el = document.querySelector('.album-mood');
    return { present: !!el, text: el?.textContent ?? '' };
  });
  check('the Album shows the neighbours’ mood', album.present === true, album.text.trim());
  await page.keyboard.press('Home');
  await sleep(page, 700);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── happiness meter verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
