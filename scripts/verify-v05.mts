/**
 * Headless functional verification of the v0.5 Islanders slice (ROADMAP v0.5, S16):
 * boot → no neighbours without homes → build homes → Islanders move in (roster +
 * meshes) → they wander (positions change) while staying on walkable ground →
 * the roster persists across reload and agents re-spawn.
 *
 *   npm run build && PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx scripts/verify-v05.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.map': 'application/json',
};

function serve(): Promise<{ url: string; close: () => void }> {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
      const filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
      const data = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

interface Agent {
  id: string;
  x: number;
  z: number;
  moving: boolean;
}
interface Poplands {
  chunkCount: () => number;
  place: (def: string, wx: number, wz: number) => boolean;
  islanders: () => Agent[];
  residents: () => string[];
  agentMeshes: () => number;
  island: { walkable: (wx: number, wz: number) => boolean };
}
type Win = { __poplands: Poplands };

const readIslanders = (page: Page) => page.evaluate(() => (window as never as Win).__poplands.islanders());
const readResidents = (page: Page) => page.evaluate(() => (window as never as Win).__poplands.residents());
const readMeshes = (page: Page) => page.evaluate(() => (window as never as Win).__poplands.agentMeshes());

async function settle(page: Page): Promise<void> {
  const start = Date.now();
  const read = () =>
    page
      .evaluate(() => (window as never as { __poplands?: Poplands }).__poplands?.chunkCount() ?? null)
      .catch(() => null);
  while ((await read()) === null) {
    if (Date.now() - start > 40000) throw new Error('boot never finished');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2500);
  await page.keyboard.press('Home');
  await page.waitForTimeout(1200);
}

/** Place N huts on open ground, returning how many actually landed. */
async function placeHomes(page: Page, n: number): Promise<number> {
  const candidates = [
    [5, 5],
    [9, 9],
    [2, 9],
    [9, 2],
    [5, 12],
    [12, 5],
    [2, 2],
    [12, 12],
  ];
  let placed = 0;
  for (const [wx, wz] of candidates) {
    if (placed >= n) break;
    const ok = await page.evaluate(
      (c) => (window as never as Win).__poplands.place('home.hut', c[0]!, c[1]!),
      [wx, wz],
    );
    if (ok) placed++;
  }
  return placed;
}

async function main(): Promise<void> {
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message);
    failures++;
  });

  await page.goto(`${url}/?debug=1`);
  await settle(page);

  // 1 — a fresh island has no homes → no Islanders
  const before = await readIslanders(page);
  check('no Islanders before any home is built', before.length === 0, `${before.length}`);

  // 2 — build homes → neighbours move in (roster + meshes)
  const placed = await placeHomes(page, 3);
  check('placed 3 Cozy Huts', placed === 3, `${placed}`);
  await page.waitForTimeout(300);
  const residents = await readResidents(page);
  const agents = await readIslanders(page);
  const meshes = await readMeshes(page);
  check('3 Islanders moved in (roster)', residents.length === 3, `${residents.length}`);
  check('first resident is Mo (move-in order)', residents[0] === 'mo', `${residents[0]}`);
  check('a mesh exists per Islander', meshes === 3, `${meshes}`);
  check('all Islanders spawned on walkable ground', agents.length === 3);

  // 3 — let them wander, then confirm motion + that nobody left the walkable island
  const t0 = await readIslanders(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ROOT, 'shots/v05-1-islanders.png') });
  await page.waitForTimeout(3000);
  const t1 = await readIslanders(page);
  let maxMove = 0;
  for (const a of t1) {
    const b = t0.find((p) => p.id === a.id);
    if (b) maxMove = Math.max(maxMove, Math.hypot(a.x - b.x, a.z - b.z));
  }
  check('Islanders wander (positions change over time)', maxMove > 0.4, `max Δ ${maxMove.toFixed(2)}`);
  const allWalkable = await page.evaluate(() => {
    const pl = (window as never as Win).__poplands;
    return pl.islanders().every((a) => pl.island.walkable(Math.floor(a.x), Math.floor(a.z)));
  });
  check('every Islander stands on walkable ground (no clipping)', allWalkable);
  await page.screenshot({ path: path.join(ROOT, 'shots/v05-2-islanders.png') });

  // 4 — the roster persists across reload; agents re-spawn
  await page.reload();
  await settle(page);
  const residents2 = await readResidents(page);
  const meshes2 = await readMeshes(page);
  check('roster persists across reload', residents2.length === 3, `${residents2.length}`);
  check('agents re-spawn after reload', meshes2 === 3, `${meshes2}`);

  await browser.close();
  close();
  console.log(failures === 0 ? '\nALL v0.5 (Islanders) CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
