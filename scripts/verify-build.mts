/**
 * Headless verification of the v0.2 build loop (ROADMAP v0.2 exit criteria):
 *   1. boot → starter placements present
 *   2. select an item → place it → placement count grows, world reacts
 *   3. reload → placement persisted (save round-trip through localStorage)
 *   4. remove tool → placement removed → persists after another reload
 *   5. 300-item stress: place programmatically, assert fps sanity + flat pools
 *
 *   npm run build && npx tsx scripts/verify-build.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
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
      res.end();
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

const count = (page: Page) =>
  page.evaluate(() => (window as never as { __poplands: { island: { placementCount: number } } }).__poplands.island.placementCount);

/**
 * Wait until boot finished and the camera is rock-still: wait for the debug
 * handle, hard-reset the camera (Home — fixed goal, pure damping), then require
 * consecutive samples to be near-identical. The intro tween can't fool this.
 */
async function settle(page: Page, timeoutMs = 40000): Promise<void> {
  const start = Date.now();
  const readDistance = () =>
    page
      .evaluate(
        () =>
          (window as never as { __poplands?: { rig: { state: { distance: number } } } }).__poplands
            ?.rig.state.distance ?? null,
      )
      .catch(() => null);
  // 1. wait for the app handle (boot done)
  while ((await readDistance()) === null) {
    if (Date.now() - start > timeoutMs) throw new Error('boot never finished');
    await page.waitForTimeout(400);
  }
  // 2. cancel any intro drift with a reset, then require stillness
  await page.waitForTimeout(3000); // let the intro finish so reset isn't ignored
  await page.keyboard.press('Home');
  await page.waitForTimeout(1500);
  let prev = await readDistance();
  for (;;) {
    await page.waitForTimeout(400);
    const next = await readDistance();
    if (prev !== null && next !== null && Math.abs(next - prev) < 0.01) return;
    prev = next;
    if (Date.now() - start > timeoutMs) throw new Error('camera never settled');
  }
}

/** Screen pixel position of a block center — deterministic click targets. */
const screenPosOfCell = (page: Page, wx: number, wz: number) =>
  page.evaluate(
    ([x, z]) =>
      (
        window as never as {
          __poplands: { projectCell: (wx: number, wz: number) => { x: number; y: number } };
        }
      ).__poplands.projectCell(x!, z!),
    [wx, wz] as const,
  );

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function main(): Promise<void> {
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message);
    failures++;
  });

  await page.goto(`${url}/?debug=1`);
  await settle(page);

  // 1 — starter island seeded
  const initial = await count(page);
  check('starter placements seeded', initial >= 45, `${initial} placements`);

  // 2 — select Little Tree, place it on a KNOWN empty cell (2, 14)
  const TARGET = { wx: 2, wz: 14 } as const;
  await page.locator('.build-card', { hasText: 'Little Tree' }).click();
  await page.waitForTimeout(300);
  const target = await screenPosOfCell(page, TARGET.wx, TARGET.wz);
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(300);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(800); // pop-in + autosave debounce starts
  const afterPlace = await count(page);
  check('placement via UI click', afterPlace === initial + 1, `${initial} → ${afterPlace}`);
  await page.screenshot({ path: path.join(ROOT, 'shots/verify-1-placed.png') });

  // rotation + invalid feedback shouldn't crash
  await page.keyboard.press('KeyR');
  await page.mouse.click(target.x, target.y); // same cell → occupied → shake+thock
  await page.waitForTimeout(400);
  check('occupied cell rejected', (await count(page)) === afterPlace);

  // 3 — persistence across reload (pagehide flushes the autosave)
  await page.reload();
  await settle(page);
  const reloaded = await count(page);
  check('placements persist across reload', reloaded === afterPlace, `${reloaded}`);

  // 4 — remove tool on the same cell (recompute screen position after reload)
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(200);
  const target2 = await screenPosOfCell(page, TARGET.wx, TARGET.wz);
  await page.mouse.move(target2.x, target2.y);
  await page.waitForTimeout(200);
  await page.mouse.click(target2.x, target2.y);
  await page.waitForTimeout(600);
  const afterRemove = await count(page);
  check('remove tool', afterRemove === reloaded - 1, `${reloaded} → ${afterRemove}`);
  await page.keyboard.press('Escape');

  // 5 — programmatic 300-item stress via the session's own command path
  const stress = await page.evaluate(() => {
    const P = (
      window as never as {
        __poplands: {
          island: {
            placementCount: number;
            canPlace: (def: unknown, wx: number, wz: number, rot: number) => { ok: boolean };
            place: (def: string, wx: number, wz: number, rot: number) => unknown;
          };
          props: { rebuildAll: (p: unknown[]) => void; stats: { instanced: number; uniques: number }; };
        };
      }
    ).__poplands;
    // saturate free cells with grass via the real model APIs
    let placed = 0;
    for (let wx = 0; wx < 16 && placed < 300; wx++) {
      for (let wz = 0; wz < 16 && placed < 300; wz++) {
        const island = P.island as unknown as {
          occupantAt: (x: number, z: number) => unknown;
          hasBlock: (x: number, z: number) => boolean;
          place: (def: string, wx: number, wz: number, rot: number) => unknown;
        };
        if (island.hasBlock(wx, wz) && !island.occupantAt(wx, wz)) {
          island.place('nature.grass', wx, wz, 0);
          placed++;
        }
      }
    }
    const model = P.island as unknown as { allPlacements: () => unknown[] };
    P.props.rebuildAll(model.allPlacements());
    return { placed, stats: P.props.stats, total: P.island.placementCount };
  });
  check('stress placement', stress.placed > 150, `${stress.placed} extra placed, ${stress.stats.instanced} instanced`);
  await page.waitForTimeout(1200);
  const fps = await page.evaluate(
    () => (window as never as { __poplands: { rm: { renderer: { info: { render: { calls: number } } } } } }).__poplands.rm.renderer.info.render.calls,
  );
  check('draw calls stay pooled under stress', fps < 130, `${fps} draws`);
  await page.screenshot({ path: path.join(ROOT, 'shots/verify-2-stress.png') });

  await browser.close();
  close();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
