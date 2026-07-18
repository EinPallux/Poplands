/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Islander friendships verify (post-1.0): once two neighbours have moved in they're
 * best friends — shown in the Album ("💛 Mo & Pia") and, over time, they drift together
 * and mingle rather than wandering apart. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-friendship.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'friendship-album.png');
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

  // place a couple of homes → two neighbours (a friend pair) move in
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    let x = 4, z = 4, placed = 0;
    for (let i = 0; i < 60 && placed < 2; i++) {
      if (h.place('home.house', x, z, 0)) placed++;
      x += 4; if (x > 14) { x = 4; z += 4; }
    }
  });
  await sleep(page, 1500);
  const residents = await page.evaluate(() => (window as any).__poplands.residents().length);
  check('two neighbours have moved in', residents >= 2, `residents=${residents}`);

  // open the Album (J) → it lists a best-friend pair
  await page.keyboard.press('KeyJ');
  await sleep(page, 500);
  const album = await page.evaluate(() => {
    const panel = document.querySelector('.album-panel');
    const txt = panel?.textContent ?? '';
    const chips = Array.from(document.querySelectorAll('.album-chip')).map((c) => c.textContent ?? '');
    return { hasHeading: txt.includes('Best friends'), friendChips: chips.filter((c) => c.includes('💛')) };
  });
  check('the Album shows a Best friends section', album.hasHeading === true, '');
  check('a friend pair is listed (💛 A & B)', album.friendChips.length >= 1, album.friendChips[0] ?? '(none)');
  await page.keyboard.press('KeyJ'); // close the album for the behaviour sample
  await page.keyboard.press('Home');
  await sleep(page, 800);

  // over time the two friends drift together and mingle (they orbit, not scatter apart)
  let minDist = Infinity;
  for (let i = 0; i < 40; i++) {
    const d = await page.evaluate(() => {
      const ags = (window as any).__poplands.islanders();
      if (ags.length < 2) return Infinity;
      const [a, b] = ags;
      return Math.hypot(a.x - b.x, a.z - b.z);
    });
    minDist = Math.min(minDist, d);
    await sleep(page, 500);
  }
  check('best friends drift together and mingle', minDist < 5, `closest ≈ ${minDist.toFixed(1)} blocks`);
  await page.keyboard.press('KeyJ');
  await sleep(page, 400);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── Islander friendships verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
