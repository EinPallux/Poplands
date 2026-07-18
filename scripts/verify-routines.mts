/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Day/night routines verify (post-1.0): at night Islanders head home and tuck in (the
 * avatars hide; the window glow sells "someone's home"); by morning they reappear and
 * resume wandering. Drives the real time-of-day → sim seam via setTime, plus a forced
 * retire for a deterministic hide count. Night beauty shot. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-routines.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'routines-night.png');
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

  // place homes so a few neighbours move in
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    let x = 3, z = 3, placed = 0;
    for (let i = 0; i < 60 && placed < 3; i++) {
      if (h.place('home.hut', x, z, 0)) placed++;
      x += 3; if (x > 13) { x = 3; z += 3; }
    }
  });
  await sleep(page, 1500);
  const residents = await page.evaluate(() => (window as any).__poplands.residents().length);
  check('homes welcome a few neighbours', residents >= 1, `residents=${residents}`);
  const dayHidden = await page.evaluate(() => (window as any).__poplands.hiddenCount());
  check('by day, nobody is tucked in', dayHidden === 0, `hidden=${dayHidden}`);

  // ── night falls → neighbours walk home and tuck in (natural path via the real seam) ──
  // poll rather than a fixed sleep: headless fps varies wildly (3–15), and homing is
  // gated on sim-seconds not wall-clock, so give it real elapsed time to accrue.
  await page.evaluate(() => (window as any).__poplands.setTime('night'));
  let nightHidden = 0;
  for (let i = 0; i < 40 && nightHidden < 1; i++) {
    await sleep(page, 700);
    nightHidden = await page.evaluate(() => (window as any).__poplands.hiddenCount());
  }
  check('at night, neighbours head home and tuck in', nightHidden >= 1, `hidden=${nightHidden}/${residents}`);
  await page.keyboard.press('Home');
  await sleep(page, 800);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // forced retire is deterministic — everyone in
  const allIn = await page.evaluate(() => {
    const h = (window as any).__poplands;
    const n = h.retireAll();
    return { n, hidden: h.hiddenCount() };
  });
  check('every neighbour can tuck in (all hidden)', allIn.hidden === allIn.n && allIn.n >= 1, JSON.stringify(allIn));

  // ── morning → they wake up and get moving ──
  await page.evaluate(() => (window as any).__poplands.setTime('day'));
  await sleep(page, 2500);
  const woke = await page.evaluate(() => (window as any).__poplands.hiddenCount());
  check('by morning, everyone is up again', woke === 0, `hidden=${woke}`);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── day/night routines verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
