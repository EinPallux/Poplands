/**
 * Ambient sky life (S19/S20, v0.5): the little events that make the diorama feel
 * inhabited — fireflies twinkling low over the island at night, the odd shooting
 * star streaking the dark sky, and a stray hot-air balloon drifting past by day.
 * All driven by the day-night `nightFactor` and long random timers (never busy).
 * Reduced-motion collapses to stillness. Emits `event:shootingStar` for a wish chime.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Texture,
} from 'three';
import { bus } from '@/core/events';
import { isReducedMotion } from '@/core/settingsStore';
import { TAU } from '@/core/math';

function makeGlowTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

interface Firefly {
  sprite: Sprite;
  angle: number;
  radius: number;
  speed: number;
  y: number;
  phase: number;
}

const FIREFLY_COUNT = 16;

export class AmbientLife {
  readonly group = new Group();
  private tex: Texture;
  private center = new Vector3(8, 0, 8);
  private night = 0;
  private time = 0;

  private flies: Firefly[] = [];

  private star: Sprite;
  private starT = -1; // <0 = idle, 0..1 = streaking
  private starDelay = 8 + Math.random() * 14;
  private starFrom = new Vector3();
  private starTo = new Vector3();

  private balloon: Group;
  private balloonT = -1;
  private balloonDelay = 30 + Math.random() * 40;

  constructor() {
    this.group.name = 'ambient';
    this.tex = makeGlowTexture();

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: this.tex,
          color: new Color('#eaff9a'),
          blending: AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0,
          fog: false,
        }),
      );
      sprite.scale.setScalar(0.3);
      this.group.add(sprite);
      this.flies.push({
        sprite,
        angle: Math.random() * TAU,
        radius: 3 + Math.random() * 9,
        speed: (0.1 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1),
        y: 0.4 + Math.random() * 1.6,
        phase: Math.random() * TAU,
      });
    }

    this.star = new Sprite(
      new SpriteMaterial({
        map: this.tex,
        color: new Color('#ffffff'),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
        fog: false,
      }),
    );
    this.star.scale.set(6, 1.4, 1); // a stretched streak
    this.group.add(this.star);

    this.balloon = makeBalloon();
    this.balloon.visible = false;
    this.group.add(this.balloon);
  }

  setCenter(x: number, z: number): void {
    this.center.set(x, 0, z);
  }

  update(dt: number, nightFactor: number): void {
    this.night = nightFactor;
    this.time += dt;
    if (isReducedMotion()) {
      // hold fireflies dim-steady, no launches
      for (const f of this.flies) f.sprite.material.opacity = 0.18 * nightFactor;
      return;
    }
    this.updateFireflies(dt);
    this.updateStar(dt);
    this.updateBalloon(dt);
  }

  private updateFireflies(dt: number): void {
    for (const f of this.flies) {
      f.angle += f.speed * dt;
      const bob = Math.sin(this.time * 1.3 + f.phase) * 0.25;
      f.sprite.position.set(
        this.center.x + Math.cos(f.angle) * f.radius,
        f.y + bob,
        this.center.z + Math.sin(f.angle) * f.radius,
      );
      const flicker = 0.55 + 0.45 * Math.sin(this.time * 3 + f.phase);
      f.sprite.material.opacity = this.night * flicker * 0.9;
    }
  }

  private updateStar(dt: number): void {
    if (this.starT < 0) {
      this.starDelay -= dt;
      if (this.starDelay <= 0 && this.night > 0.55) {
        this.launchStar();
      } else if (this.starDelay <= 0) {
        this.starDelay = 6 + Math.random() * 8; // retry soon once it's dark
      }
      return;
    }
    this.starT += dt / 1.05;
    const t = this.starT;
    this.star.position.lerpVectors(this.starFrom, this.starTo, t);
    this.star.material.opacity = Math.sin(Math.min(1, t) * Math.PI) * 0.95; // fade in/out
    if (t >= 1) {
      this.starT = -1;
      this.star.material.opacity = 0;
      this.starDelay = 16 + Math.random() * 26;
    }
  }

  private launchStar(): void {
    this.starT = 0;
    const c = this.center;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.starFrom.set(c.x - side * 60, 46 + Math.random() * 18, c.z - 40 + Math.random() * 80);
    this.starTo.set(c.x + side * 55, 30 + Math.random() * 14, c.z - 30 + Math.random() * 60);
    bus.emit('event:shootingStar', undefined);
  }

  private updateBalloon(dt: number): void {
    if (this.balloonT < 0) {
      this.balloonDelay -= dt;
      if (this.balloonDelay <= 0 && this.night < 0.35) {
        this.balloonT = 0;
        this.balloon.visible = true;
      } else if (this.balloonDelay <= 0) {
        this.balloonDelay = 12 + Math.random() * 12;
      }
      return;
    }
    this.balloonT += dt / 26; // a slow ~26 s drift across
    const c = this.center;
    const t = this.balloonT;
    this.balloon.position.set(c.x - 55 + t * 110, 16 + Math.sin(t * Math.PI) * 6, c.z - 30);
    this.balloon.rotation.y = this.time * 0.2;
    if (t >= 1) {
      this.balloonT = -1;
      this.balloon.visible = false;
      this.balloonDelay = 45 + Math.random() * 60;
    }
  }
}

/** A tiny low-poly hot-air balloon: a colored envelope + a little basket. */
function makeBalloon(): Group {
  const g = new Group();
  const envelope = new Mesh(
    new SphereGeometry(2.2, 12, 10),
    new MeshStandardMaterial({ color: '#ff8a70', emissive: '#ff8a70', emissiveIntensity: 0.15, flatShading: true, roughness: 1 }),
  );
  envelope.scale.set(1, 1.25, 1);
  envelope.position.y = 2.5;
  envelope.castShadow = false;
  const basket = new Mesh(
    new SphereGeometry(0.5, 6, 5),
    new MeshStandardMaterial({ color: '#8a5a3a', flatShading: true, roughness: 1 }),
  );
  basket.scale.set(1, 0.7, 1);
  g.add(envelope, basket);
  return g;
}
