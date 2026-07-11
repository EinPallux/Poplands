/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Fishing verify (post-1.0): place a pond, click it to cast (routing), wait for the
 * nibble, reel it in, and confirm the catch lands + latches the journal — no errors,
 * with a fish-reveal beauty shot.
 *
 *   npm run build && npx tsx scripts/verify-fishing.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'fishing-catch.png');
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

  // the pond model rides the 'early' wave — pull it in first
  await pl(page, async () => { await (window as any).__poplands.loadPhase('early'); });
  await sleep(page, 1200);

  // place a pond in a clear spot + read its id back
  const info = await pl(page, () => {
    const h = (window as any).__poplands;
    let x = 3, z = 3, placed = false;
    for (let i = 0; i < 30 && !placed; i++) {
      if (h.placeSilent('nature.fishing-pond', x, z, 0)) placed = true;
      else { x += 3; if (x > 12) { x = 3; z += 3; } }
    }
    const ids = h.placementsOf('nature.fishing-pond');
    return { placed, id: ids[0] ?? null, wx: x, wz: z, loaded: h.modelLoaded('nature.fishing-pond') };
  });
  await sleep(page, 500);
  check('pond model loads (early wave)', info.loaded === true, `loaded=${info.loaded}`);
  check('pond places on the island', info.placed === true && !!info.id, `id=${info.id}`);

  await page.keyboard.press('Home'); // frame the island so the pond is on-screen
  await sleep(page, 1300);

  // ── routing: a play-mode cell click on the pond starts a cast (BuildSession path) ──
  await page.evaluate((c: { wx: number; wz: number }) => (window as any).__poplands.clickCell(c.wx, c.wz), { wx: info.wx, wz: info.wz });
  const castPhase = await pollPhase(page, 'waiting', 12, 200);
  check('clicking the pond casts a line (BuildSession routing)', castPhase === 'waiting' || castPhase === 'nibbling', `phase=${castPhase}`);

  // ── nibble: collapse the (headless-slow) wait so the bite fires promptly ──
  await pl(page, () => (window as any).__poplands.fishSkipWait());
  const nibblePhase = await pollPhase(page, 'nibbling', 30, 200);
  check('a fish nibbles (waiting → nibbling)', nibblePhase === 'nibbling', `phase=${nibblePhase}`);
  const bobber = await pl(page, () => ({
    bob: !!document.querySelector('.fishing-bobber'),
    nib: !!document.querySelector('.fishing-bobber.nibbling'),
    prompt: (document.querySelector('.fishing-prompt') as HTMLElement | null)?.style.display !== 'none',
  }));
  check('bobber + nibble indicator show', bobber.bob === true && bobber.nib === true, JSON.stringify(bobber));

  // ── reel it in ──
  const before = await pl(page, () => (window as any).__poplands.fishCollection().total);
  await page.evaluate((id: string) => (window as any).__poplands.fishCast(id), info.id);
  await sleep(page, 400);
  const after = await pl(page, () => (window as any).__poplands.fishCollection());
  check('reeling lands a catch (collection +1)', after.total === before + 1, `${before} → ${after.total}`);
  check('a catch popup appears', await pl(page, () => !!document.querySelector('.fishing-catch')), '');
  check('a species is recorded', after.species >= 1, `species=${after.species}`);

  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── the journal opens + shows the catch (F key) ──
  await page.keyboard.press('KeyF');
  await sleep(page, 300);
  const journal = await pl(page, () => {
    const panel = document.querySelector('.journal-panel') as HTMLElement | null;
    return { open: !!panel && panel.style.display !== 'none', caught: document.querySelectorAll('.jf.caught').length };
  });
  check('Fish Journal opens + lists the catch', journal.open === true && journal.caught >= 1, JSON.stringify(journal));

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── fishing verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
