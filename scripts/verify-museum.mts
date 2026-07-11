/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Collections Hall verify (post-1.0): place a Hall + a Pond, catch a fish, tap the
 * Hall to open the museum (BuildSession routing), donate the caught species from the
 * panel, and confirm it lands on display, credits the wallet, and can't be re-donated
 * — with a hall beauty shot. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-museum.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'museum-hall.png');
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

  // the Hall + Pond models ride the 'early' wave — pull it in first
  await pl(page, async () => { await (window as any).__poplands.loadPhase('early'); });
  await sleep(page, 1200);

  // place a Collections Hall (3×3) + a Fishing Pond in clear spots, read ids back
  const info = await pl(page, () => {
    const h = (window as any).__poplands;
    const hall = { placed: false, wx: 2, wz: 3 };
    for (let i = 0; i < 40 && !hall.placed; i++) {
      if (h.placeSilent('decor.museum', hall.wx, hall.wz, 0)) hall.placed = true;
      else { hall.wx += 4; if (hall.wx > 14) { hall.wx = 2; hall.wz += 4; } }
    }
    const pond = { placed: false, wx: 4, wz: 3 };
    for (let i = 0; i < 40 && !pond.placed; i++) {
      if (h.placeSilent('nature.fishing-pond', pond.wx, pond.wz, 0)) pond.placed = true;
      else { pond.wx += 4; if (pond.wx > 14) { pond.wx = 4; pond.wz += 4; } }
    }
    return {
      hall, pond,
      hallId: h.placementsOf('decor.museum')[0] ?? null,
      pondId: h.placementsOf('nature.fishing-pond')[0] ?? null,
      hallLoaded: h.modelLoaded('decor.museum'),
    };
  });
  await sleep(page, 500);
  check('Collections Hall model loads (early wave)', info.hallLoaded === true, `loaded=${info.hallLoaded}`);
  check('Hall + Pond place on the island', info.hall.placed && info.pond.placed && !!info.hallId && !!info.pondId,
    `hall=${info.hallId} pond=${info.pondId}`);

  await page.keyboard.press('Home'); // frame the island
  await sleep(page, 1300);

  // ── catch a fish at the pond (cast → skip wait → nibble → reel) ──
  await pl(page, () => (window as any).__poplands.fishCast((window as any).__poplands.placementsOf('nature.fishing-pond')[0]));
  await pollPhase(page, 'waiting', 12, 200);
  await pl(page, () => (window as any).__poplands.fishSkipWait());
  const nibble = await pollPhase(page, 'nibbling', 30, 200);
  check('a fish nibbles at the pond', nibble === 'nibbling', `phase=${nibble}`);
  await pl(page, () => (window as any).__poplands.fishCast((window as any).__poplands.placementsOf('nature.fishing-pond')[0])); // reel it in
  await sleep(page, 400);
  const caught = await pl(page, () => {
    const c = (window as any).__poplands.fishCollection();
    return { total: c.total, species: Object.keys(c.caught) };
  });
  check('a fish is caught (collection +1)', caught.total >= 1 && caught.species.length >= 1, JSON.stringify(caught));
  const caughtSpecies = caught.species[0];

  // ── tap the Hall → the museum panel opens (BuildSession routing → cmd:openMuseum) ──
  await page.evaluate((c: { wx: number; wz: number }) => (window as any).__poplands.clickCell(c.wx, c.wz), { wx: info.hall.wx, wz: info.hall.wz });
  await sleep(page, 500);
  const opened = await pl(page, () => {
    const bd = document.querySelector('.museum-backdrop') as HTMLElement | null;
    return { open: !!bd && bd.style.display !== 'none', rows: document.querySelectorAll('.museum-list .mu').length };
  });
  check('tapping the Hall opens the museum panel', opened.open === true && opened.rows >= 1, JSON.stringify(opened));

  // the caught species shows a Donate button; everything else is on-display/locked
  const donatable = await page.evaluate((sp: string) =>
    !!document.querySelector(`.mu-donate[data-species="${sp}"]`), caughtSpecies) as boolean;
  check('caught species offers a Donate button', donatable === true, `species=${caughtSpecies}`);

  // ── donate it by clicking the panel button (cmd:donate → sim → re-render) ──
  const before = await pl(page, () => ({
    pops: (window as any).__poplands.wallet().pops,
    donated: (window as any).__poplands.museumView().donatedCount,
  }));
  await page.evaluate((sp: string) => {
    (document.querySelector(`.mu-donate[data-species="${sp}"]`) as HTMLButtonElement | null)?.click();
  }, caughtSpecies);
  await sleep(page, 400);
  const after = await pl(page, () => ({
    pops: (window as any).__poplands.wallet().pops,
    view: (window as any).__poplands.museumView(),
    onDisplay: document.querySelectorAll('.mu.display').length,
  }));
  check('donation puts the fish on display (+1)', after.view.donatedCount === before.donated + 1,
    `${before.donated} → ${after.view.donatedCount}`);
  check('donation credits the wallet (Pops up)', after.pops > before.pops, `${before.pops} → ${after.pops}`);
  check('the donated species now renders as on-display', after.onDisplay >= 1, `display rows=${after.onDisplay}`);

  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── it can't be re-donated (one-time) ──
  const cannotRedonate = await page.evaluate((sp: string) => {
    const h = (window as any).__poplands;
    const stateOf = h.museumView().fish.find((f: any) => f.id === sp)?.state;
    const btnGone = !document.querySelector(`.mu-donate[data-species="${sp}"]`);
    return { stateOf, btnGone };
  }, caughtSpecies) as { stateOf: string; btnGone: boolean };
  check('donated species is display-locked (no re-donate)', cannotRedonate.stateOf === 'display' && cannotRedonate.btnGone === true,
    JSON.stringify(cannotRedonate));

  // ── Escape closes the panel ──
  await page.keyboard.press('Escape');
  await sleep(page, 300);
  const closed = await pl(page, () => {
    const bd = document.querySelector('.museum-backdrop') as HTMLElement | null;
    return !bd || bd.style.display === 'none';
  });
  check('Escape closes the Collections Hall', closed === true, '');

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── museum verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
