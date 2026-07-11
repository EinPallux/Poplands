/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Daily-gift verify (post-1.0): a fresh save has a present ready; claiming credits
 * the day-1 reward, advances the cycle, and can't be double-claimed the same day.
 *
 *   npm run build && npx tsx scripts/verify-dailygift.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'daily-gift.png');
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

async function main(): Promise<void> {
  await mkdir(path.dirname(OUT), { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9500); // boot; a fresh save → the first gift is ready

  // ── a present is ready on a fresh save ──
  const ready = await pl(page, () => {
    const btn = document.querySelector('.gift-btn.ready') as HTMLElement | null;
    const prev = (window as any).__poplands.giftPreview();
    return { visible: !!btn && btn.style.display !== 'none', day: prev.day, pops: prev.pops, claimable: prev.claimable };
  });
  check('a present is ready on a fresh save', ready.visible === true && ready.claimable === true, JSON.stringify(ready));
  check('the first gift is day 1', ready.day === 1, `day=${ready.day}`);

  const before = await pl(page, () => (window as any).__poplands.wallet().pops);

  // ── claim it ──
  await pl(page, () => (window as any).__poplands.claimGift());
  await page.waitForTimeout(400);
  const after = await pl(page, () => ({
    pops: (window as any).__poplands.wallet().pops,
    prev: (window as any).__poplands.giftPreview(),
    popup: !!document.querySelector('.gift-popup'),
  }));
  check('claiming credits the day-1 reward', after.pops === before + ready.pops, `${before} + ${ready.pops} → ${after.pops}`);
  check('the celebration popup appears', after.popup === true, '');
  check('the cycle advances to day 2', after.prev.day === 2, `day=${after.prev.day}`);
  check('the gift is no longer claimable today', after.prev.claimable === false, `claimable=${after.prev.claimable}`);

  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── a second claim the same day is a no-op (no double-dip) ──
  await pl(page, () => (window as any).__poplands.claimGift());
  await page.waitForTimeout(200);
  const twice = await pl(page, () => (window as any).__poplands.wallet().pops);
  check('a second claim the same day does nothing', twice === after.pops, `${after.pops} → ${twice}`);

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── daily-gift verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
