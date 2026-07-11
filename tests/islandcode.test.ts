import { describe, it, expect } from 'vitest';
import { encodeShareCode, decodeShareCode } from '@/core/islandCode';

describe('islandCode', () => {
  it('round-trips a save JSON through a compact code', async () => {
    const json = JSON.stringify({
      v: 6,
      island: { placements: [{ id: 'p1', def: 'nature.tree', wx: 1, wz: 2, rot: 0 }] },
      note: 'hello world 🌸',
    });
    const code = await encodeShareCode(json);
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(1);
    expect(await decodeShareCode(code)).toBe(json);
  });

  it('compresses repetitive island data well below the raw JSON size', async () => {
    const json = JSON.stringify({
      placements: Array.from({ length: 200 }, (_, i) => ({ id: `p${i}`, def: 'nature.tree', wx: i, wz: 0, rot: 0 })),
    });
    const code = await encodeShareCode(json);
    expect(code.length).toBeLessThan(json.length); // deflate beats the ~1.33× base64 blow-up
    expect(await decodeShareCode(code)).toBe(json);
  });

  it('preserves unicode (emoji) content', async () => {
    const json = JSON.stringify({ note: 'Islanders 🙂 Pals 🐾 ✦ ● 🎏🌈' });
    expect(await decodeShareCode(await encodeShareCode(json))).toBe(json);
  });

  it('returns null on malformed / truncated codes instead of throwing', async () => {
    expect(await decodeShareCode('')).toBeNull();
    expect(await decodeShareCode('X')).toBeNull(); // too short
    expect(await decodeShareCode('Zabcd')).toBeNull(); // unknown version prefix
    expect(await decodeShareCode('A@@@@corrupt')).toBeNull(); // deflate prefix, non-base64 body
  });
});
