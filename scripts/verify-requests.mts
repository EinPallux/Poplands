/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Islander requests verify (post-1.0): a neighbour leaves a wish (a 💭 thought bubble
 * floats over them); placing a matching thing nearby grants it — reward + happy wave +
 * "Wish granted!" toast, and the bubble pops away. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-requests.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'requests-wish.png');
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

  // place homes so a couple of neighbours move in (wishes need residents)
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    let x = 3, z = 3, placed = 0;
    for (let i = 0; i < 60 && placed < 3; i++) {
      if (h.place('home.hut', x, z, 0)) placed++;
      x += 3; if (x > 13) { x = 3; z += 3; }
    }
  });
  await sleep(page, 1500); // let the move-in walk-ins spawn
  const residents = await page.evaluate(() => (window as any).__poplands.residents().length);
  check('placing homes welcomes neighbours', residents >= 1, `residents=${residents}`);

  // force a nature wish onto a present neighbour
  const wish = await page.evaluate(() => {
    const h = (window as any).__poplands;
    const agent = h.islanders()[0];
    const w = h.newWish(agent?.id, 'nature');
    return { agentId: agent?.id ?? null, x: agent?.x ?? 0, z: agent?.z ?? 0, wish: w };
  });
  check('a neighbour leaves a wish', wish.wish !== null && wish.wish.category === 'nature', JSON.stringify(wish.wish));
  await sleep(page, 500);
  const bubble = await page.evaluate(() => document.querySelectorAll('.wish-bubble').length);
  check('a 💭 wish bubble floats over the neighbour', bubble >= 1, `bubbles=${bubble}`);
  await page.keyboard.press('Home');
  await sleep(page, 900);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // grant it: place a tree near the wisher → reward + wish clears
  const grant = await page.evaluate(() => {
    const h = (window as any).__poplands;
    const before = h.wallet().pops;
    const a = h.islanders().find((x: any) => x.id === h.wishes()[0]?.id) ?? h.islanders()[0];
    // try the wisher's cell + a ring around it until a tree lands within reach
    let placed = false;
    const bx = Math.floor(a.x), bz = Math.floor(a.z);
    const ring: Array<[number, number]> = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]];
    for (const [dx, dz] of ring) {
      if (h.place('nature.tree', bx + dx, bz + dz, 0)) { placed = true; break; }
    }
    return { before, placed };
  });
  check('a tree is placed near the wisher', grant.placed === true, '');
  await sleep(page, 600);
  const after = await page.evaluate(() => {
    const h = (window as any).__poplands;
    return { pops: h.wallet().pops, wishes: h.wishes().length };
  });
  check('granting the wish rewards Pops', after.pops > grant.before, `${grant.before} → ${after.pops}`);
  check('the wish clears after granting', after.wishes === 0, `wishes=${after.wishes}`);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── Islander requests verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
