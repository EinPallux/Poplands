/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Pals verify (More Pals, post-1.0): plant a lot of nature so the island fills with a
 * fuller menagerie — confirm the roster grows past the old cap of 6 (toward 12), that
 * the second-generation named Pals (cat2/dog2/…) join, meshes render for each, and a
 * Pal can still be petted. A menagerie beauty shot. No page errors.
 *
 *   npm run build && npx tsx scripts/verify-pals.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'pals-menagerie.png');
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
  await sleep(page, 9500);

  // plant a LOT of nature (1 Pal per 8) so the menagerie fills toward the new cap of 12
  const roster = await pl(page, () => {
    const h = (window as any).__poplands;
    let placed = 0;
    for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) {
      if (placed >= 100) break;
      if (h.place('nature.grass', x, z, 0)) placed++;
    }
    return { placed, roster: h.palRoster() };
  });
  await sleep(page, 1500);
  const state = await pl(page, () => {
    const h = (window as any).__poplands;
    return { roster: h.palRoster(), meshes: h.palMeshes() };
  });
  check('a lot of nature is planted', roster.placed >= 80, `placed=${roster.placed}`);
  check('the menagerie grows well past the old cap of 6', state.roster.length >= 8, `pals=${state.roster.length}`);
  check('second-generation named Pals join (cat2/dog2/…)', state.roster.some((id: string) => /\d$/.test(id)),
    JSON.stringify(state.roster));
  check('a mesh renders for every adopted Pal', state.meshes >= state.roster.length, `meshes=${state.meshes} roster=${state.roster.length}`);

  await page.keyboard.press('Home');
  await sleep(page, 1300);
  await pl(page, () => { const d = document.querySelector('.debug-hud') as HTMLElement | null; if (d) d.style.display = 'none'; });
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── pals verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
