/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Biome re-theme verify (post-1.0 batch, user 2026-07-12, #2): the Biome tool lets a
 * player change any placed chunk's biome. Opening the picker on a chunk shows the four
 * biomes with the current one marked; picking a new one re-themes the chunk (world
 * rebuilds, ground recolours), persists into the save, and pops a confirm toast.
 *
 *   npm run build && npx tsx scripts/verify-biome.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots', 'biome-picker.png');
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

  // the starter chunk (0,0) is meadow
  const start = await page.evaluate(() => (window as any).__poplands.themeAtChunk(0, 0));
  check('a starter chunk begins as Meadow', start === 'meadow', `theme=${start}`);

  // ── the picker opens for a chosen chunk ──
  await page.evaluate(() => (window as any).__poplands.openBiomePicker(0, 0));
  await sleep(page, 500);
  const picker = await page.evaluate(() => ({
    open: getComputedStyle(document.querySelector('.biome-backdrop') as HTMLElement).display !== 'none',
    cards: document.querySelectorAll('.biome-card').length,
    active: document.querySelectorAll('.biome-card.active').length,
    activeTheme: (document.querySelector('.biome-card.active') as HTMLElement | null)?.dataset['theme'] ?? null,
  }));
  check('the biome picker opens with all four biomes', picker.open && picker.cards === 4, JSON.stringify(picker));
  check('the current biome is marked in the picker', picker.active === 1 && picker.activeTheme === 'meadow', `active=${picker.activeTheme}`);
  await page.screenshot({ path: OUT });
  console.log('✓ shot →', OUT);

  // ── pick Snowcap → the chunk re-themes ──
  await page.evaluate(() => (document.querySelector('.biome-card[data-theme="snowcap"]') as HTMLElement | null)?.click());
  await sleep(page, 700);
  const after = await page.evaluate(() => ({
    theme: (window as any).__poplands.themeAtChunk(0, 0),
    closed: (document.querySelector('.biome-backdrop') as HTMLElement | null)?.style.display === 'none',
    saved: (window as any).__poplands.state.save.island.chunks.find((c: any) => c.cx === 0 && c.cz === 0)?.theme ?? null,
  }));
  check('picking a biome re-themes the chunk', after.theme === 'snowcap', `theme=${after.theme}`);
  check('the picker closes after choosing', after.closed === true, '');
  check('the new biome is written into the save', after.saved === 'snowcap', `saved=${after.saved}`);

  // ── a Biome tool button is exposed in the build bar ──
  const routed = await page.evaluate(() => {
    const btn = document.querySelector('.build-tool.tool-biome') as HTMLElement | null;
    return { toolButton: !!btn, label: btn?.textContent?.trim() ?? '' };
  });
  check('a Biome tool button is in the build bar', routed.toolButton === true, `label="${routed.label}"`);

  // ── re-theme via the debug command persists too (second chunk) ──
  const second = await page.evaluate(async () => {
    const h = (window as any).__poplands;
    h.reTheme(1, 0, 'sandbar');
    await new Promise((r) => setTimeout(r, 300));
    return { theme: h.themeAtChunk(1, 0), saved: h.state.save.island.chunks.find((c: any) => c.cx === 1 && c.cz === 0)?.theme ?? null };
  });
  check('re-theming another chunk works independently', second.theme === 'sandbar' && second.saved === 'sandbar', JSON.stringify(second));

  check('no page errors across the run', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── biome re-theme verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
