/**
 * Dev tool: print the node hierarchy, meshes, and animation clips of GLB files.
 *
 *   npx tsx scripts/inspect-model.mts "assets/Some Pack/model.glb" [...more]
 *
 * Used when adding pack models to the manifest — find spinnable sub-nodes
 * (windmill rotors), check pivots, verify clip names (TECH §7).
 */
import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();

for (const p of process.argv.slice(2)) {
  const doc = await io.read(p);
  console.log('===', p);
  for (const anim of doc.getRoot().listAnimations()) {
    console.log('  clip:', anim.getName());
  }
  for (const n of doc.getRoot().listNodes()) {
    const mesh = n.getMesh() ? ' [mesh]' : '';
    const t = n.getTranslation().map((v) => +v.toFixed(2));
    console.log(`  node: ${n.getName()}${mesh} T=(${t.join(', ')})`);
  }
}
