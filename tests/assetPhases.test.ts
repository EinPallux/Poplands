import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { phaseFor, isUnclassified, type AssetPhase } from '@/content/assetPhases';
import { CATALOG } from '@/content/catalog';

/** The generated manifest is the ground truth for which model ids actually ship. */
const manifest = JSON.parse(
  readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8'),
) as { models: Record<string, { phase: AssetPhase; bytes: number }> };
const ids = Object.keys(manifest.models);

describe('assetPhases (S4 phased lazy-loading)', () => {
  it('classifies every shipping model id — none fall through unclassified', () => {
    const orphans = ids.filter((id) => isUnclassified(id));
    expect(orphans).toEqual([]);
  });

  it('agrees with the phase the pipeline stamped into the manifest', () => {
    // the runtime reads manifest.phase; phaseFor is what stamped it — they must match
    for (const id of ids) expect(phaseFor(id)).toBe(manifest.models[id]!.phase);
  });

  it('routes biome-tagged catalog items to their themed phase', () => {
    for (const def of CATALOG) {
      if (def.theme) expect(phaseFor(def.model)).toBe(`themed:${def.theme}`);
    }
  });

  it('keeps agents, fixtures, and tile variants on the boot wave', () => {
    expect(phaseFor('npc.a')).toBe('boot');
    expect(phaseFor('pal.cat')).toBe('boot');
    expect(phaseFor('building.windmill')).toBe('boot');
    expect(phaseFor('ground.path-dirt-corner')).toBe('boot');
  });

  it('splits untagged tiers: ≤4 boot, ≥5 early', () => {
    for (const def of CATALOG) {
      if (def.theme) continue;
      expect(phaseFor(def.model)).toBe(def.tier <= 4 ? 'boot' : 'early');
    }
  });

  it('keeps the boot payload under the 3 MB budget (TECH §7 DoD)', () => {
    let bootBytes = 0;
    for (const [, m] of Object.entries(manifest.models)) if (m.phase === 'boot') bootBytes += m.bytes;
    expect(bootBytes).toBeLessThan(3 * 1024 * 1024);
  });

  it('defers the biome sets so a meadow-only island never fetches them', () => {
    const themed = ids.filter((id) => phaseFor(id).startsWith('themed:'));
    expect(themed.length).toBeGreaterThan(30); // sandbar+spooky+snowcap sets
  });
});
