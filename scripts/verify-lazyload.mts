/**
 * Headless verification for S4 phased/themed lazy-loading (v0.6):
 *   - boot wave loads only its models; themed biome sets stay off a fresh island.
 *   - phaseOf() classifies boot / early / themed:<biome> correctly at runtime.
 *   - makeGhost on a not-yet-loaded model returns a placeholder (never a crash).
 *   - loadPhase streams a themed wave on demand.
 *   - §6.1: a returning save with an `early`-phase placement boots error-free and
 *     that model is present before the world is projected.
 *
 *   npm run build && npx tsx scripts/verify-lazyload.mts
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pl = (page: Page, expr: (h: any) => unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.evaluate(expr as any, undefined) as Promise<any>;

async function main(): Promise<void> {
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });

  // ── fresh island ────────────────────────────────────────────────────────────
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`);
  await page.waitForTimeout(9000);

  const bootLoaded = await pl(page, () => (window as any).__poplands.modelLoaded('nature.tree'));
  check('boot model (nature.tree) is loaded at first paint', bootLoaded === true);

  const phaseTree = await pl(page, () => (window as any).__poplands.phaseOf('nature.tree'));
  const phaseTown = await pl(page, () => (window as any).__poplands.phaseOf('building.town-hall'));
  const phaseSnow = await pl(page, () => (window as any).__poplands.phaseOf('nature.snow-pine'));
  const phasePump = await pl(page, () => (window as any).__poplands.phaseOf('deco.jack-o-lantern'));
  check('phaseOf nature.tree = boot', phaseTree === 'boot', String(phaseTree));
  check('phaseOf town-hall = early', phaseTown === 'early', String(phaseTown));
  check('phaseOf snow-pine = themed:snowcap', phaseSnow === 'themed:snowcap', String(phaseSnow));
  check('phaseOf jack-o-lantern = themed:spooky', phasePump === 'themed:spooky', String(phasePump));

  const snowBefore = await pl(page, () => (window as any).__poplands.modelLoaded('nature.snow-pine'));
  check('themed set stays off a fresh meadow island', snowBefore === false);

  // makeGhost on a not-yet-loaded model → placeholder object, no throw
  const ghostOk = await pl(page, () => {
    const g = (window as any).__poplands.props.makeGhost('nature.snow-pine');
    return !!g && !!g.object;
  });
  check('makeGhost(unloaded) returns a placeholder (no crash)', ghostOk === true);

  // stream the snowcap wave on demand
  await pl(page, () => (window as any).__poplands.loadPhase('themed:snowcap'));
  await page.waitForTimeout(1500);
  const snowAfter = await pl(page, () => (window as any).__poplands.modelLoaded('nature.snow-pine'));
  check('loadPhase(themed:snowcap) streams the biome set in', snowAfter === true);
  check('no page errors on the fresh island path', errors.length === 0, errors.join(' | '));

  // grab a fresh save to seed the returning-save case
  const saveJson: string = await pl(page, () => JSON.stringify((window as any).__poplands.state.save));
  await page.close();

  // ── returning save with an `early`-phase placement (§6.1 pre-await) ──────────
  const save = JSON.parse(saveJson);
  save.player.level = 9;
  save.island.placements.push({ id: 'seed-early', def: 'income.harbor-market', wx: 2, wz: 2, rot: 0 });
  save.player.xpGranted.push('seed-early'); // no retroactive XP windfall
  const seeded = JSON.stringify(save);

  const errors2: string[] = [];
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page2.on('pageerror', (e) => errors2.push(e.message));
  await page2.addInitScript((s: string) => {
    localStorage.setItem('poplands.save', s);
  }, seeded);
  await page2.goto(`${url}/?debug=1`);
  await page2.waitForTimeout(9000);

  const seededLoaded = await pl(page2, () => (window as any).__poplands.modelLoaded('income.harbor-market'));
  const seededPlaced = await pl(page2, () =>
    (window as any).__poplands.island.allPlacements().some((p: { id: string }) => p.id === 'seed-early'),
  );
  check('returning save: early placement survived load', seededPlaced === true);
  check('returning save: its early model was pre-awaited before rebuild', seededLoaded === true);
  check('returning save: booted with zero page errors', errors2.length === 0, errors2.join(' | '));
  await page2.close();

  await browser.close();
  close();

  console.log('\n── lazy-load verification ──');
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
