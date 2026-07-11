/**
 * Headless verification for the v0.6 accessibility pass (S23):
 *   - UI-scale setting drives the `--ui-scale` CSS custom property and actually
 *     rescales chrome widgets (buildbar transform changes).
 *   - The placement ghost carries a non-colour validity badge (a Sprite child)
 *     that swaps its texture on valid↔invalid.
 *   - The unaffordable ✕ affordance flag is present in build cards.
 *
 *   npm run build && npx tsx scripts/verify-a11y.mts
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots');

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
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

async function main(): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(OUT, { recursive: true });
  const { url, close } = await serve();

  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  await page.goto(`${url}/?debug=1`);
  await page.waitForTimeout(9000); // boot + shader warmup + intro

  // ── UI scale ──────────────────────────────────────────────────────────────
  // drive the real settings select so we exercise the signal → CSS var effect.
  await page.click('.settings-gear');
  await page.waitForTimeout(250);
  const beforeTransform = await page.evaluate(
    () => window.getComputedStyle(document.querySelector('.buildbar')!).transform,
  );
  await page.selectOption('.s-uiscale', '1.3');
  await page.waitForTimeout(500);
  const cssVar = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--ui-scale'),
  );
  const afterTransform = await page.evaluate(
    () => window.getComputedStyle(document.querySelector('.buildbar')!).transform,
  );
  check('uiScale select sets --ui-scale=1.3', cssVar.trim() === '1.3', `--ui-scale='${cssVar}'`);
  check('buildbar transform matrix changes when scaled', beforeTransform !== afterTransform);
  await page.screenshot({ path: path.join(OUT, 'a11y-uiscale-1.3.png') });
  console.log('✓ a11y-uiscale-1.3.png');

  // back to normal for the ghost shot
  await page.selectOption('.s-uiscale', '1');
  await page.waitForTimeout(300);
  await page.click('.settings-gear'); // close settings

  // ── ghost validity badge ───────────────────────────────────────────────────
  const ghost = await page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const props = (window as any).__poplands.props;
    const g = props.makeGhost('nature.tree');
    if (!g) return { ok: false, sprites: 0, valid: false, invalid: false };
    const sprites = (g.object.children as any[]).filter((c) => c.type === 'Sprite');
    const first = sprites[0];
    // toggle validity and confirm the badge's texture actually differs
    g.setValid(true);
    const validUuid = first ? first.material.map.uuid : '';
    g.setValid(false);
    const invalidUuid = first ? first.material.map.uuid : '';
    return {
      ok: true,
      sprites: sprites.length,
      valid: validUuid !== '',
      invalid: invalidUuid !== '' && invalidUuid !== validUuid,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
  check('makeGhost attaches exactly one Sprite badge', ghost.ok && ghost.sprites === 1, `sprites=${ghost.sprites}`);
  check('badge texture swaps valid → invalid', ghost.valid && ghost.invalid);

  // ── unaffordable affordance flag present in the DOM ─────────────────────────
  const flagCount = await page.evaluate(() => document.querySelectorAll('.build-card .afford-flag').length);
  check('build cards carry an .afford-flag ✕ glyph', flagCount > 0, `count=${flagCount}`);

  await browser.close();
  close();

  console.log('\n── a11y verification ──');
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
