/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Stamp Book verify (post-1.0): open the achievements wall (some starter stamps already
 * earned, the rest locked silhouettes), confirm a not-yet-earned stamp ("Gone Fishing")
 * is locked, then catch a fish and watch the stamp latch — earned count +1 and a
 * celebratory toast pops. A stamp-wall beauty shot. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-achievements.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'stamp-book.png');
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

async function pollPhase(page: Page, want: string, tries: number, gap: number): Promise<string> {
  let phase = '';
  for (let i = 0; i < tries; i++) {
    phase = await pl(page, () => (window as any).__poplands.fishPhase());
    if (phase === want) break;
    await sleep(page, gap);
  }
  return phase;
}

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

  // ── open the Stamp Book (K): a grid renders, some starter stamps already earned ──
  await page.keyboard.press('KeyK');
  await sleep(page, 400);
  const opened = await pl(page, () => {
    const panel = document.querySelector('.stamps-panel') as HTMLElement | null;
    return {
      open: !!panel && panel.style.display !== 'none',
      cells: document.querySelectorAll('.stamps-grid .stamp').length,
      locked: document.querySelectorAll('.stamp.locked').length,
      earnedCells: document.querySelectorAll('.stamp.earned').length,
    };
  });
  check('the Stamp Book opens with a stamp grid', opened.open === true && opened.cells >= 20, JSON.stringify(opened));
  check('starter stamps show earned + locked side by side', opened.earnedCells >= 1 && opened.locked >= 1,
    `earned=${opened.earnedCells} locked=${opened.locked}`);

  const before = await pl(page, () => {
    const v = (window as any).__poplands.achievementsView();
    return { earned: v.earned, fishStamp: v.list.find((x: any) => x.id === 'first-fish')?.earned };
  });
  check('the "Gone Fishing" stamp starts locked', before.fishStamp === false, `earned=${before.fishStamp}`);

  // ── catch a fish → the stamp should latch + a toast pops ──
  await pl(page, async () => { await (window as any).__poplands.loadPhase('early'); });
  await sleep(page, 900);
  const pond = await pl(page, () => {
    const h = (window as any).__poplands;
    let x = 3, z = 3, placed = false;
    for (let i = 0; i < 30 && !placed; i++) { if (h.placeSilent('nature.fishing-pond', x, z, 0)) placed = true; else { x += 3; if (x > 12) { x = 3; z += 3; } } }
    return { placed, id: h.placementsOf('nature.fishing-pond')[0] ?? null };
  });
  check('a fishing pond is placed', pond.placed === true && !!pond.id, `id=${pond.id}`);

  await pl(page, () => (window as any).__poplands.fishCast((window as any).__poplands.placementsOf('nature.fishing-pond')[0]));
  await pollPhase(page, 'waiting', 12, 200);
  await pl(page, () => (window as any).__poplands.fishSkipWait());
  const nibble = await pollPhase(page, 'nibbling', 30, 200);
  check('a fish nibbles', nibble === 'nibbling', `phase=${nibble}`);
  await pl(page, () => (window as any).__poplands.fishCast((window as any).__poplands.placementsOf('nature.fishing-pond')[0])); // reel in
  await sleep(page, 600);

  const after = await pl(page, () => {
    const v = (window as any).__poplands.achievementsView();
    return {
      earned: v.earned,
      fishStamp: v.list.find((x: any) => x.id === 'first-fish')?.earned,
      toast: !!document.querySelector('.stamp-toast'),
    };
  });
  check('catching a fish earns the "Gone Fishing" stamp', after.fishStamp === true, `earned=${after.fishStamp}`);
  check('the earned count goes up', after.earned === before.earned + 1, `${before.earned} → ${after.earned}`);
  check('a "Stamp earned!" toast pops', after.toast === true, '');

  await page.keyboard.press('KeyK'); // re-open freshly so the grid shows the new stamp
  await sleep(page, 200);
  await page.keyboard.press('KeyK');
  await sleep(page, 300);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── achievements verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
