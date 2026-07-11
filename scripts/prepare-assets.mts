/**
 * Asset pipeline v1 (TECH §7): manifest-driven copy + optimize + lint.
 *
 *   npm run assets
 *
 * Reads scripts/asset-manifest.json, optimizes each source GLB (dedup, prune, weld),
 * writes public/assets/models/<id>.glb, and emits public/assets/models/manifest.json
 * with per-model metadata (AABB, animation clips, sizes) consumed by the runtime
 * AssetRegistry and used to lint scale/footprint mismatches early.
 *
 * v0.2+: quantize/meshopt compression, prefab baking (bake-prefabs.mts), license gate.
 */
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/core';
import { dedup, prune, weld } from '@gltf-transform/functions';
import { mkdir, readFile, writeFile, stat, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT_DIR = path.join(ROOT, 'public/assets/models');

/** Animated agents (S16) must ship the clips the AgentRenderer drives, or the
 *  swap is caught here rather than as a silent T-pose at runtime. */
const REQUIRED_CLIPS: Array<{ prefix: string; clips: string[] }> = [
  { prefix: 'npc.', clips: ['idle', 'walk'] },
  { prefix: 'pal.', clips: ['idle', 'walk'] },
];

interface ManifestIn {
  models: Record<string, string>;
}

interface ModelMeta {
  file: string;
  bytes: number;
  aabb: { min: [number, number, number]; max: [number, number, number] };
  size: [number, number, number];
  clips: string[];
  materials: number;
  meshes: number;
}

async function main(): Promise<void> {
  const manifestPath = path.join(ROOT, 'scripts/asset-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ManifestIn;
  await mkdir(OUT_DIR, { recursive: true });

  const io = new NodeIO();
  const out: Record<string, ModelMeta> = {};
  let totalBytes = 0;
  const failures: string[] = [];

  for (const [id, srcRel] of Object.entries(manifest.models)) {
    const src = path.join(ROOT, srcRel);
    try {
      const doc = await io.read(src);
      await doc.transform(dedup(), prune(), weld());

      const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
      if (!scene) throw new Error('no scene');
      const bbox = getBounds(scene);
      const size: [number, number, number] = [
        bbox.max[0] - bbox.min[0],
        bbox.max[1] - bbox.min[1],
        bbox.max[2] - bbox.min[2],
      ];
      const clips = doc
        .getRoot()
        .listAnimations()
        .map((a) => a.getName());

      const required = REQUIRED_CLIPS.find((r) => id.startsWith(r.prefix));
      if (required) {
        const missing = required.clips.filter((c) => !clips.includes(c));
        if (missing.length) throw new Error(`missing required clip(s): ${missing.join(', ')}`);
      }

      const outFile = `${id}.glb`;
      const outPath = path.join(OUT_DIR, outFile);
      await io.write(outPath, doc);
      const bytes = (await stat(outPath)).size;
      totalBytes += bytes;

      out[id] = {
        file: `assets/models/${outFile}`,
        bytes,
        aabb: { min: [...bbox.min] as [number, number, number], max: [...bbox.max] as [number, number, number] },
        size,
        clips,
        materials: doc.getRoot().listMaterials().length,
        meshes: doc.getRoot().listMeshes().length,
      };

      console.log(
        `✓ ${id.padEnd(26)} ${(bytes / 1024).toFixed(0).padStart(5)} kB  size ${size
          .map((v) => v.toFixed(2))
          .join(' × ')}  mats:${out[id].materials}${clips.length ? `  clips:[${clips.join(',')}]` : ''}`,
      );
    } catch (err) {
      failures.push(`${id}: ${(err as Error).message}`);
      console.error(`✗ ${id} — ${(err as Error).message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nPipeline failed for ${failures.length} model(s).`);
    process.exit(1);
  }

  // Remove orphans — output must mirror the manifest exactly (nothing ships by accident).
  const expected = new Set(Object.keys(manifest.models).map((id) => `${id}.glb`));
  for (const file of await readdir(OUT_DIR)) {
    if (file.endsWith('.glb') && !expected.has(file)) {
      await unlink(path.join(OUT_DIR, file));
      console.log(`✂ removed orphan ${file}`);
    }
  }

  await writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), models: out }, null, 2),
  );
  console.log(
    `\n${Object.keys(out).length} models → public/assets/models (${(totalBytes / 1024 / 1024).toFixed(2)} MB total)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
