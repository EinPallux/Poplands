/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Furniture interactions verify (post-1.0): build a home so neighbours move in, place a
 * bench + a campfire, then confirm a neighbour sits on the bench (held pose + the avatar
 * lifted ONTO the seat while staying on walkable ground), stands up cleanly, and gathers
 * at the fire (no lift). A "neighbour on a bench" beauty shot. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-furniture.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'furniture-sit.png');
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

  // build a home (neighbours move in) + a bench + a campfire, all via the live path
  const setup = await pl(page, () => {
    const h = (window as any).__poplands;
    const home = h.place('home.house', 9, 9, 0); // capacity 2 → two residents
    // find clear cells for a bench (2×1) + a campfire (1×1)
    let bench = false, bx = 3, bz = 3;
    for (let i = 0; i < 30 && !bench; i++) { if (h.place('decor.bench', bx, bz, 0)) bench = true; else { bx += 3; if (bx > 12) { bx = 3; bz += 3; } } }
    let fire = false, fx = 13, fz = 13;
    for (let i = 0; i < 30 && !fire; i++) { if (h.place('decor.campfire', fx, fz, 0)) fire = true; else { fx -= 3; if (fx < 4) { fx = 13; fz -= 3; } } }
    return {
      home, bench, fire,
      benchId: h.placementsOf('decor.bench')[0] ?? null,
      fireId: h.placementsOf('decor.campfire')[0] ?? null,
    };
  });
  await sleep(page, 800);
  const islanders = await pl(page, () => (window as any).__poplands.islanders().length);
  check('a home welcomes neighbours', setup.home === true && islanders >= 1, `residents=${islanders}`);
  check('bench + campfire placed', setup.bench && setup.fire && !!setup.benchId && !!setup.fireId, `bench=${setup.benchId} fire=${setup.fireId}`);

  await page.keyboard.press('Home'); // frame the island so the bench is on-screen
  await sleep(page, 1200);

  // ── a neighbour sits on the bench (held sit pose + lifted onto the seat) ──
  const seated = await pl(page, () => (window as any).__poplands.sitNow((window as any).__poplands.placementsOf('decor.bench')[0]));
  await sleep(page, 600); // let the renderer apply the pose + lift
  check('a neighbour perches on the bench', !!seated && seated.kind === 'sit', JSON.stringify(seated));

  const sitState = await pl(page, () => {
    const h = (window as any).__poplands;
    const u = h.islanderUsage().find((x: any) => x.kind === 'sit');
    return { usage: u ?? null, meshY: u ? h.agentMeshY(u.id) : null };
  });
  check('sit usage reports lift onto the seat', !!sitState.usage && sitState.usage.using === true && sitState.usage.lift > 0,
    JSON.stringify(sitState.usage));
  const sitY = sitState.meshY as number;

  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── stand up: the mesh drops back down + the pose is released ──
  await page.evaluate((id: string) => (window as any).__poplands.endUse(id), seated.id);
  await sleep(page, 500);
  const standY = await page.evaluate((id: string) => (window as any).__poplands.agentMeshY(id), seated.id) as number;
  const stillSitting = await page.evaluate((id: string) => (window as any).__poplands.islanderUsage().some((x: any) => x.id === id), seated.id) as boolean;
  check('the seat lifts the avatar (sits higher than it stands)', typeof sitY === 'number' && typeof standY === 'number' && sitY - standY > 0.15,
    `sitY=${sitY?.toFixed?.(2)} standY=${standY?.toFixed?.(2)}`);
  check('standing up releases the neighbour from the bench', stillSitting === false, `stillSitting=${stillSitting}`);

  // ── gather at the campfire: stands near it, no seat lift ──
  const gathered = await pl(page, () => (window as any).__poplands.sitNow((window as any).__poplands.placementsOf('decor.campfire')[0]));
  await sleep(page, 400);
  const gState = await pl(page, () => (window as any).__poplands.islanderUsage().find((x: any) => x.kind === 'gather') ?? null);
  check('a neighbour gathers at the campfire (no seat lift)', !!gathered && gathered.kind === 'gather' && !!gState && gState.lift === 0,
    JSON.stringify(gState));

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── furniture verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
