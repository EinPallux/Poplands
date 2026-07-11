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
import { TimeOfDay } from '@/render/TimeOfDay';
import { QualityProbe, QUALITY_PRESETS, type QualityConfig } from '@/render/Quality';
import { AssetRegistry } from '@/assets/AssetRegistry';
import { buildGround } from '@/world/GroundBuilder';
import { buildIslandBase } from '@/world/SlabBuilder';
import { buildLandmarks } from '@/world/StarterIsland';
import { buildIslet } from '@/world/IsletBuilder';
import { HoverHighlight } from '@/world/HoverHighlight';
import { PropRenderer } from '@/world/PropRenderer';
import { AgentRenderer } from '@/world/AgentRenderer';
import { GlowLayer } from '@/world/GlowLayer';
import { AmbientLife } from '@/world/AmbientLife';
import { ThemeAmbience } from '@/world/ThemeAmbience';
import { AuroraLayer } from '@/world/AuroraLayer';
import { ChunkArrival } from '@/world/ChunkArrival';
import { LivelinessSystem } from '@/sim/LivelinessSystem';
import { disposeObject } from '@/world/dispose';
import { BuildSession } from '@/build/BuildSession';
import { GameState } from '@/app/GameState';
import { GameLoop } from '@/app/GameLoop';
import { InputController } from '@/app/InputController';
import { LoadingScreen } from '@/ui/LoadingScreen';
import { BuildBar } from '@/ui/BuildBar';
import { SettingsPanel } from '@/ui/SettingsPanel';
import { Hud } from '@/ui/Hud';
import { Mailbox } from '@/ui/Mailbox';
import { Album } from '@/ui/Album';
import { PhotoMode } from '@/ui/PhotoMode';
import { WorldFx } from '@/ui/WorldFx';
import { SurveyLayer } from '@/ui/SurveyLayer';
import { SecretLayer } from '@/ui/SecretLayer';
import { SpeechLayer } from '@/ui/SpeechLayer';
import { ChunkPopup } from '@/ui/ChunkPopup';
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
import { qualitySignal, timeOfDaySignal, fpsCapSignal, uiScaleSignal } from '@/core/settingsStore';
import { popsSignal, stardustSignal, levelSignal, xpSignal } from '@/core/playerStore';
import { effect } from '@/core/signals';
import { footprintCenter, type ChunkTheme } from '@/core/grid';
import { itemDef, CATALOG } from '@/content/catalog';
import type { AssetPhase } from '@/content/assetPhases';
import { themeFor } from '@/content/themes';

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
    const fog = new Fog(palette.fog, 150, 420);
    scene.fog = fog;

    const lights = new Lights();
    scene.add(lights.group);
    const sky = new Sky(lights.sunDirection);
    scene.add(sky.group);
    const timeOfDay = new TimeOfDay(lights, sky, fog); // day-night cycle (S7)
    const rig = new CameraRig(rm.aspect);

    // — assets, then state
    const assets = new AssetRegistry();
    await assets.loadBoot(import.meta.env.BASE_URL); // boot wave only: Tiers 1–4 + agents
    const state = new GameState();
    const island = state.island;

    // Returning-save guard (S4 §6.1): boot carries only Tiers 1–4 + agents, so a
    // veteran's Tier-5+/themed buildings would miss the cache. Await exactly the
    // phases this save actually places, before projecting any of it — every
    // downstream synchronous show()/rebuildAll keeps its throw-free contract.
    const neededPhases = new Set<AssetPhase>();
    for (const p of island.allPlacements()) {
      const def = itemDef(p.def);
      if (def) neededPhases.add(assets.phaseOf(def.model) ?? 'boot');
    }
    neededPhases.delete('boot');
    if (neededPhases.size) await Promise.all([...neededPhases].map((ph) => assets.loadPhase(ph)));

    // — world visuals. Ground + base are held by ref so a chunk purchase can
    // rebuild them for the new island shape (the outline/slab re-trace organically).
    const world = new Group();
    world.name = 'island';
    let groundGroup = buildGround(island);
    let baseGroup = buildIslandBase(island);
    world.add(groundGroup, baseGroup);
    const landmarks = buildLandmarks(assets, island);
    world.add(landmarks.group);
    scene.add(world);

    const rebuildIsland = (): void => {
      world.remove(groundGroup, baseGroup);
      disposeObject(groundGroup);
      disposeObject(baseGroup);
      groundGroup = buildGround(island);
      baseGroup = buildIslandBase(island);
      world.add(groundGroup, baseGroup);
    };

    const props = new PropRenderer(assets, island); // island → auto-tiling neighbour lookup
    scene.add(props.group);
    props.rebuildAll(island.allPlacements());

    const agents = new AgentRenderer(assets); // Tier C: animated Islanders (S16)
    scene.add(agents.group);
    const palAgents = new AgentRenderer(assets, { targetHeight: 0.7 }); // Pals (S18) — smaller
    scene.add(palAgents.group);
    const glow = new GlowLayer(island); // lantern/lamp halos at night (S7/S20)
    scene.add(glow.group);
    const ambient = new AmbientLife(); // fireflies, shooting stars, balloons (S19)
    scene.add(ambient.group);
    const themeAmbience = new ThemeAmbience(island); // per-biome mist/bats, snow, sand (S20)
    scene.add(themeAmbience.group);
    const aurora = new AuroraLayer(island); // The Wonder's permanent aurora (S20 capstone)
    scene.add(aurora.group);
    // a lively island quietly pays a little extra (S13 liveliness dividend), lifted
    // island-wide by each Grand Assembly Hall (+5% each, capped at +20%).
    const livelinessBonus = (): number => {
      let sum = 0;
      for (const p of island.allPlacements()) sum += itemDef(p.def)?.livelinessBonus ?? 0;
      return Math.min(sum, 0.2);
    };
    const liveliness = new LivelinessSystem(
      state.economy,
      () => state.islanders.snapshot().residents.length + state.pals.snapshot().pals.length,
      livelinessBonus,
    );
    {
      const c = island.center();
      ambient.setCenter(c.x, c.z);
    }

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
    state.setCarriedProvider(() => session.carriedPlacement); // carried item survives a mid-move save
    const audio = new AudioSystem();
    const chunkArrival = new ChunkArrival(world, particles, audio);

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

    // — The Wonder capstone (S20): a big one-time "you built it" moment. Only a real
    // build fires it (`!silent`); load/rebuild re-shows the aurora quietly.
    bus.on('item:placed', (e) => {
      if (e.silent || e.def !== 'decor.the-wonder') return;
      const def = itemDef(e.def)!;
      const c = footprintCenter(e.wx, e.wz, def.footprint, e.rot);
      for (let i = 0; i < 4; i++) particles.coinBurst(c.x, 1.6 + i * 0.4, c.z);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        particles.sparkle(c.x + Math.cos(a) * 2.4, 1.4, c.z + Math.sin(a) * 2.4);
      }
      audio.chunkArrival(); // the whoosh→thunk→fanfare cue
      rig.frameIsland(island.bounds()); // ease out to take in the whole island
      showToast(t('toast.wonderBuilt'));
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

    // — expansion (F2): the chunk-arrival set piece, then swap in the merged island.
    bus.on('chunk:unlocked', (e) => chunkArrival.play(e.cx, e.cz, rebuildIsland));
    // geometry changed → ease the camera out + refit shadows + recenter the sky
    // (immediate, while the chunk rises; the rig eases, never snaps — ART rule 6).
    bus.on('island:grew', () => {
      const b = island.bounds();
      lights.fitShadowsTo(b);
      rig.frameIsland(b);
      const c = island.center();
      sky.setCenter(c.x, c.z);
      ambient.setCenter(c.x, c.z);
    });

    // — a shooting star: a soft wish chime + a sparkle high in the sky
    bus.on('event:shootingStar', () => {
      audio.chime();
      const c = island.center();
      particles.sparkle(c.x, 6, c.z);
    });

    // — secrets (S19): escalating dig poofs, then the discovery payoff
    bus.on('secret:progress', (e) => {
      particles.poof(e.wx + 0.5, 0.4, e.wz + 0.5, 1.1 + e.clicks * 0.3);
      audio.plop();
    });
    bus.on('secret:found', (e) => {
      particles.coinBurst(e.wx + 0.5, 1.2, e.wz + 0.5);
      particles.sparkle(e.wx + 0.5, 1.0, e.wz + 0.5);
      audio.chime();
      showToast(t('toast.secretFound'));
    });

    // — islanders (S16): a gentle welcome sparkle where a neighbour moves in (the
    // full walk-in-from-the-edge move-in moment lands in a later v0.5 slice).
    bus.on('npc:arrived', (e) => {
      const a = state.islanders.agents.find((ag) => ag.id === e.id);
      if (a) {
        particles.sparkle(a.x, 0.9, a.z);
        particles.coinBurst(a.x, 1.2, a.z);
      }
      audio.chime();
      showToast(t('toast.npcArrived').replace('{name}', t(e.nameKey)));
    });
    // tap-to-greet: a cute babble when an Islander speaks (bubble handled by SpeechLayer)
    bus.on('npc:spoke', () => audio.chatter());

    // — pals (S18): adoption welcome + petting hearts
    bus.on('pal:adopted', (e) => {
      const p = state.pals.positionOf(e.id);
      if (p) {
        particles.sparkle(p.x, 0.5, p.z);
        particles.hearts(p.x, 0.7, p.z);
      }
      audio.chime();
      showToast(t('toast.palAdopted').replace('{pal}', t(e.nameKey)));
    });
    bus.on('pal:petted', (e) => {
      const p = state.pals.positionOf(e.id);
      if (p) particles.hearts(p.x, 0.8, p.z);
      audio.pet();
    });

    // — UI (thumbnails render post-boot; they'd otherwise delay first frame)
    initToasts(uiRoot);
    const hud = new Hud(uiRoot);
    new Mailbox(uiRoot);
    const worldFx = new WorldFx(
      uiRoot,
      (x, y, z) => rig.projectToScreen(x, y, z),
      hud.popsAnchor,
      state.economy,
      island,
    );
    const surveyLayer = new SurveyLayer(uiRoot, (x, y, z) => rig.projectToScreen(x, y, z));
    const secretLayer = new SecretLayer(uiRoot, (x, y, z) => rig.projectToScreen(x, y, z));
    const speechLayer = new SpeechLayer(uiRoot, (x, y, z) => rig.projectToScreen(x, y, z));
    new ChunkPopup(uiRoot); // self-wires to chunk:unlocked
    const album = new Album(uiRoot, () => ({
      milestones: state.save.quests.milestones,
      residents: state.islanders.snapshot().residents,
      pals: state.pals.snapshot().pals,
      themes: island.allChunks().map((c) => island.themeAt(c.cx, c.cz)),
    }));
    const photo = new PhotoMode(uiRoot, () => {
      rm.render(scene, rig.camera); // one fresh frame, then read it back
      return rm.renderer.domElement.toDataURL('image/png');
    });
    const buildBar = new BuildBar(uiRoot);
    setTimeout(() => buildBar.setThumbnails(renderThumbnails(assets)), 80);
    // — phased asset streaming (S4 §5): later waves fetch in the background so first
    // paint waits only on boot. Each trigger is idempotent (loadPhase no-ops if done);
    // thumbnails re-render in place as each wave lands (BuildBar.setThumbnails is additive).
    const themeForTier = (tier: number): ChunkTheme | undefined =>
      CATALOG.find((d) => d.tier === tier)?.theme;
    bus.on('level:up', (e) => {
      if (e.level >= 5) void assets.loadPhase('early'); // net if requestIdleCallback never fired (backgrounded tab)
      const theme = e.unlockedTier != null ? themeForTier(e.unlockedTier) : undefined;
      if (theme) void assets.loadPhase(`themed:${theme}`); // a biome tier just unlocked → fetch its set
    });
    bus.on('chunk:unlocked', (e) => {
      if (e.theme !== 'meadow') void assets.loadPhase(`themed:${e.theme}`); // biome arriving → prefetch its props
    });
    bus.on('assets:phaseLoaded', () => buildBar.setThumbnails(renderThumbnails(assets)));
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

    // — UI scale (S23): drive one CSS custom property; chrome widgets opt in via
    // scale(var(--ui-scale)) around their own anchor edge (never uiRoot itself, so
    // world-anchored layers stay pixel-locked to their 3D anchors).
    effect(() => {
      document.documentElement.style.setProperty('--ui-scale', String(uiScaleSignal.get()));
    });

    // — loop
    const loop = new GameLoop();
    effect(() => {
      const cap = fpsCapSignal.get();
      loop.setFpsCap(cap === 'off' ? 0 : Number(cap)); // S23 frame cap
    });
    const debugHud = new DebugHud(uiRoot, rm.renderer, loop, rig, props);
    const input = new InputController(rm.canvas, rig, island, {
      onRotate: () => {
        if (session.ghostObject) session.rotate();
        else rig.reset();
      },
      onEscape: () => {
        if (photo.active) photo.toggle(false);
        else if (album.open) album.toggle(false);
        else if (settings.open) settings.toggle(false);
        else if (session.isActive) session.cancel();
      },
      onToggleCatalog: () => catalogOpenSignal.update((v) => !v),
      onToolMove: () => bus.emit('cmd:setTool', { tool: 'move' }),
      onToolRemove: () => bus.emit('cmd:setTool', { tool: 'remove' }),
      onToggleDebug: () => debugHud.toggle(),
      onToggleAlbum: () => album.toggle(),
      onTogglePhoto: () => photo.toggle(),
      // tap an Islander to greet / a Pal to pet (when not mid-build) — consumes the click
      onPrimaryClick: (x, y) => {
        if (session.isActive) return false;
        const npc = agents.pickAt(x, y, rig.camera);
        if (npc) {
          bus.emit('cmd:clickNpc', { id: npc });
          return true;
        }
        const pal = palAgents.pickAt(x, y, rig.camera);
        if (pal) {
          bus.emit('cmd:clickPal', { id: pal });
          return true;
        }
        return false;
      },
    });

    // soft input-lock during the chunk-arrival set piece (first 0.8 s): the camera
    // still eases (rig.update runs below) — only manual input is gated (ART §7.2).
    let setPiece = false;
    bus.on('juice:setPieceStarted', () => (setPiece = true));
    bus.on('juice:setPieceEnded', () => (setPiece = false));

    loop.add((dt) => {
      if (!setPiece) input.update(dt);
    });
    loop.add((dt) => session.update(dt));
    loop.add((dt) => state.economy.tick(dt));
    loop.add(() => state.quests.tick()); // refill postcard slots once a cooldown lapses
    loop.add((dt) => {
      state.islanders.update(dt); // sim integrates kinematics (three.js-free)…
      agents.sync(state.islanders.agents, dt); // …then Tier C projects + animates
      speechLayer.update(state.islanders.agents, dt); // bubbles track their speaker
      state.pals.update(dt);
      palAgents.sync(state.pals.agents, dt);
    });
    loop.add((dt) => rig.update(dt));
    loop.add((dt) => tweens.update(dt));
    loop.add((dt) => {
      timeOfDay.update(dt); // advance dawn→day→dusk→night, tint lights/sky/fog
      glow.update(timeOfDay.nightFactor); // lantern halos fade in with the dark
      ambient.update(dt, timeOfDay.nightFactor); // fireflies, shooting stars, balloons
      themeAmbience.update(dt, timeOfDay.nightFactor); // per-biome mist/bats/snow/sand
      aurora.update(dt, timeOfDay.nightFactor); // The Wonder's aurora shimmer (S20)
      liveliness.update(dt); // periodic Pops dividend from the island's residents
    });
    // ambient audio bed (S22): a single spaced chirp/cricket — never a machine-gun
    let ambientSoundIn = 3 + Math.random() * 4;
    loop.add((dt) => {
      ambientSoundIn -= dt;
      if (ambientSoundIn > 0) return;
      ambientSoundIn = 4 + Math.random() * 6;
      if (timeOfDay.nightFactor > 0.5) audio.cricket();
      else audio.chirp();
    });
    loop.add((dt) => sky.update(dt));
    loop.add((dt) => landmarks.update(dt));
    loop.add((dt) => particles.update(dt));
    loop.add(() => worldFx.update());
    loop.add(() => surveyLayer.update());
    loop.add(() => secretLayer.update());
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

    // — background-load the `early` wave (Tiers 5–14, no biome) once the boot frame
    // is settled. A cozy player takes many minutes to reach Tier 5, so this ~5 MB
    // wave has ample cover; `level:up` above is the safety net if idle never fires.
    const whenIdle = (fn: () => void): void => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
        .requestIdleCallback;
      if (ric) ric(fn, { timeout: 4000 });
      else setTimeout(fn, 1500);
    };
    whenIdle(() => void assets.loadPhase('early'));

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
        wallet: () => ({
          pops: popsSignal.get(),
          stardust: stardustSignal.get(),
          level: levelSignal.get(),
          xp: xpSignal.get(),
        }),
        quests: () => state.save.quests,
        surveys: () => state.expansion.surveys(),
        buyChunk: (cx: number, cz: number) => bus.emit('cmd:buyChunk', { cx, cz }),
        chunkCount: () => island.chunkCount,
        secrets: () => state.secrets.snapshot(),
        clickSecret: (cx: number, cz: number) => bus.emit('cmd:clickSecret', { cx, cz }),
        milestones: () => state.save.quests.milestones,
        islanders: () =>
          state.islanders.agents.map((a) => ({ id: a.id, x: a.x, z: a.z, yaw: a.yaw, moving: a.moving })),
        residents: () => state.islanders.snapshot().residents.slice(),
        agentMeshes: () => agents.count,
        clickNpc: (id: string) => bus.emit('cmd:clickNpc', { id }),
        pals: () => state.pals.agents.map((a) => ({ id: a.id, x: a.x, z: a.z, moving: a.moving })),
        palRoster: () => state.pals.snapshot().pals.slice(),
        palMeshes: () => palAgents.count,
        clickPal: (id: string) => bus.emit('cmd:clickPal', { id }),
        tileShapes: () =>
          island
            .allPlacements()
            .filter((p) => itemDef(p.def)?.tileKit)
            .map((p) => ({ wx: p.wx, wz: p.wz, shape: props.shapeOf(p.id) })),
        setTime: (mode: 'auto' | 'day' | 'dusk' | 'night') => timeOfDaySignal.set(mode),
        nightFactor: () => timeOfDay.nightFactor,
        glowCount: () => glow.count,
        auroraCount: () => aurora.count,
        themeAmbience: () => themeAmbience.counts,
        // — S4 phased loading (headless verify): which models are cached now + on-demand phase loads
        loadPhase: (phase: AssetPhase) => assets.loadPhase(phase),
        phaseOf: (id: string) => assets.phaseOf(id),
        loadedModels: () => CATALOG.filter((d) => assets.has(d.model)).length,
        modelLoaded: (id: string) => assets.has(itemDef(id)?.model ?? id),
        /** Debug soak (non-persistent): grow the lattice to N chunks + rebuild once,
         *  skipping economy/arrival — for the draw/tri budget measurement only. */
        growTo: (n: number) => {
          let guard = 0;
          while (island.chunkCount < n && guard++ < 200) {
            const slots = island.expandableSlots();
            if (slots.length === 0) break;
            // grow toward the centroid → a compact blob (realistic + a fair worst
            // case: more perimeter than a strip means more traced-slab triangles)
            const cs = island.allChunks();
            let mx = 0;
            let mz = 0;
            for (const c of cs) {
              mx += c.cx;
              mz += c.cz;
            }
            mx /= cs.length;
            mz /= cs.length;
            let best = slots[0]!;
            let bestD = Infinity;
            for (const s of slots) {
              const d = (s.cx - mx) ** 2 + (s.cz - mz) ** 2;
              if (d < bestD) {
                bestD = d;
                best = s;
              }
            }
            island.addChunk(best.cx, best.cz, themeFor(state.save.seed, best.cx, best.cz));
          }
          rebuildIsland();
          themeAmbience.rescan(); // debug growth bypasses chunk:unlocked
          const b = island.bounds();
          lights.fitShadowsTo(b);
          rig.frameIsland(b);
        },
        stats: () => ({ draws: rm.renderer.info.render.calls, tris: rm.renderer.info.render.triangles }),
        /** Debug placement (bypasses payment) — for headless verification only. */
        place: (def: string, wx: number, wz: number, rot: 0 | 1 | 2 | 3 = 0) => {
          const d = itemDef(def);
          if (!d || !island.canPlace(d, wx, wz, rot).ok) return false;
          const p = island.place(def, wx, wz, rot);
          bus.emit('item:placed', { id: p.id, def, wx, wz, rot });
          return true;
        },
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
