/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Multiple save slots verify (post-1.0): keep several independent local islands.
 * Name + build island A in slot 1, switch to slot 2 (a fresh island), build island
 * B, switch back to slot 1 and find A intact — then delete slot 2. The slots picker
 * lists them. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-slots.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'save-slots.png');
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

// switch slot via the debug hook (which reloads); wait for the re-boot to land on `slot`
async function switchTo(page: Page, slot: string): Promise<void> {
  await page.evaluate((s) => (window as any).__poplands.switchSlot(s), slot).catch(() => {});
  await page.waitForFunction(
    (s) => { const h = (window as any).__poplands; return !!h && typeof h.activeSlot === 'function' && h.activeSlot() === s; },
    slot, { timeout: 40000, polling: 500 },
  );
  await sleep(page, 500);
}

async function main(): Promise<void> {
  await mkdir(path.dirname(OUT), { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const errors: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(page, 9500);

  // — slot 1: island "Alpha" with a tree
  const slot0 = await page.evaluate(() => (window as any).__poplands.activeSlot());
  check('a new game starts on slot 1', slot0 === '1', `slot=${slot0}`);
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    h.setIslandName('Alpha');
    h.place('nature.tree', 4, 4, 0);
  });
  await sleep(page, 300);

  // — switch to slot 2: a brand-new, empty island
  await switchTo(page, '2');
  const fresh = await page.evaluate(() => {
    const h = (window as any).__poplands;
    return { name: h.islandName(), trees: h.placementsOf('nature.tree').length, slot: h.activeSlot() };
  });
  check('switching to an empty slot starts a fresh island', fresh.slot === '2' && fresh.name === 'Poplands' && fresh.trees === 0, JSON.stringify(fresh));

  // build island "Beta" here
  await page.evaluate(() => {
    const h = (window as any).__poplands;
    h.setIslandName('Beta');
    h.place('nature.bush', 5, 5, 0);
  });
  await sleep(page, 300);

  // — switch back to slot 1: island "Alpha" is intact
  await switchTo(page, '1');
  const back = await page.evaluate(() => {
    const h = (window as any).__poplands;
    return { name: h.islandName(), trees: h.placementsOf('nature.tree').length, slot: h.activeSlot() };
  });
  check('switching back restores the first island untouched', back.slot === '1' && back.name === 'Alpha' && back.trees === 1, JSON.stringify(back));

  // both islands show in the slot list, each with its own name
  const slots = await page.evaluate(() => (window as any).__poplands.slots());
  const s1 = slots.find((s: any) => s.id === '1');
  const s2 = slots.find((s: any) => s.id === '2');
  check('the slot list shows both islands with their names', s1?.name === 'Alpha' && s1?.active === true && s2?.name === 'Beta' && s2?.exists === true, JSON.stringify([s1, s2]));

  // the Settings "My Islands" picker renders a row per slot
  await page.click('.settings-gear');
  await sleep(page, 400);
  const ui = await page.evaluate(() => ({
    rows: document.querySelectorAll('.slot-row').length,
    current: document.querySelectorAll('.slot-current').length,
    dels: document.querySelectorAll('.slot-del').length,
  }));
  check('the "My Islands" picker lists every slot', ui.rows === 5 && ui.current === 1 && ui.dels >= 1, JSON.stringify(ui));
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // delete slot 2 (not active) → it's forgotten
  await page.evaluate(() => (window as any).__poplands.deleteSlot('2'));
  await sleep(page, 200);
  const afterDel = await page.evaluate(() => (window as any).__poplands.slots().find((s: any) => s.id === '2'));
  check('deleting a non-active slot forgets that island', afterDel?.exists === false, JSON.stringify(afterDel));

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await context.close(); await browser.close(); close();
  console.log('\n── Multiple save slots verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
