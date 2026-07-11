/* eslint-disable @typescript-eslint/no-explicit-any -- headless soak pokes the debug handle */
/**
 * Worst-case perf soak (v0.7, TECH §6.5): grow to the 36-chunk cap, then DENSELY
 * build it — hundreds of unique buildings (Tier B, the real draw driver) + instanced
 * nature (Tier A pools) + The Wonder's aurora, at night with all ambient layers live
 * — and assert the endgame island still fits the hard draw/tri budgets. Agents add a
 * bounded ≤36 draws on top (12 Islanders + 6 Pals hard cap), noted as headroom.
 *
 *   npm run build && npx tsx scripts/soak-v07.mts
 */
import { chromium, type Page } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const DRAW_BUDGET = 400;
const TRI_BUDGET = 1_200_000;

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
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`);
  await page.waitForTimeout(9500);

  // grow to the cap
  await pl(page, () => (window as any).__poplands.growTo(36));
  await page.waitForTimeout(600);

  // densely build it, then rebuild from truth — the LOAD path (props.rebuildAll →
  // show → pooled instances), i.e. the steady state a returning maxed save renders.
  // (Interactive mass-place would leave items mid-pop-in; a real player places one at
  // a time and a loaded save pools everything — rebuildAll reproduces that.)
  const built = await pl(page, () => {
    const h = (window as any).__poplands;
    const b = h.island.bounds();
    // The Wonder via the normal place() so its aurora + celebration wire up.
    h.place('decor.the-wonder', Math.round((b.minX + b.maxX) / 2) - 2, Math.round((b.minZ + b.maxZ) / 2) - 2, 0);
    const uniques = ['home.hut', 'home.house', 'income.stall', 'home.keep', 'income.tavern',
      'income.civic-hall', 'decor.castle-tower', 'decor.cog-sculpture', 'home.manor', 'income.town-hall'];
    const instanced = ['nature.tree', 'nature.bush', 'nature.flower.red', 'decor.fence', 'nature.rock'];
    let bldgs = 0, nature = 0, u = 0, i = 0;
    for (let wz = Math.ceil(b.minZ); wz < Math.floor(b.maxZ) - 4; wz += 1) {
      for (let wx = Math.ceil(b.minX); wx < Math.floor(b.maxX) - 4; wx += 1) {
        // a heavy but plausible maxed island: a building every 6 cells, nature between.
        // placeSilent uses the LOAD path (props.show → pooled instantly, no pop-in
        // tween), i.e. the steady state a returning maxed save renders.
        const isBldg = wx % 6 === 0 && wz % 6 === 0;
        const def = isBldg ? uniques[u++ % uniques.length]! : instanced[i++ % instanced.length]!;
        if (h.placeSilent(def, wx, wz, 0)) {
          if (isBldg) bldgs++;
          else nature++;
        }
      }
    }
    return { bldgs, nature };
  });
  console.log(`built ${built.bldgs} unique buildings + ${built.nature} instanced nature + The Wonder`);
  await pl(page, () => (window as any).__poplands.setTime('night')); // aurora + glow + ambient all live
  await page.waitForTimeout(1500);

  const stats = await pl(page, () => (window as any).__poplands.rm.info.render);
  const draws = stats.calls as number;
  const tris = stats.triangles as number;
  const aurora = await pl(page, () => (window as any).__poplands.auroraCount());
  const propStats = await pl(page, () => (window as any).__poplands.props.stats);

  console.log(`\n── worst-case 36-chunk endgame ──`);
  console.log(`props: ${propStats.instanced}i + ${propStats.uniques}u in ${propStats.pools} pools`);
  console.log(`draws ${draws} · tris ${(tris / 1000).toFixed(1)}k · aurora ${aurora}`);
  check(`draw calls within budget (≤${DRAW_BUDGET})`, draws <= DRAW_BUDGET, `${draws} draws (+ ≤36 for max agents = ${draws + 36})`);
  check('draws with max agents still within budget', draws + 36 <= DRAW_BUDGET, `${draws + 36} projected`);
  check(`triangles within budget (≤${(TRI_BUDGET / 1e6).toFixed(1)}M)`, tris <= TRI_BUDGET, `${(tris / 1000).toFixed(1)}k tris`);
  check('The Wonder aurora is live', aurora === 1);
  check('no page errors during the dense build', errors.length === 0, errors.slice(0, 2).join(' | '));

  // ── browser hardening: WebGL context loss ────────────────────────────────────
  // The critical fix is the LOSS path: preventDefault() keeps the browser able to
  // restore, and draws pause instead of spamming GL errors into a dead context.
  // (True restoration can't be emulated under headless swiftshader — the restored
  // path is exercised by the webglcontextrestored listener in RendererManager and
  // fires for real in a browser; forcing it here just re-inits three.js on a
  // still-dead context. So we assert the loss path only.)
  const errBefore = errors.length;
  const supported = await pl(page, () => {
    const h = (window as any).__poplands;
    const ext = h.rm.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    return true;
  });
  await page.waitForTimeout(600); // several render frames while the context is gone
  const lostState = await pl(page, () => (window as any).__poplands.rm.isContextLost);
  if (supported) {
    check('renderer flags context loss + pauses draws (no crash)', lostState === true);
    check('no page errors while the context is lost', errors.length === errBefore, errors.slice(errBefore, errBefore + 2).join(' | '));
  } else {
    console.log('  (WEBGL_lose_context unsupported here — skipped)');
  }

  await browser.close();
  close();
  console.log(failures === 0 ? '\nSOAK PASSED (worst-case draw/tri budgets)' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
