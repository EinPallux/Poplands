/**
 * The chunk-arrival set piece (S11/S12, ART §7.2) — "the single most-polished 2.2
 * seconds in the product." A just-bought chunk is built as a standalone slab and
 * rises out of the cloud sea, docks with a spring bounce, and showers confetti;
 * on dock the caller swaps in the merged island and disposes this temp mesh.
 *
 * Choreography (ART §7.2): 0–0.4 s cloud swirl → 0.4–1.5 s rise (backOut) →
 * 1.5–1.9 s dock-bounce (ζ≈0.55, ~2 bounces) → confetti + fanfare. Total ≈2.2 s,
 * soft input-lock for the first 0.8 s (juice:setPiece*). The camera NEVER shakes
 * (ART rule 6) — reframing is the rig's eased job, driven off island:grew.
 * Reduced-motion collapses to particles-lite + instant dock, decided HERE.
 */
import type { Group } from 'three';
import { tweens, easings, dampedStep } from '@/core/tween';
import { clamp } from '@/core/math';
import { bus } from '@/core/events';
import { isReducedMotion } from '@/core/settingsStore';
import { buildSlabFromBlocks } from './SlabBuilder';
import { disposeObject } from './dispose';
import type { Particles } from '@/vfx/Particles';
import type { AudioSystem } from '@/audio/AudioSystem';

const CHUNK = 8;
const RISE_DEPTH = 9; // how far below the dock height it starts (under the cloud sea)
const TOTAL = 1.9; // rise + dock-bounce seconds (confetti fires on completion)
const SWIRL = 0.4; // seconds of cloud swirl before the rise begins
const INPUT_LOCK = 0.8; // soft input lock window (skippable after this — ART §7.2)

export class ChunkArrival {
  constructor(
    private readonly world: Group,
    private readonly particles: Particles,
    private readonly audio: AudioSystem,
  ) {}

  /** Animate the chunk at (cx,cz) rising & docking. `onDock` fires once settled —
   *  the caller rebuilds the merged island there; this temp slab is then disposed. */
  play(cx: number, cz: number, onDock: () => void): void {
    const centerX = cx * CHUNK + CHUNK / 2;
    const centerZ = cz * CHUNK + CHUNK / 2;
    bus.emit('juice:setPieceStarted', { kind: 'chunk-arrival' });

    if (isReducedMotion()) {
      // particles-lite + instant dock — no rise, no input lock beyond this frame
      this.particles.sparkle(centerX, 1.0, centerZ);
      this.audio.chime();
      onDock();
      bus.emit('juice:setPieceEnded', { kind: 'chunk-arrival' });
      return;
    }

    const group = this.buildStandalone(cx, cz);
    group.position.y = -RISE_DEPTH;
    this.world.add(group);

    // cloud swirl beneath the slot
    this.particles.poof(centerX, -1.2, centerZ, 2.4);
    this.particles.dustRing(centerX, centerZ, CHUNK * 0.5);
    this.audio.plop();

    const bounce = dampedStep(0.55, 15);
    let unlocked = false;
    tweens.start({
      duration: TOTAL,
      ease: easings.linear,
      onUpdate: (t) => {
        // hold low during the swirl, then rise+bounce over the remainder
        const rise = clamp((t - SWIRL / TOTAL) / (1 - SWIRL / TOTAL), 0, 1);
        group.position.y = -RISE_DEPTH * (1 - bounce(rise));
        if (!unlocked && t * TOTAL >= INPUT_LOCK) {
          unlocked = true;
          bus.emit('juice:setPieceEnded', { kind: 'chunk-arrival' }); // input freed, still animating
        }
      },
      onComplete: () => {
        group.position.y = 0;
        // dock: fanfare + confetti + a grass-ripple of sparkles radiating outward
        this.audio.chime();
        for (let i = 0; i < 4; i++) this.particles.coinBurst(centerX + (i - 1.5) * 2.2, 1.5, centerZ);
        for (const [dx, dz] of [
          [0, 0],
          [CHUNK, 0],
          [-CHUNK, 0],
          [0, CHUNK],
          [0, -CHUNK],
        ] as const) {
          this.particles.sparkle(centerX + dx, 0.9, centerZ + dz);
        }
        onDock(); // caller swaps in the merged island…
        this.world.remove(group); // …then we drop the temp slab
        disposeObject(group);
        if (!unlocked) bus.emit('juice:setPieceEnded', { kind: 'chunk-arrival' });
      },
    });
  }

  /** A one-chunk slab with its own grass lid — square outline (all four sides show,
   *  since it's traced in isolation; the shared edge is hidden once docked). */
  private buildStandalone(cx: number, cz: number): Group {
    const blocks: Array<{ wx: number; wz: number }> = [];
    for (let bx = 0; bx < CHUNK; bx++) {
      for (let bz = 0; bz < CHUNK; bz++) {
        blocks.push({ wx: cx * CHUNK + bx, wz: cz * CHUNK + bz });
      }
    }
    const set = new Set(blocks.map((b) => `${b.wx},${b.wz}`));
    const group = buildSlabFromBlocks(blocks, (wx, wz) => set.has(`${wx},${wz}`), 1, { topQuads: true });
    group.name = 'arriving-chunk';
    return group;
  }
}
