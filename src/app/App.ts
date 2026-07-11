/**
 * App orchestrator (S1): builds the world, wires systems into the loop, owns boot.
 * Frame order: input → session → camera → tweens → sky/ambient → particles →
 * debug → render. Presentation reacts to domain events; sim never sees three.js.
 */
import { Scene, Fog, Group, Vector3 } from 'three';
import { RendererManager } from '@/render/RendererManager';
import { CameraRig } from '@/render/CameraRig';
import { Lights } from '@/render/Lights';
import { Sky } from '@/render/Sky';
import { QualityProbe, QUALITY_PRESETS, type QualityConfig } from '@/render/Quality';
import { AssetRegistry } from '@/assets/AssetRegistry';
import { buildGround } from '@/world/GroundBuilder';
import { buildIslandBase } from '@/world/SlabBuilder';
import { buildLandmarks } from '@/world/StarterIsland';
import { buildIslet } from '@/world/IsletBuilder';
import { HoverHighlight } from '@/world/HoverHighlight';
import { PropRenderer } from '@/world/PropRenderer';
import { BuildSession } from '@/build/BuildSession';
import { GameState } from '@/app/GameState';
import { GameLoop } from '@/app/GameLoop';
import { InputController } from '@/app/InputController';
import { LoadingScreen } from '@/ui/LoadingScreen';
import { BuildBar } from '@/ui/BuildBar';
import { SettingsPanel } from '@/ui/SettingsPanel';
import { Hud } from '@/ui/Hud';
import { Mailbox } from '@/ui/Mailbox';
import { WorldFx } from '@/ui/WorldFx';
import '@/ui/questState'; // side-effect: registers quest signal subscriptions
import { initToasts, showToast } from '@/ui/Toasts';
import { renderThumbnails } from '@/ui/thumbnails';
import { catalogOpenSignal, catalogRevealSignal } from '@/ui/uiState';
import { DebugHud } from '@/debug/DebugHud';
import { Particles } from '@/vfx/Particles';
import { popIn, popOut, shake } from '@/vfx/presets';
import { AudioSystem } from '@/audio/AudioSystem';
import { palette } from '@/render/palette';
import { tweens } from '@/core/tween';
import { t } from '@/core/strings';
import { bus } from '@/core/events';
import { qualitySignal } from '@/core/settingsStore';
import { effect } from '@/core/signals';
import { footprintCenter } from '@/core/grid';
import { itemDef } from '@/content/catalog';

