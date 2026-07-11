/**
 * The Juice preset library (S11) — canonical animations from ART §7.2.
 * All world/UI motion flows through these; features never hand-roll lerps.
 * Reduced-motion handling lives HERE (per CLAUDE.md), not in callers.
 */
import type { Object3D } from 'three';
import { tweens, easings, type TweenHandle } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';

/** Placement arrival: scale 0 → overshoot → settle (ART: 280 ms backOut). */
export function popIn(obj: Object3D, targetScale: number, onDone?: () => void): TweenHandle {
  if (isReducedMotion()) {
    obj.scale.setScalar(targetScale);
    return tweens.start({ duration: 0.08, onUpdate: () => {}, onComplete: onDone });
  }
  obj.scale.setScalar(0.0001);
  return tweens.start({
    duration: 0.28,
    ease: easings.backOut,
    onUpdate: (t) => obj.scale.setScalar(Math.max(t * targetScale, 0.0001)),
    onComplete: () => {
      obj.scale.setScalar(targetScale);
      onDone?.();
    },
  });
}

/** Removal: quick squash, then shrink away (ART: 80 + 120 ms). */
export function popOut(obj: Object3D, baseScale: number, onDone: () => void): TweenHandle {
  if (isReducedMotion()) {
    return tweens.start({ duration: 0.08, onUpdate: () => {}, onComplete: onDone });
  }
  const squash = tweens.start({
    duration: 0.08,
    ease: easings.quadOut,
    onUpdate: (t) => {
      obj.scale.set(
        baseScale * (1 + 0.15 * t),
        baseScale * (1 - 0.15 * t),
        baseScale * (1 + 0.15 * t),
      );
    },
    onComplete: () => {
      tweens.start({
        duration: 0.12,
        ease: easings.backIn,
        onUpdate: (t) => obj.scale.setScalar(Math.max(baseScale * (1 - t), 0.0001)),
        onComplete: onDone,
      });
    },
  });
  return squash;
}

/** Invalid-place feedback: two quick sideways shakes (never on the camera). */
export function shake(obj: Object3D): void {
  if (isReducedMotion()) return;
  const originX = obj.position.x;
  tweens.start({
    duration: 0.18,
    ease: easings.linear,
    onUpdate: (t) => {
      obj.position.x = originX + Math.sin(t * Math.PI * 4) * 0.06 * (1 - t);
    },
    onComplete: () => {
      obj.position.x = originX;
    },
  });
}

/** Gentle idle bob for the carried item in move mode. Returns per-frame updater. */
export function carryBob(obj: Object3D, baseY: number): (dt: number) => void {
  let time = 0;
  return (dt: number) => {
    time += dt;
    const lift = isReducedMotion() ? 0.25 : 0.32 + Math.sin(time * 3.2) * 0.05;
    obj.position.y = baseY + lift;
    if (!isReducedMotion()) obj.rotation.z = Math.sin(time * 2.1) * 0.015;
  };
}
