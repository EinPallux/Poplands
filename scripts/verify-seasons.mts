/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Seasons verify (post-1.0): set each season, confirm it resolves + re-tints the
 * light, and capture a beauty shot per season (the falling ambient + tint are the
 * real payoff, so the four screenshots ARE the verification).
 *
 *   npm run build && npx tsx scripts/verify-seasons.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'shots');
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

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

async function main(): Promise<void> {
  await mkdir(SHOTS, { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9500);

  // pin daytime + hide debug HUD, and back off so the island + falling ambient read
  await pl(page, () => (window as any).__poplands.setTime('day'));
  await page.keyboard.press('Backquote');
  await page.keyboard.press('Home');
  await page.waitForTimeout(1400);
  await page.mouse.move(800, 450);
  for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(120); }

  const sun: Record<string, string> = {};
  // set + assert + shoot each season
  for (const s of SEASONS) {
    await page.evaluate((season: string) => (window as any).__poplands.setSeason(season), s);
    await page.waitForTimeout(1200); // let the ambient re-colour + the tint settle
    const got = await pl(page, () => (window as any).__poplands.season());
    sun[s] = await pl(page, () => (window as any).__poplands.sunColor());
    check(`season ${s} resolves`, got === s, `got=${got}`);
    const out = path.join(SHOTS, `season-${s}.png`);
    await page.screenshot({ path: out });
    console.log('✓ shot →', out);
  }

  // the seasonal light tint must actually differ (warm autumn vs cool winter, etc.)
  check('autumn and winter tint the light differently', sun['autumn'] !== sun['winter'], `${sun['autumn']} vs ${sun['winter']}`);
  check('summer and winter tint the light differently', sun['summer'] !== sun['winter'], `${sun['summer']} vs ${sun['winter']}`);
  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── seasons verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
