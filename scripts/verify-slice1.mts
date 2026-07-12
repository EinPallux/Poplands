/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Slice 1 verify (post-1.0 batch, user 2026-07-12): three cozy-QoL asks.
 *   #6 empty starter — a brand-new island boots as a FULLY blank canvas (0 placements,
 *      no windmill landmark), so the first thing a player does is build.
 *   #1 call chunks on ANY side — surveys() offers a priced slot on every frontier cell
 *      (all four cardinal sides), no longer a seeded subset of ≤3.
 *   #5 click the bubble — tapping a ripe income building's floating bubble collects it
 *      (not just the building mesh).
 *
 *   npm run build && npx tsx scripts/verify-slice1.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'slice1-empty-island.png');
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

  // ── #6 empty starter — a fresh island is a blank canvas ──
  const fresh = await pl(page, () => {
    const h = (window as any).__poplands;
    return { placements: h.placementSummary(), chunks: h.chunkCount() };
  });
  check('a brand-new island is fully empty (0 placements)', fresh.placements.length === 0, `n=${fresh.placements.length}: ${fresh.placements.slice(0, 3).join(', ')}`);
  check('the 4 starter chunks are present (nothing else)', fresh.chunks === 4, `chunks=${fresh.chunks}`);
  // no windmill "landmarks" group in the scene graph
  const noLandmark = await pl(page, () => {
    const h = (window as any).__poplands;
    let found = false;
    h.scene.traverse((o: any) => { if (o.name === 'landmarks') found = true; });
    return !found;
  });
  check('no pre-built windmill landmark in the scene', noLandmark === true, '');
  await page.keyboard.press('Home');
  await sleep(page, 1200);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── #1 call chunks on ANY side — surveys() covers all four frontiers ──
  const surv = await pl(page, () => (window as any).__poplands.surveys());
  const cxs = surv.map((s: any) => s.cx);
  const czs = surv.map((s: any) => s.cz);
  const spread = {
    n: surv.length,
    west: Math.min(...cxs) < 0,   // a slot west of the 0..1 block
    east: Math.max(...cxs) > 1,   // east
    north: Math.min(...czs) < 0,  // north
    south: Math.max(...czs) > 1,  // south
  };
  check('every frontier slot is offered (8 around the 2×2 starter)', spread.n === 8, `n=${spread.n}`);
  check('surveys reach ALL four sides (N/E/S/W)', spread.west && spread.east && spread.north && spread.south, JSON.stringify(spread));
  const priced = surv.every((s: any) => s.pops === 250 && s.stardust === 2);
  check('every offered slot carries the current chunk price', priced, `first=${JSON.stringify(surv[0])}`);
  // a survey chip renders for each frontier slot
  await sleep(page, 400);
  const chips = await pl(page, () => document.querySelectorAll('.survey-chip').length);
  check('a "call this chunk" chip renders on each frontier', chips === 8, `chips=${chips}`);

  // buying a slot on a side that used to be un-offered still works end-to-end
  const bought = await pl(page, () => {
    const h = (window as any).__poplands;
    const before = h.chunkCount();
    // pick a west slot (cx<0) to prove a formerly-unavailable side is buyable
    const west = h.surveys().find((s: any) => s.cx < 0);
    // fund the purchase (debug wallet not exposed; grant via repeated place? — use the
    // real flow: the fresh wallet has 150 Pops / 0 Stardust, so a 250/2 buy would be
    // denied. Instead assert the slot is *offered & priced*, which is the #1 ask.)
    return { west: west ?? null, before };
  });
  check('a west-side slot (previously unreachable) is now on offer', bought.west !== null, JSON.stringify(bought.west));

  // ── #5 click the ripe bubble to collect ──
  const setup = await pl(page, () => {
    const h = (window as any).__poplands;
    // place a market stall (income) somewhere free, ripen it fully
    let placed = false, x = 3, z = 3;
    for (let i = 0; i < 30 && !placed; i++) { if (h.place('income.stall', x, z, 0)) placed = true; else { x += 2; if (x > 12) { x = 3; z += 2; } } }
    const id = h.placementsOf('income.stall')[0] ?? null;
    if (id) h.ripen(id, 1);
    return { placed, id };
  });
  check('an income building is placed & ripened', setup.placed && !!setup.id, `id=${setup.id}`);
  await sleep(page, 500); // let WorldFx.update build the .ripe-bubble DOM
  const bubble = await pl(page, () => {
    const el = document.querySelector('.ripe-bubble.ripe') as HTMLElement | null;
    return { exists: !!el, pe: el ? getComputedStyle(el).pointerEvents : 'none' };
  });
  check('a ripe bubble is showing over the building', bubble.exists === true, '');
  check('the bubble is clickable (pointer-events:auto)', bubble.pe === 'auto', `pe=${bubble.pe}`);

  const collect = await pl(page, () => {
    const h = (window as any).__poplands;
    const before = h.wallet().pops;
    const el = document.querySelector('.ripe-bubble.ripe') as HTMLElement | null;
    el?.click();
    return { before };
  });
  await sleep(page, 500);
  const afterPops = await pl(page, () => (window as any).__poplands.wallet().pops);
  check('clicking the bubble collects the income (Pops up)', afterPops > collect.before, `${collect.before} → ${afterPops}`);
  const gone = await pl(page, () => document.querySelectorAll('.ripe-bubble.ripe').length);
  check('the bubble empties after collecting', gone === 0, `ripe bubbles=${gone}`);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── slice 1 verify (empty start · all-sides chunks · click-to-collect) ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
