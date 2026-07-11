/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Garden / Crop Patch verify (post-1.0): place a Garden Patch, tap it to open the seed
 * picker, plant a crop (a growth marker appears), fast-forward it to ripe, then harvest
 * for a reward — wallet up, plot cleared, tally +1, a harvest popup pops. Beauty shots
 * of the seed picker + a growing plot. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-garden.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'garden-grow.png');
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
  await sleep(page, 9500); // boot + camera intro

  // place a Garden Patch (its dirt-tile model rides the boot wave) + read its id
  const patch = await pl(page, () => {
    const h = (window as any).__poplands;
    let x = 3, z = 3, placed = false;
    for (let i = 0; i < 30 && !placed; i++) { if (h.place('nature.garden', x, z, 0)) placed = true; else { x += 3; if (x > 12) { x = 3; z += 3; } } }
    return { placed, id: h.placementsOf('nature.garden')[0] ?? null, wx: x, wz: z };
  });
  await sleep(page, 500);
  check('a Garden Patch is placed', patch.placed === true && !!patch.id, `id=${patch.id}`);

  await page.keyboard.press('Home'); // frame the island
  await sleep(page, 1200);

  // ── tap the empty patch → the seed picker opens ──
  await pl(page, () => (window as any).__poplands.openGarden((window as any).__poplands.placementsOf('nature.garden')[0]));
  await sleep(page, 500);
  const picker = await pl(page, () => {
    const bd = document.querySelector('.seed-backdrop') as HTMLElement | null;
    return { open: !!bd && bd.style.display !== 'none', cards: document.querySelectorAll('.seed-card').length, plantable: document.querySelectorAll('button.seed-card').length };
  });
  check('tapping an empty patch opens the seed picker', picker.open === true && picker.cards >= 5, JSON.stringify(picker));
  check('level-appropriate seeds are plantable', picker.plantable >= 1, `plantable=${picker.plantable}`);
  await page.screenshot({ path: path.join(ROOT, 'shots', 'garden-picker.png') });

  // ── plant carrots by clicking the seed card (cmd:plantCrop → sim plants) ──
  await pl(page, () => (document.querySelector('.seed-card[data-crop="crop.carrot"]') as HTMLButtonElement | null)?.click());
  await sleep(page, 600);
  const planted = await pl(page, () => {
    const h = (window as any).__poplands;
    return { stage: h.gardenStage(h.placementsOf('nature.garden')[0]), marker: !!document.querySelector('.garden-marker'), plots: h.gardenView().length };
  });
  check('planting starts a sprout on the plot', planted.stage === 'sprout' && planted.plots === 1, JSON.stringify(planted));
  check('a growth marker appears over the patch', planted.marker === true, '');
  await sleep(page, 400);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── fast-forward growth to ripe ──
  await pl(page, () => (window as any).__poplands.ripenGarden((window as any).__poplands.placementsOf('nature.garden')[0]));
  await sleep(page, 300);
  const ripe = await pl(page, () => {
    const h = (window as any).__poplands;
    return { stage: h.gardenStage(h.placementsOf('nature.garden')[0]), ripeMarker: !!document.querySelector('.garden-marker.ripe') };
  });
  check('the crop ripens', ripe.stage === 'ripe', `stage=${ripe.stage}`);
  check('the ripe marker shows (ready to harvest)', ripe.ripeMarker === true, '');

  // ── harvest (tap a ripe patch) → reward + cleared plot + tally + popup ──
  const before = await pl(page, () => ({ pops: (window as any).__poplands.wallet().pops, harvested: (window as any).__poplands.gardenHarvested() }));
  await pl(page, () => (window as any).__poplands.openGarden((window as any).__poplands.placementsOf('nature.garden')[0]));
  await sleep(page, 500);
  const after = await pl(page, () => {
    const h = (window as any).__poplands;
    return { stage: h.gardenStage(h.placementsOf('nature.garden')[0]), pops: h.wallet().pops, harvested: h.gardenHarvested(), popup: !!document.querySelector('.garden-harvest') };
  });
  check('harvesting clears the plot', after.stage === 'empty', `stage=${after.stage}`);
  check('harvesting credits the wallet (Pops up)', after.pops > before.pops, `${before.pops} → ${after.pops}`);
  check('the harvest tally goes up', after.harvested === before.harvested + 1, `${before.harvested} → ${after.harvested}`);
  check('a harvest popup pops', after.popup === true, '');

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── garden verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
