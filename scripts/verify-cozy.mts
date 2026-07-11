/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Cozy-batch verify: the camera un-mirror, the prominent income bubbles, and the
 * weather (rain curtain + rainbow). Boots the built app, drives the debug handle,
 * asserts behaviour, and drops a rain+rainbow beauty shot.
 *
 *   npm run build && npx tsx scripts/verify-cozy.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'cozy-weather.png');
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
const pl = (page: Page, e: (h: any) => unknown) => page.evaluate(e as any, undefined) as Promise<any>;
const checks: Array<{ n: string; ok: boolean; d?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => checks.push({ n, ok, ...(d !== undefined ? { d } : {}) });

async function main(): Promise<void> {
  await mkdir(path.dirname(OUT), { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9500); // boot + camera intro finishes (orbit is locked during intro)

  // pin daytime so the rainbow is allowed to show, and load the boot/early waves
  await pl(page, async () => {
    const h = (window as any).__poplands;
    h.setTime('day');
    await h.loadPhase('early');
  });
  await page.waitForTimeout(600);

  // ── 1. Camera un-mirror: a right-drag UP must tilt toward the horizon (polar ↑) ──
  await page.keyboard.press('Home'); // reset to a known default angle
  await page.waitForTimeout(1500); // let the damped orbit settle before measuring
  const polarBefore = await pl(page, () => (window as any).__poplands.camPolar());
  await page.mouse.move(800, 620);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(800, 300, { steps: 12 }); // a firm drag upward
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(1000); // let the damped orbit settle toward the new goal
  const polarAfter = await pl(page, () => (window as any).__poplands.camPolar());
  check('right-drag up increases polar (un-mirrored vertical orbit)', polarAfter > polarBefore + 0.05,
    `polar ${polarBefore.toFixed(3)} → ${polarAfter.toFixed(3)}`);

  // ── 2. Prominent income bubbles: full building → readable "● amount" pill; a
  //       barely-filled one stays a quiet dot (threshold gate keeps the map calm) ──
  const placed = await pl(page, () => {
    const h = (window as any).__poplands;
    let ok = 0;
    let x = 1, z = 1;
    for (let tries = 0; tries < 60 && ok < 2; tries++) {
      if (h.placeSilent('income.stall', x, z, 0)) ok++;
      x += 3; if (x > 13) { x = 1; z += 3; }
    }
    return ok;
  });
  await page.waitForTimeout(200);
  const bubbleState = await pl(page, () => {
    const h = (window as any).__poplands;
    const ids = h.placementsOf('income.stall');
    h.ripen(ids[0], 1); // full → prominent
    h.ripen(ids[1], 0.1); // barely filled → dot only
    return ids.length;
  });
  await page.waitForTimeout(400); // WorldFx derives bubbles from economy each frame
  const bubbles = await pl(page, () => {
    const all = document.querySelectorAll('.ripe-bubble');
    const prom = document.querySelectorAll('.ripe-bubble.prominent');
    const amtEl = prom[0]?.querySelector('.rb-amt');
    return {
      total: all.length,
      prominent: prom.length,
      amtText: amtEl?.textContent ?? '',
    };
  });
  check('two stalls placed', placed === 2 && bubbleState === 2, `${placed} placed / ${bubbleState} ids`);
  check('exactly one prominent bubble (threshold-gated)', bubbles.prominent === 1, `prominent=${bubbles.prominent} of ${bubbles.total}`);
  check('prominent pill shows the readable amount', /●\s*\d+/.test(bubbles.amtText), `text="${bubbles.amtText}"`);
  check('both stalls have a bubble (dot for the low one)', bubbles.total === 2, `total=${bubbles.total}`);

  // ── 3. Weather: force a shower + rainbow, confirm both draw ──
  const weather = await pl(page, () => {
    const h = (window as any).__poplands;
    h.weatherShower();
    h.weatherRainbow();
    return true;
  });
  await page.waitForTimeout(1200); // rain eases in
  const wx = await pl(page, () => (window as any).__poplands.weather());
  check('weather forced', weather === true);
  check('rain curtain is drawing', wx.raining === true, JSON.stringify(wx));
  check('rainbow arch is drawing', wx.rainbow === true, JSON.stringify(wx));

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  // beauty shot — frame the island, back off a touch so the arch is in view
  await page.keyboard.press('Backquote'); // hide debug HUD
  await page.mouse.move(800, 450);
  for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(120); }
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  await browser.close(); close();
  console.log('\n── cozy verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
