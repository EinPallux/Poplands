/* eslint-disable @typescript-eslint/no-explicit-any -- headless verify pokes the debug handle */
/**
 * Island-share verify (post-1.0): build a distinctive island in context A, encode
 * a share code, load it into an ISOLATED context B (its own storage), and confirm
 * B's island now matches A's — proving the code carries the whole island.
 *
 *   npm run build && npx tsx scripts/verify-share.mts
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
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

async function boot(ctx: BrowserContext, url: string, errors: string[]): Promise<Page> {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9500);
  return page;
}

async function main(): Promise<void> {
  const { url, close } = await serve();
  const exe = process.env['PW_CHROMIUM'];
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const errors: string[] = [];

  // ── context A: build a distinctive island, encode a share code ──
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const pageA = await boot(ctxA, url, errors);
  await pl(pageA, () => {
    const h = (window as any).__poplands;
    let x = 1, z = 1, placed = 0;
    for (const def of ['income.stall', 'decor.fountain', 'nature.tree']) {
      for (let tries = 0; tries < 30 && !h.placeSilent(def, x, z, 0); tries++) { x += 3; if (x > 13) { x = 1; z += 3; } }
      placed++; x += 3; if (x > 13) { x = 1; z += 3; }
    }
    return placed;
  });
  const sigA: string[] = await pl(pageA, () => (window as any).__poplands.placementSummary());
  const code: string = await pl(pageA, () => (window as any).__poplands.shareCode());
  check('a share code is produced', typeof code === 'string' && code.length > 10, `len=${code.length}`);

  // beauty shot: the Share UI in Settings (open the gear → Share island → code appears)
  await mkdir(path.join(ROOT, 'shots'), { recursive: true });
  await pageA.click('.settings-gear').catch(() => {});
  await pageA.waitForTimeout(300);
  await pageA.click('.s-share').catch(() => {});
  await pageA.waitForTimeout(500);
  await pageA.screenshot({ path: path.join(ROOT, 'shots', 'island-share.png') });

  // ── context B: fresh + isolated. Different island to start. ──
  const ctxB = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const pageB = await boot(ctxB, url, errors);
  const sigB0: string[] = await pl(pageB, () => (window as any).__poplands.placementSummary());
  check('context B starts with a different island', JSON.stringify(sigB0) !== JSON.stringify(sigA), `A=${sigA.length} items, B=${sigB0.length} items`);

  // ── import A's code into B (persists the save), then reload to rebuild ──
  const imported: boolean = await pageB.evaluate((c: string) => (window as any).__poplands.importShare(c), code);
  check('the share code imports into context B', imported === true, `imported=${imported}`);
  await pageB.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageB.waitForTimeout(9500);
  const sigB1: string[] = await pl(pageB, () => (window as any).__poplands.placementSummary());
  check('after loading the code, B matches A', JSON.stringify(sigB1) === JSON.stringify(sigA), `B now ${sigB1.length} items vs A ${sigA.length}`);

  check('no page errors across both contexts', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); close();
  console.log('\n── island-share verify ──');
  let allPass = true;
  for (const c of checks) { console.log(`${c.ok ? '✓' : '✗'} ${c.n}${c.d ? `  (${c.d})` : ''}`); if (!c.ok) allPass = false; }
  console.log(allPass ? '\nALL PASS' : '\nFAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