const VERSION = '0.2.0';

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

    // — assets, then state
    const assets = new AssetRegistry();
    await assets.loadBoot(import.meta.env.BASE_URL);
    const state = new GameState();
    const island = state.island;

    // — world visuals
    const world = new Group();
    world.name = 'island';
    world.add(buildGround(island));
    world.add(buildIslandBase(island));
    const landmarks = buildLandmarks(assets, island);
    world.add(landmarks.group);
    scene.add(world);

    const props = new PropRenderer(assets);
    scene.add(props.group);
    props.rebuildAll(island.allPlacements());

    const hover = new HoverHighlight();
    scene.add(hover.mesh);
    const particles = new Particles();
    scene.add(particles.mesh);

    const bounds = island.bounds();
    lights.fitShadowsTo(bounds);
    rig.frameIsland(bounds);
    const center = island.center();
    sky.setCenter(center.x, center.z);
    for (let i = 0; i < 3; i++) sky.addIslet(buildIslet(assets, i), i);

    // — build mode + audio
    const session = new BuildSession(island, props, state.economy);
    scene.add(session.group);
    const audio = new AudioSystem();

    // — presentation reactions to domain events (the F1 flow)
    bus.on('item:placed', (e) => {
      const placement = { id: e.id, def: e.def, wx: e.wx, wz: e.wz, rot: e.rot };
      const def = itemDef(e.def);
      if (!def) return;
      if (e.silent) {
        props.show(placement);
        return;
      }
      const promoted = props.promote(placement);
      if (promoted) {
        popIn(promoted, def.scale, () => props.bake(placement, promoted));
      }
      const c = footprintCenter(e.wx, e.wz, def.footprint, e.rot);
      particles.dustRing(c.x, c.z, Math.max(def.footprint.w, def.footprint.d) * 0.45);
      audio.plop();
    });

    bus.on('item:removed', (e) => {
      const placement = { id: e.id, def: e.def, wx: e.wx, wz: e.wz, rot: e.rot };
      const def = itemDef(e.def);
      if (!def) return;
      if (e.silent) {
        props.hide(placement);
        return;
      }
      const extracted = props.extract(placement);
      if (extracted) {
        popOut(extracted, def.scale, () => props.finishRemove(extracted));
      }
      const c = footprintCenter(e.wx, e.wz, def.footprint, e.rot);
      particles.poof(c.x, 0.35, c.z, Math.max(def.footprint.w, def.footprint.d) * 0.6);
      audio.poof();
    });

    // move drop: gentle set-down (mini pop, soft plop — no dust/charge)
    bus.on('item:moved', (e) => {
      const def = itemDef(e.def);
      if (!def) return;
      const placement = { id: e.id, def: e.def, wx: e.wx, wz: e.wz, rot: e.rot };
      const promoted = props.promote(placement);
      if (promoted) popIn(promoted, def.scale, () => props.bake(placement, promoted));
      audio.plop();
    });

    bus.on('build:rejected', () => {
      if (session.ghostObject) shake(session.ghostObject);
      audio.thock();
    });

    bus.on('purchase:denied', () => {
      if (session.ghostObject) shake(session.ghostObject);
      audio.thock();
      showToast(t('build.blocked.afford'));
    });

    // — economy: collection commands → sim; sim's collected event → juice
    bus.on('cmd:collect', ({ placementId }) => state.economy.collect(placementId));
    bus.on('cmd:collectAll', () => state.economy.collectAll());
    bus.on('income:collected', () => audio.chime()); // coin-arc handled by WorldFx
    bus.on('income:ripe', (e) => {
      const p = island.placement(e.placementId);
      const def = p && itemDef(p.def);
      if (p && def) {
        const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
        particles.sparkle(c.x, 1.0, c.z);
      }
    });

    // — progression: level-up celebration + catalog reveal (full ring/celebrate in #26)
    bus.on('level:up', (e) => {
      if (e.silent) return;
      if (e.newItems.length) {
        catalogRevealSignal.update((prev) => new Set([...prev, ...e.newItems]));
      }
      const c = island.center();
      particles.coinBurst(c.x, 1.4, c.z);
      audio.chime();
      showToast(t('toast.levelUp').replace('{level}', String(e.level)));
    });

    // — quests: completion juice (mailbox card UI is #26). Milestones stay quiet.
    bus.on('quest:completed', (e) => {
      if (e.kind === 'milestone') return;
      const c = island.center();
      particles.coinBurst(c.x, 1.2, c.z);
      audio.chime();
      showToast(t('toast.questDone'));
    });

    // — UI (thumbnails render post-boot; they'd otherwise delay first frame)
    initToasts(uiRoot);
    const hud = new Hud(uiRoot);
    new Mailbox(uiRoot);
    const worldFx = new WorldFx(uiRoot, (x, y, z) => rig.projectToScreen(x, y, z), hud.popsAnchor);
    const buildBar = new BuildBar(uiRoot);
    setTimeout(() => buildBar.setThumbnails(renderThumbnails(assets)), 80);
    const settings = new SettingsPanel(
      uiRoot,
      () => state.exportToFile(),
      (file) => {
        void state.importFromFile(file).then((ok) => {
          if (!ok) showToast(t('settings.importFailed'));
        });
      },
      VERSION,
    );

    // — quality: explicit setting wins; 'auto' uses the probe
    const applyQuality = (config: QualityConfig) => {
      rm.applyQuality(config);
      lights.applyQuality(config);
      sky.buildClouds(config.cloudCount);
    };
    let probe: QualityProbe | null = null;
    effect(() => {
      const pref = qualitySignal.get();
      if (pref === 'auto') {
        applyQuality(QUALITY_PRESETS.high);
        probe = new QualityProbe('high', applyQuality);
      } else {
        probe = null;
        applyQuality(QUALITY_PRESETS[pref]);
      }
    });

    // — loop
    const loop = new GameLoop();
    const debugHud = new DebugHud(uiRoot, rm.renderer, loop, rig, props);
    const input = new InputController(rm.canvas, rig, island, {
      onRotate: () => {
        if (session.ghostObject) session.rotate();
        else rig.reset();
      },
      onEscape: () => {
        if (settings.open) settings.toggle(false);
        else if (session.isActive) session.cancel();
      },
      onToggleCatalog: () => catalogOpenSignal.update((v) => !v),
      onToolMove: () => bus.emit('cmd:setTool', { tool: 'move' }),
      onToolRemove: () => bus.emit('cmd:setTool', { tool: 'remove' }),
      onToggleDebug: () => debugHud.toggle(),
    });

    loop.add((dt) => input.update(dt));
    loop.add((dt) => session.update(dt));
    loop.add((dt) => state.economy.tick(dt));
    loop.add((dt) => rig.update(dt));
    loop.add((dt) => tweens.update(dt));
    loop.add((dt) => sky.update(dt));
    loop.add((dt) => landmarks.update(dt));
    loop.add((dt) => particles.update(dt));
    loop.add(() => worldFx.update());
    loop.add((dt) => hover.update(dt));
    loop.add((dt) => probe?.update(dt));
    loop.add((dt) => debugHud.update(dt));
    loop.add(() => rm.render(scene, rig.camera));

    window.addEventListener('resize', () => {
      rm.applySize();
      rig.setAspect(rm.aspect);
    });

    loop.start();
    loading.dismiss();
    rig.introSwoop();
    // presentation is subscribed now — fire the load-time ripe cascade & greet
    state.start();
    bus.emit('app:ready', undefined);

    // Dev handle for the debug console & headless verification (?debug=1 only).
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      (window as unknown as Record<string, unknown>)['__poplands'] = {
        scene,
        rig,
        rm,
        sky,
        island,
        props,
        session,
        state,
        /** Screen pixel position of a block center (headless click targeting). */
        projectCell: (wx: number, wz: number) => {
          const v = new Vector3(wx + 0.5, 0, wz + 0.5).project(rig.camera);
          return {
            x: ((v.x + 1) / 2) * window.innerWidth,
            y: ((1 - v.y) / 2) * window.innerHeight,
          };
        },
      };
    }
  }
}
