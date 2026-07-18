/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Naming verify (post-1.0): the player can rename the island and any Islander/Pal.
 * The island name shows in the TopBar and STICKS across a reload; a resident's custom
 * name resolves via nameOf(), can be set inline through the Album chip UI, and also
 * survives a reload (Save v11). No page errors.
 *
 *   npm run build && npx tsx scripts/verify-naming.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'naming-album.png');
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
  // one persistent context so localStorage survives the reload
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(page, 9500);

  // the island starts with its default title in the TopBar
  const defaultName = await page.evaluate(() => ({
    api: (window as any).__poplands.islandName(),
    bar: document.querySelector('.tb-name')?.textContent ?? '',
  }));
  check('island opens with the default title', defaultName.api === 'Poplands' && defaultName.bar === 'Poplands', JSON.stringify(defaultName));

  // rename the island → the API + the TopBar both reflect the new name
  await page.evaluate(() => (window as any).__poplands.setIslandName('Cloudhaven'));
  await sleep(page, 300);
  const renamed = await page.evaluate(() => ({
    api: (window as any).__poplands.islandName(),
    bar: document.querySelector('.tb-name')?.textContent ?? '',
  }));
  check('renaming the island updates the API + the TopBar', renamed.api === 'Cloudhaven' && renamed.bar === 'Cloudhaven', JSON.stringify(renamed));

  // place a home → a neighbour moves in (houseCapacity drives the roster)
  await page.evaluate(() => (window as any).__poplands.place('home.hut', 5, 5, 0));
  // poll for the arrival (reconcile runs on item:placed, but give the sim a beat)
  let resident: string | null = null;
  for (let i = 0; i < 20 && !resident; i++) {
    resident = await page.evaluate(() => (window as any).__poplands.residents()[0] ?? null);
    if (!resident) await sleep(page, 300);
  }
  check('placing a home brings a neighbour in', resident !== null, `resident=${resident}`);

  // the neighbour resolves to their roster name until renamed
  const rosterName = await page.evaluate((id) => (window as any).__poplands.nameOf(id), resident);
  check('a fresh neighbour resolves to their roster name', typeof rosterName === 'string' && rosterName.length > 0, `name=${rosterName}`);

  // rename the neighbour via the debug setter → nameOf reflects it
  await page.evaluate((id) => (window as any).__poplands.setName(id, 'Buddy'), resident);
  await sleep(page, 200);
  const afterSet = await page.evaluate((id) => (window as any).__poplands.nameOf(id), resident);
  check('setName gives the neighbour a custom name', afterSet === 'Buddy', `name=${afterSet}`);

  // — the Album chip inline-rename UI — open, click the neighbour chip, type, Enter
  await page.keyboard.press('KeyJ');
  await sleep(page, 400);
  const chipId = await page.getAttribute('.album-chip[data-id]', 'data-id');
  check('the Album shows a renamable neighbour chip', !!chipId, `chipId=${chipId}`);
  await page.click('.album-chip[data-id]');
  await page.waitForSelector('.album-rename', { timeout: 3000 });
  await page.fill('.album-rename', 'Clementine');
  await page.keyboard.press('Enter');
  await sleep(page, 300);
  const afterInline = await page.evaluate((id) => ({
    name: (window as any).__poplands.nameOf(id),
    chip: document.querySelector(`.album-chip[data-id="${id}"]`)?.textContent?.trim() ?? '',
  }), chipId);
  check('the Album inline rename updates the name + the chip', afterInline.name === 'Clementine' && afterInline.chip.includes('Clementine'), JSON.stringify(afterInline));

  await page.keyboard.press('Home'); // reframe for a tidy shot
  await sleep(page, 500);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);
  await page.keyboard.press('KeyJ'); // close the Album

  // ── both names STICK across a reload (Save v11) ──
  await page.reload({ waitUntil: 'domcontentloaded' }); // pagehide flushes the save first
  await sleep(page, 9500);
  const afterReload = await page.evaluate((id) => ({
    island: (window as any).__poplands.islandName(),
    bar: document.querySelector('.tb-name')?.textContent ?? '',
    resident: (window as any).__poplands.nameOf(id),
  }), chipId);
  check('the island name persists across a reload', afterReload.island === 'Cloudhaven' && afterReload.bar === 'Cloudhaven', JSON.stringify(afterReload));
  check('the resident name persists across a reload', afterReload.resident === 'Clementine', `name=${afterReload.resident}`);

  // clearing the island name reverts to the default title (blank ⇒ no override)
  await page.evaluate(() => (window as any).__poplands.setIslandName('   '));
  await sleep(page, 200);
  const cleared = await page.evaluate(() => (window as any).__poplands.islandName());
  check('a blank island name reverts to the default', cleared === 'Poplands', `name=${cleared}`);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await context.close(); await browser.close(); close();
  console.log('\n── Naming verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
