/**
 * Renderer setup per ART §4: ACES tone mapping, sRGB output, soft shadows,
 * pixel-ratio cap from quality config (TECH §6).
 */
import {
  WebGLRenderer,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  PCFSoftShadowMap,
  type Scene,
  type Camera,
} from 'three';
import type { QualityConfig } from './Quality';

export class RendererManager {
  readonly renderer: WebGLRenderer;
  private pixelRatioCap = 2;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const gl = this.renderer.getContext();
    if (!(gl instanceof WebGL2RenderingContext)) {
      this.renderer.dispose();
      throw new Error('webgl2-unsupported');
    }
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.applySize();
  }

  applyQuality(config: QualityConfig): void {
    this.pixelRatioCap = config.pixelRatioCap;
    this.renderer.shadowMap.enabled = config.shadowsEnabled;
    // Force shadow/material recompile after toggling shadows.
    this.renderer.shadowMap.needsUpdate = true;
    this.applySize();
  }

  applySize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.pixelRatioCap));
    this.renderer.setSize(w, h, false);
  }

  get aspect(): number {
    return window.innerWidth / Math.max(window.innerHeight, 1);
  }

  render(scene: Scene, camera: Camera): void {
    this.renderer.render(scene, camera);
  }

  get info() {
    return this.renderer.info;
  }
}
