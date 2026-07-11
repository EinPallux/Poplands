/**
 * Soft rounded highlight on the hovered island block (v0.1 slice of the build
 * ghost, S9/S10). Mint, gently breathing, never harsh (ART §6 grid philosophy).
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import { bus } from '@/core/events';
import { blockCenter } from '@/core/grid';

function makeRingTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const r = 22;
    const pad = 10;
    ctx.strokeStyle = 'rgba(127, 220, 164, 0.9)'; // accent mint
    ctx.lineWidth = 7;
    ctx.shadowColor = 'rgba(127, 220, 164, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, r);
    ctx.stroke();
  }
  return new CanvasTexture(canvas);
}

export class HoverHighlight {
  readonly mesh: Mesh;
  private time = 0;
  private readonly material: MeshBasicMaterial;

  constructor() {
    this.material = new MeshBasicMaterial({
      map: makeRingTexture(),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.mesh = new Mesh(new PlaneGeometry(1.04, 1.04), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.02;
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;

    bus.on('input:cellHover', (cell) => {
      if (cell === null) {
        this.mesh.visible = false;
        return;
      }
      const { x, z } = blockCenter(cell.wx, cell.wz);
      this.mesh.position.x = x;
      this.mesh.position.z = z;
      this.mesh.visible = true;
    });
  }

  update(dt: number): void {
    this.time += dt;
    this.material.opacity = 0.65 + Math.sin(this.time * 3) * 0.18;
  }
}
