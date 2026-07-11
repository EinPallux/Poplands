/* eslint-disable @typescript-eslint/no-explicit-any -- headless capture pokes the debug handle */
/**
 * Social preview (og:image) capture: boot the built game, decorate a cosy island
 * with The Wonder as the centrepiece, hide all UI (photo mode), and grab a clean
 * 1200×630 beauty shot → public/og-image.png (served + referenced by index.html).
 *
 *   npm run build && npx tsx scripts/og-image.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'public', 'og-image.png');

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

const pl = (page: Page, expr: (h: any) => unknown) => page.evaluate(expr as any, undefined) as Promise<any>;

async function main(): Promise<void> {
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`${url}/?debug=1`);
  await page.waitForTimeout(9500);

  // decorate: grow a little, raise The Wonder (aurora), ring it with buildings + nature.
  await pl(page, () => {
    const h = (window as any).__poplands;
    h.growTo(9);
    const b = h.island.bounds();
    const cx = Math.round((b.minX + b.maxX) / 2);
    const cz = Math.round((b.minZ + b.maxZ) / 2);
    h.place('decor.the-wonder', cx - 2, cz - 2, 0); // centrepiece + aurora
    const scatter: Array<[string, number, number]> = [
      ['home.keep', cx - 9, cz - 3], ['income.tavern', cx + 5, cz - 6], ['income.civic-hall', cx + 5, cz + 4],
      ['home.house', cx - 8, cz + 4], ['home.hut', cx + 8, cz - 1], ['decor.castle-tower', cx - 3, cz + 7],
    ];
    for (const [def, wx, wz] of scatter) h.placeSilent(def, wx, wz, 0);
    const nature = ['nature.tree', 'nature.bush', 'nature.flower.red', 'nature.flower.yellow', 'nature.pine', 'nature.grass'];
    let n = 0;
    for (let wz = Math.ceil(b.minZ); wz < Math.floor(b.maxZ); wz += 2) {
      for (let wx = Math.ceil(b.minX); wx < Math.floor(b.maxX); wx += 2) {
        h.placeSilent(nature[n++ % nature.length]!, wx, wz, 0);
      }
    }
  });
  await pl(page, () => (window as any).__poplands.setTime('day')); // bright + inviting
  await page.waitForTimeout(1200);

  // clean framing: hide debug HUD (`), settle + zoom, enter photo mode (hides chrome).
  await page.keyboard.press('Backquote');
  await page.keyboard.press('KeyR'); // settle to default framing
  await page.waitForTimeout(500);
  await page.mouse.move(600, 320);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -150); await page.waitForTimeout(120); }
  await page.keyboard.press('KeyP'); // photo mode → vignette
  await page.waitForTimeout(400);
  // hide the photo-mode toolbar and clear the hover highlight for a pristine shot
  await pl(page, () => {
    const bar = document.querySelector('.photo-toolbar') as HTMLElement | null;
    if (bar) bar.style.display = 'none';
  });
  await page.mouse.move(8, 8); // cursor to a sky corner → no hovered cell
  await page.waitForTimeout(600);

  await page.screenshot({ path: OUT });
  console.log(`✓ og-image → ${OUT}`);

  await browser.close();
  close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
