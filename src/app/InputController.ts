/**
 * Unified pointer + keyboard input (S6, GDD §11.2): grab-the-world LMB pan,
 * RMB/MMB orbit, wheel zoom, WASD pan, Q/E azimuth snaps, R reset.
 * Click-vs-drag threshold keeps cell clicks honest. Pointer events only (touch-ready).
 */
import { Vector3 } from 'three';
import type { CameraRig } from '@/render/CameraRig';
import type { IslandModel } from '@/world/IslandModel';
import { bus } from '@/core/events';
import { worldPosToBlock } from '@/core/grid';

const DRAG_THRESHOLD_PX = 5;
const ORBIT_SPEED = 0.006;
const KEY_PAN_SPEED = 0.85; // × distance per second

export interface InputCallbacks {
  onRotate: () => void; // R — session decides: rotate ghost vs reset camera
  onEscape: () => void;
  onToggleCatalog: () => void; // B
  onToolMove: () => void; // M
  onToolRemove: () => void; // X
  onToggleDebug: () => void; // `
  onToggleAlbum: () => void; // J — Island Album
  onTogglePhoto: () => void; // P — Photo mode
  /** A clean left-click; return true to consume it (e.g. an Islander was tapped)
   *  so it never falls through to a cell click/placement. */
  onPrimaryClick?: (clientX: number, clientY: number) => boolean;
}

export class InputController {
  private dragging: { pointerId: number; button: number; lastX: number; lastY: number; movedPx: number } | null =
    null;
  private keys = new Set<string>();
  private hovered: { wx: number; wz: number } | null = null;
  private readonly ray = new Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly rig: CameraRig,
    private readonly island: IslandModel,
    private readonly callbacks: InputCallbacks,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.dragging = { pointerId: e.pointerId, button: e.button, lastX: e.clientX, lastY: e.clientY, movedPx: 0 };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragging && e.pointerId === this.dragging.pointerId) {
      const dx = e.clientX - this.dragging.lastX;
      const dy = e.clientY - this.dragging.lastY;
      this.dragging.lastX = e.clientX;
      this.dragging.lastY = e.clientY;
      this.dragging.movedPx += Math.abs(dx) + Math.abs(dy);

      if (this.dragging.movedPx > DRAG_THRESHOLD_PX) {
        if (this.dragging.button === 2 || this.dragging.button === 1) {
          // vertical orbit follows the drag: drag up tilts toward the horizon,
          // drag down lifts the camera up and over the top (un-mirrored, per feel).
          this.rig.orbitBy(-dx * ORBIT_SPEED, -dy * ORBIT_SPEED * 0.8);
        } else if (this.dragging.button === 0) {
          const wpp = this.rig.panWorldPerPixel;
          this.rig.panBy(-dx * wpp, dy * wpp);
        }
        this.setHover(null); // no cell hover mid-drag
      }
      return;
    }
    this.updateHover(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.dragging.pointerId) return;
    const wasClick = this.dragging.movedPx <= DRAG_THRESHOLD_PX && this.dragging.button === 0;
    this.dragging = null;
    if (wasClick) {
      if (this.callbacks.onPrimaryClick?.(e.clientX, e.clientY)) return; // Islander tapped
      this.updateHover(e.clientX, e.clientY);
      if (this.hovered) bus.emit('input:cellClick', { ...this.hovered });
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta = Math.max(-120, Math.min(120, e.deltaY));
    this.rig.zoomBy(1 + delta * 0.0011);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    // never steal keys from form fields (settings panel inputs)
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
    switch (e.code) {
      case 'KeyQ':
        this.rig.snapAzimuth(1);
        return;
      case 'KeyE':
        this.rig.snapAzimuth(-1);
        return;
      case 'KeyR':
        this.callbacks.onRotate();
        return;
      case 'Home':
        this.rig.reset();
        return;
      case 'Escape':
        this.callbacks.onEscape();
        return;
      case 'KeyB':
        this.callbacks.onToggleCatalog();
        return;
      case 'KeyM':
        this.callbacks.onToolMove();
        return;
      case 'KeyX':
      case 'Delete':
        this.callbacks.onToolRemove();
        return;
      case 'KeyJ':
        this.callbacks.onToggleAlbum();
        return;
      case 'KeyP':
        this.callbacks.onTogglePhoto();
        return;
      case 'Backquote':
        this.callbacks.onToggleDebug();
        return;
      default:
        this.keys.add(e.code);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  /** Held-key panning; called every frame. */
  update(dt: number): void {
    let right = 0;
    let forward = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;
    if (right !== 0 || forward !== 0) {
      const speed = this.rig.state.distance * KEY_PAN_SPEED * dt;
      this.rig.panBy(right * speed, forward * speed);
    }
  }

  /** Analytic ray → ground plane (y=0) → island cell. No Raycaster needed (TECH §9). */
  private updateHover(clientX: number, clientY: number): void {
    const cam = this.rig.camera;
    this.ray
      .set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1, 0.5)
      .unproject(cam)
      .sub(cam.position);
    if (this.ray.y >= -1e-6) {
      this.setHover(null);
      return;
    }
    const t = -cam.position.y / this.ray.y;
    const hx = cam.position.x + this.ray.x * t;
    const hz = cam.position.z + this.ray.z * t;
    const { wx, wz } = worldPosToBlock(hx, hz);
    this.setHover(this.island.hasBlock(wx, wz) ? { wx, wz } : null);
  }

  private setHover(cell: { wx: number; wz: number } | null): void {
    const same =
      (cell === null && this.hovered === null) ||
      (cell !== null && this.hovered !== null && cell.wx === this.hovered.wx && cell.wz === this.hovered.wz);
    if (same) return;
    this.hovered = cell;
    bus.emit('input:cellHover', cell);
  }
}
