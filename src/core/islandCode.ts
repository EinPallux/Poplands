/**
 * Island share codes (post-1.0): pack a save into a compact, copy-pasteable code
 * (and a `?island=` URL) so players can share their island. Deflate-compressed +
 * base64url, with a graceful raw-base64 fallback where CompressionStream is
 * unavailable — a one-char version prefix records which path was used. core-layer:
 * only Web-platform APIs, no three.js. Decoding NEVER throws — it returns null on
 * any malformed / truncated / wrong-version input (so a bad paste fails gently).
 */

const PREFIX_DEFLATE = 'A';
const PREFIX_RAW = 'B';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  // justified: every `bytes` here is an exact-length, ArrayBuffer-backed Uint8Array
  // (TextEncoder / new Uint8Array), so `.buffer` IS the data; TS 5.7 widens it to
  // ArrayBufferLike (incl. SharedArrayBuffer) which Blob rejects — a lib-typing cast.
  const buf = bytes.buffer as ArrayBuffer;
  const stream = new Blob([buf]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Encode a save JSON string into a share code. Async (uses CompressionStream). */
export async function encodeShareCode(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try {
      return PREFIX_DEFLATE + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch {
      /* fall through to the uncompressed path */
    }
  }
  return PREFIX_RAW + toBase64Url(bytes);
}

/** Decode a share code back to the save JSON string, or null if it's not valid. */
export async function decodeShareCode(code: string): Promise<string | null> {
  try {
    const c = code.trim();
    if (c.length < 2) return null;
    const prefix = c[0];
    const bytes = fromBase64Url(c.slice(1));
    if (prefix === PREFIX_DEFLATE) {
      if (typeof DecompressionStream === 'undefined') return null;
      return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
    }
    if (prefix === PREFIX_RAW) return new TextDecoder().decode(bytes);
    return null;
  } catch {
    return null;
  }
}
