/**
 * Dev tool: boot the built game headlessly and capture beauty/debug screenshots
 * (ROADMAP "milestone beauty GIF/shots" ritual).
 *
 *   npm run build && npx tsx scripts/screenshot.mts [outDir]
 *
 * Serves ./dist on an ephemeral port, drives the camera with synthetic input,
 * writes PNGs. Uses the environment's preinstalled Chromium.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'shots'));

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
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[page]', msg.text());
  });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  await page.goto(`${url}/?debug=1`);
  await page.waitForTimeout(9000); // boot + shader warmup + intro swoop
  await page.keyboard.press('KeyR'); // guarantee settled default framing
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(OUT, 'shot-1-default.png') });
  console.log('✓ shot-1-default.png');

  // orbit ~140° around and slightly lower — the "walk around it" view
  await page.mouse.move(800, 450);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(1250, 490, { steps: 30 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'shot-2-orbit.png') });
  console.log('✓ shot-2-orbit.png');

  // zoom in near the hut & path for the cozy close-up
  await page.mouse.move(900, 480);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'shot-3-closeup.png') });
  console.log('✓ shot-3-closeup.png');

  // pull back out and drop the camera low — island silhouette + skirt + cloud sea
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(100);
  }
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(800, 760, { steps: 25 }); // drag down = lower polar
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, 'shot-4-silhouette.png') });
  console.log('✓ shot-4-silhouette.png');

  await browser.close();
  close();
  console.log(`\nScreenshots → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
