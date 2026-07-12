/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Clarity slice verify (post-1.0 batch, user 2026-07-12): custom tooltips + welcome hint.
 *   #4 custom tooltips — hovering a HUD element shows OUR styled bubble, not the browser
 *      default; no stray `title=` attributes remain on the HUD.
 *   #7 more feedback — a brand-new empty island shows a friendly welcome coach-mark that
 *      points at the build bar and retires the moment the first item is placed.
 *
 *   npm run build && npx tsx scripts/verify-clarity.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'clarity-tooltip.png');
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(page, 9500);

  // ── #4 custom tooltips replace browser title= ──
  const inv = await page.evaluate(() => ({
    titleAttrs: document.querySelectorAll('#ui [title]').length,
    dataTips: document.querySelectorAll('#ui [data-tip]').length,
    tooltipEl: !!document.querySelector('.tooltip'),
  }));
  check('no browser title= tooltips remain in the HUD', inv.titleAttrs === 0, `title=${inv.titleAttrs}`);
  check('HUD elements carry custom data-tip tooltips', inv.dataTips >= 10, `data-tip=${inv.dataTips}`);
  check('a single delegated .tooltip element exists', inv.tooltipEl === true, '');

  // hover the season chip → our styled bubble shows with the season text
  const hov = await page.evaluate(async () => {
    const el = document.querySelector('.tb-season') as HTMLElement;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }));
    await new Promise((res) => setTimeout(res, 420));
    const tt = document.querySelector('.tooltip') as HTMLElement | null;
    return { shown: !!tt && tt.classList.contains('show'), text: tt?.textContent ?? '', pos: tt ? getComputedStyle(tt).position : '' };
  });
  check('hovering the Season shows the custom tooltip', hov.shown === true, `text="${hov.text.slice(0, 30)}…"`);
  check('the tooltip names the current season', /spring|summer|autumn|winter/i.test(hov.text), hov.text.slice(0, 40));
  check('the tooltip is a fixed floating bubble', hov.pos === 'fixed', `position=${hov.pos}`);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // moving away hides it (no lingering tooltip)
  const away = await page.evaluate(async () => {
    const el = document.querySelector('.tb-season') as HTMLElement;
    el.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
    await new Promise((res) => setTimeout(res, 120));
    return document.querySelector('.tooltip')?.classList.contains('show') ?? false;
  });
  check('the tooltip hides when the pointer leaves', away === false, '');

  // ── #7 empty-island welcome coach-mark ──
  const welcome = await page.evaluate(() => ({
    present: !!document.querySelector('.welcome-hint'),
    hasArrow: !!document.querySelector('.welcome-hint .wh-arrow'),
    hasDismiss: !!document.querySelector('.welcome-hint .wh-dismiss'),
  }));
  check('a brand-new empty island shows the welcome hint', welcome.present === true, '');
  check('the welcome hint points at the build bar (arrow + button)', welcome.hasArrow && welcome.hasDismiss, JSON.stringify(welcome));

  // placing the first item retires the hint (no-FOMO, one-time)
  await page.evaluate(() => (window as any).__poplands.place('nature.flower.purple', 3, 3, 0));
  await sleep(page, 700);
  const afterPlace = await page.evaluate(() => !!document.querySelector('.welcome-hint'));
  check('placing the first item retires the welcome hint', afterPlace === false, '');

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── clarity verify (custom tooltips · empty-island welcome) ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
