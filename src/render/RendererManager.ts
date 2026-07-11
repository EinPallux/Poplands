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
  /** True between `webglcontextlost` and `webglcontextrestored` — rendering is a
   *  no-op (and would spam GL errors) while the GPU context is gone. */
  private contextLost = false;

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

    // GPU context can vanish on a tab-switch, driver reset, or laptop GPU swap.
    // The default browser behaviour is to give up permanently — calling
    // preventDefault() on the loss event lets the browser fire a restore, after
    // which three.js re-uploads GPU resources lazily on the next render (the
    // Placements-are-truth model means nothing is lost — the scene graph survives
    // in JS). We just gate rendering in between and refresh size/shadows on return.
    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        this.contextLost = true;
        console.warn('[render] WebGL context lost — pausing draws until it is restored');
      },
      false,
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.contextLost = false;
        this.renderer.shadowMap.needsUpdate = true;
        this.applySize();
        console.info('[render] WebGL context restored');
      },
      false,
    );
  }

  get isContextLost(): boolean {
    return this.contextLost;
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
    if (this.contextLost) return; // GPU context gone — skip until restored
    this.renderer.render(scene, camera);
  }

  get info() {
    return this.renderer.info;
  }
}
