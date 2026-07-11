/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * v0.7 Slice 2 verify: the 9 Tier 8–12 variety fillers place & render error-free
 * (incl. the themed ones once their lazy wave loads), + a coastal beauty shot.
 *
 *   npm run build && npx tsx scripts/verify-slice2.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'v07-slice2-coast.png');
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

const NEW = [
  'nature.cattails', 'decor.message-bottle', 'home.river-cottage', 'home.harbor-house',
  'home.harbor-villa', 'nature.coastal-rocks', 'decor.watchtower', 'home.beach-bungalow',
  'income.haunted-galleon',
];

async function main(): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(path.dirname(OUT), { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9500);

  // ensure the two themed items' waves are loaded (sandbar + spooky)
  await pl(page, async () => {
    const h = (window as any).__poplands;
    await h.loadPhase('early'); await h.loadPhase('themed:sandbar'); await h.loadPhase('themed:spooky');
  });
  await page.waitForTimeout(1500);

  // place all 9 across a cleared area
  const placed = await pl(page, () => {
    const h = (window as any).__poplands;
    const list = ['nature.cattails', 'decor.message-bottle', 'home.river-cottage', 'home.harbor-house',
      'home.harbor-villa', 'nature.coastal-rocks', 'decor.watchtower', 'home.beach-bungalow', 'income.haunted-galleon'];
    let ok = 0, x = 1, z = 1;
    for (const def of list) {
      let done = false;
      for (let tries = 0; tries < 40 && !done; tries++) {
        if (h.placeSilent(def, x, z, 0)) { ok++; done = true; }
        x += 4; if (x > 13) { x = 1; z += 4; }
      }
    }
    return ok;
  });
  await page.waitForTimeout(800);
  const loaded = await pl(page, () => {
    const h = (window as any).__poplands;
    const ids = ['nature.cattails', 'decor.message-bottle', 'home.river-cottage', 'home.harbor-house',
      'home.harbor-villa', 'nature.coastal-rocks', 'decor.watchtower', 'home.beach-bungalow', 'income.haunted-galleon'];
    return ids.filter((id) => h.modelLoaded(id)).length;
  });

  check('all 9 filler models load (incl. themed waves)', loaded === NEW.length, `${loaded}/${NEW.length}`);
  check('all 9 filler items place on the island', placed === NEW.length, `${placed}/${NEW.length}`);
  check('no page errors placing the fillers', errors.length === 0, errors.slice(0, 2).join(' | '));

  await page.keyboard.press('Backquote');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(500);
  await page.mouse.move(800, 450);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -150); await page.waitForTimeout(120); }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  await browser.close(); close();
  console.log('\n── Slice 2 verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
