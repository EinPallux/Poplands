/**
 * App orchestrator (S1): builds the world, wires systems into the loop, owns boot.
 * Order of the frame: input → camera → tweens → sky/ambient → debug → render.
 */
import { Scene, Fog, Group } from 'three';
import { RendererManager } from '@/render/RendererManager';
import { CameraRig } from '@/render/CameraRig';
import { Lights } from '@/render/Lights';
import { Sky } from '@/render/Sky';
import { QualityProbe, QUALITY_PRESETS, type QualityConfig } from '@/render/Quality';
import { AssetRegistry } from '@/assets/AssetRegistry';
import { IslandModel } from '@/world/IslandModel';
import { buildGround } from '@/world/GroundBuilder';
import { buildIslandBase } from '@/world/SlabBuilder';
import { buildStarterIsland } from '@/world/StarterIsland';
import { buildIslet } from '@/world/IsletBuilder';
import { HoverHighlight } from '@/world/HoverHighlight';
import { GameLoop } from '@/app/GameLoop';
import { InputController } from '@/app/InputController';
import { LoadingScreen } from '@/ui/LoadingScreen';
import { DebugHud } from '@/debug/DebugHud';
import { palette } from '@/render/palette';
import { tweens } from '@/core/tween';
import { t } from '@/core/strings';
import { bus } from '@/core/events';

export class App {
  static async boot(canvas: HTMLCanvasElement, uiRoot: HTMLElement): Promise<void> {
    const loading = new LoadingScreen(uiRoot);

    let rendererManager: RendererManager;
    try {
      rendererManager = new RendererManager(canvas);
    } catch {
      loading.showError(t('error.webgl'));
      return;
    }

    try {
      await App.start(rendererManager, uiRoot, loading);
    } catch (err) {
      console.error('[boot]', err);
      loading.showError(t('error.boot'));
    }
  }

  private static async start(
    rm: RendererManager,
    uiRoot: HTMLElement,
    loading: LoadingScreen,
  ): Promise<void> {
    const scene = new Scene();
    scene.fog = new Fog(palette.fog, 150, 420);

    const lights = new Lights();
    scene.add(lights.group);

    const sky = new Sky(lights.sunDirection);
    scene.add(sky.group);

    const rig = new CameraRig(rm.aspect);

    // — assets (boot phase; loading bar listens on the bus)
    const assets = new AssetRegistry();
    await assets.loadBoot(import.meta.env.BASE_URL);

    // — the island
    const island = new IslandModel([
      { cx: 0, cz: 0 },
      { cx: 1, cz: 0 },
      { cx: 0, cz: 1 },
      { cx: 1, cz: 1 },
    ]);
    const world = new Group();
    world.name = 'island';
    world.add(buildGround(island));
    world.add(buildIslandBase(island));
    const starter = buildStarterIsland(assets);
    world.add(starter.group);
    scene.add(world);

    const hover = new HoverHighlight();
    scene.add(hover.mesh);

    const bounds = island.bounds();
    lights.fitShadowsTo(bounds);
    rig.frameIsland(bounds);
    const center = island.center();
    sky.setCenter(center.x, center.z);
    for (let i = 0; i < 3; i++) sky.addIslet(buildIslet(assets, i), i);

    // — quality: start high, probe steps down if needed
    let quality: QualityConfig = QUALITY_PRESETS.high;
    sky.buildClouds(quality.cloudCount);
    const applyQuality = (config: QualityConfig) => {
      quality = config;
      rm.applyQuality(config);
      lights.applyQuality(config);
      sky.buildClouds(config.cloudCount);
    };
    const probe = new QualityProbe('high', applyQuality);

    // — loop wiring
    const loop = new GameLoop();
    const debugHud = new DebugHud(uiRoot, rm.renderer, loop, rig);
    const input = new InputController(rm.canvas, rig, island, () => debugHud.toggle());

    loop.add((dt) => input.update(dt));
    loop.add((dt) => rig.update(dt));
    loop.add((dt) => tweens.update(dt));
    loop.add((dt) => sky.update(dt));
    loop.add((dt) => starter.update(dt));
    loop.add((dt) => hover.update(dt));
    loop.add((dt) => probe.update(dt));
    loop.add((dt) => debugHud.update(dt));
    loop.add(() => rm.render(scene, rig.camera));

    window.addEventListener('resize', () => {
      rm.applySize();
      rig.setAspect(rm.aspect);
    });

    // — go: first frame behind the overlay, then fade + swoop
    loop.start();
    loading.dismiss();
    rig.introSwoop();
    bus.emit('app:ready', undefined);
    void quality;

    // Dev handle for the debug console & headless probes (?debug=1 only).
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      (window as unknown as Record<string, unknown>)['__poplands'] = { scene, rig, rm, sky };
    }
  }
}
