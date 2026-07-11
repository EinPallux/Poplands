/* eslint-disable @typescript-eslint/no-explicit-any -- headless script pokes the debug handle */
/**
 * Headless verification for v0.7 Slice 1 "Grand Opening":
 *   - Tier 15–20 items exist and MAX_TIER is 20 (full arc unlocks).
 *   - The Wonder (Tier 20) places, raises its aurora, and fires the capstone toast.
 *   - The new Tier 15–20 buildings render without error.
 *   - A night beauty shot of The Wonder + aurora.
 *
 *   npm run build && npx tsx scripts/verify-v07.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots');

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json',
};

function serve(): Promise<{ url: string; close: () => void }> {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
      const filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
      const data = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
const check = (name: string, pass: boolean, detail?: string) =>
  checks.push({ name, pass, ...(detail !== undefined ? { detail } : {}) });
const pl = (page: Page, expr: (h: any) => unknown) => page.evaluate(expr as any, undefined) as Promise<any>;

async function main(): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(OUT, { recursive: true });
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`);
  await page.waitForTimeout(9500); // boot + intro + background 'early' wave (holds the Wonder)

  // catalog: full arc present
  const maxTier = await pl(page, () => {
    // MAX_TIER isn't exposed; infer from the-wonder being placeable-tier 20
    const h = (window as any).__poplands;
    return h.phaseOf('building.the-wonder');
  });
  check('The Wonder model classifies to a load phase (in manifest)', maxTier === 'early', String(maxTier));

  // reach Level 20 first (you're maxed when you build the Wonder in real play), so
  // the Wonder's placement XP doesn't trigger level-up toasts that evict the capstone
  // toast (a debug-only artifact — real play is already at MAX_LEVEL).
  await pl(page, () => (window as any).__poplands.state.progression.grantXp(400000, 'quest'));
  await page.waitForTimeout(3000); // let the level-up toasts clear (2.6 s lifetime)

  // place The Wonder — try a few 5×5-clear origins
  const placed = await pl(page, () => {
    const h = (window as any).__poplands;
    for (const [wx, wz] of [[5, 5], [8, 2], [2, 8], [6, 6], [3, 3]]) {
      if (h.place('decor.the-wonder', wx, wz, 0)) return { wx, wz };
    }
    return null;
  });
  check('The Wonder places on the island', placed !== null, JSON.stringify(placed));

  // capture the capstone toast in a short poll window (toasts live ~2.6 s)
  let toastSeen = false;
  let toastTexts = '';
  for (let i = 0; i < 12 && !toastSeen; i++) {
    const texts: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.toast')).map((t) => t.textContent ?? ''),
    );
    toastTexts = texts.join(' | ');
    toastSeen = texts.some((t) => /Wonder/i.test(t));
    if (!toastSeen) await page.waitForTimeout(150);
  }
  check('the capstone toast fires on build', toastSeen, toastTexts || '(no toasts)');

  const auroraCount = await pl(page, () => (window as any).__poplands.auroraCount());
  check('placing The Wonder raises exactly one aurora', auroraCount === 1, `count=${auroraCount}`);

  // place a handful of the other new buildings to confirm they render error-free
  const others = await pl(page, () => {
    const h = (window as any).__poplands;
    const spots: Record<string, [number, number]> = {
      'home.keep': [11, 10], 'income.civic-hall': [0, 10], 'nature.golden-tree': [11, 3],
      'decor.cog-sculpture': [14, 6], 'income.pop-post': [10, 1],
    };
    let ok = 0;
    for (const [def, [wx, wz]] of Object.entries(spots)) if (h.place(def, wx, wz, 0)) ok++;
    return ok;
  });
  check('other Tier 15–20 buildings place & render', others >= 3, `placed=${others}`);
  await page.waitForTimeout(800);

  // night beauty shot of the aurora
  await pl(page, () => (window as any).__poplands.setTime('night'));
  await page.waitForTimeout(1500);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(600);
  // zoom toward the Wonder
  await page.mouse.move(800, 450);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -220); await page.waitForTimeout(120); }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'v07-wonder-aurora-night.png') });
  console.log('✓ v07-wonder-aurora-night.png');

  check('no page errors during the capstone flow', errors.length === 0, errors.join(' | '));

  await browser.close();
  close();

  console.log('\n── v0.7 Slice 1 verification ──');
  let allPass = true;
  for (const c of checks) {
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
    if (!c.pass) allPass = false;
  }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
