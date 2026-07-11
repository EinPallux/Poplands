/**
 * The sky stage (ART §5): gradient dome, sun glow, an infinite cloud sea far below,
 * drifting low-poly puffball clouds on two depth layers, and distant non-interactive
 * islets for parallax. Everything here is exempt from shadows and ignores fog except
 * where fog *is* the effect.
 */
import {
  BackSide,
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette';
import { mulberry32, TAU } from '@/core/math';

const DOME_RADIUS = 380;

function makeDome(): Mesh {
  const geo = new SphereGeometry(DOME_RADIUS, 32, 24);
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new Color(palette.skyZenith) },
      horizonColor: { value: new Color(palette.skyHorizon) },
      creamColor: { value: new Color(palette.skyCream) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 creamColor;
      varying vec3 vDir;
      void main() {
        float h = vDir.y; // -1 .. 1
        // Blue overhead, pale horizon, a NARROW warm cream band at the horizon,
        // then soft periwinkle below (the cloud sea covers most of it anyway).
        vec3 below = mix(horizonColor, vec3(0.78, 0.86, 0.95), smoothstep(-0.06, -0.5, h));
        vec3 up = mix(horizonColor, topColor, smoothstep(0.02, 0.45, h));
        vec3 col = h >= 0.0 ? up : below;
        col = mix(col, creamColor, exp(-abs(h) * 22.0) * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function makeSunSprite(direction: Vector3): Sprite {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 252, 240, 1)');
    g.addColorStop(0.18, 'rgba(255, 246, 214, 0.95)');
    g.addColorStop(0.45, 'rgba(255, 233, 201, 0.35)');
    g.addColorStop(1, 'rgba(255, 233, 201, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const sprite = new Sprite(
    new SpriteMaterial({
      map: new CanvasTexture(canvas),
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  sprite.position.copy(direction).multiplyScalar(DOME_RADIUS * 0.9);
  sprite.scale.setScalar(150);
  return sprite;
}

/** Two slowly-scrolling noise planes far below the island = infinite cloud ocean. */
function makeCloudSea(): { group: Group; update: (dt: number) => void; mats: ShaderMaterial[] } {
  const group = new Group();
  const mats: ShaderMaterial[] = [];
  const layers = [
    { y: -10, scale: 0.012, speed: 0.006, opacity: 0.9 },
    { y: -14, scale: 0.006, speed: 0.003, opacity: 1.0 },
  ];
  for (const layer of layers) {
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: layer.scale },
        uOpacity: { value: layer.opacity },
        uCenter: { value: new Vector3(8, 0, 8) },
        uCloud: { value: new Color(palette.cloud) },
        uShade: { value: new Color('#c9dcf0') }, // deeper than the dome so the sea reads
        uCream: { value: new Color(palette.skyCream) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vWorldXZ;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldXZ = wp.xz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uScale;
        uniform float uOpacity;
        uniform vec3 uCenter;
        uniform vec3 uCloud;
        uniform vec3 uShade;
        uniform vec3 uCream;
        varying vec2 vWorldXZ;

        // sin-free hash: the classic sin(dot())*43758 breaks on ANGLE/SwiftShader
        // (large-arg sin precision) and silently returns constants → invisible sea.
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.55;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.1 + vec2(17.3, 9.1);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 p = vWorldXZ * uScale + vec2(uTime, uTime * 0.6);
          float n = fbm(p);
          // Dense fluffy ocean with soft gaps — not sparse blobs.
          float cover = smoothstep(0.24, 0.4, n);
          vec3 col = mix(uShade, uCloud, smoothstep(0.34, 0.72, n));
          col = mix(col, uCream, 0.06);
          // Fade with distance FROM THE ISLAND so the sea melts into the horizon
          // and the dome gradient owns the upper frame (the fade IS the horizon).
          float edge = 1.0 - smoothstep(120.0, 290.0, length(vWorldXZ - uCenter.xz));
          gl_FragColor = vec4(col, cover * uOpacity * edge);
        }
      `,
    });
    mats.push(mat);
    const mesh = new Mesh(new PlaneGeometry(1000, 1000, 1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = layer.y;
    mesh.renderOrder = -1;
    group.add(mesh);
    void layer.speed;
  }
  const speeds = layers.map((l) => l.speed);
  return {
    group,
    mats,
    update: (dt) => {
      mats.forEach((m, i) => {
        const u = m.uniforms['uTime'];
        if (u) u.value += dt * (speeds[i] ?? 0.005);
      });
    },
  };
}

// Day base cloud-sea colours (lerped toward night blues by the day-night factor).
const SEA_CLOUD_DAY = new Color(palette.cloud);
const SEA_SHADE_DAY = new Color('#c9dcf0');
const SEA_CREAM_DAY = new Color(palette.skyCream);
const SEA_CLOUD_NIGHT = new Color('#3b4a78');
const SEA_SHADE_NIGHT = new Color('#232c52');
const SEA_CREAM_NIGHT = new Color('#46589a');

/** Low-poly puffball cloud: a handful of merged, squashed spheres, flat white. */
function makePuffGeometry(rng: () => number) {
  const blobs = 5 + Math.floor(rng() * 4);
  const geos = [];
  for (let i = 0; i < blobs; i++) {
    const r = 0.6 + rng() * 0.9;
    const geo = new SphereGeometry(r, 7, 5);
    geo.translate((i - blobs / 2) * 0.9 + rng() * 0.5, (rng() - 0.5) * 0.35, (rng() - 0.5) * 1.1);
    geos.push(geo);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  merged.scale(1, 0.55, 1);
  merged.computeVertexNormals();
  return merged;
}

interface Drifter {
  object: Group;
  angle: number;
  radius: number;
  height: number;
  angularSpeed: number;
  bobPhase: number;
}

export class Sky {
  readonly group = new Group();
  private readonly cloudSea: { group: Group; update: (dt: number) => void; mats: ShaderMaterial[] };
  private readonly domeMat: ShaderMaterial;
  private readonly sunSprite: Sprite;
  private puffMat: MeshStandardMaterial | null = null;
  private readonly scratch = new Color();
  private drifters: Drifter[] = [];
  private clouds: Drifter[] = [];
  private time = 0;
  private center = new Vector3(8, 0, 8);

  constructor(sunDirection: Vector3) {
    const dome = makeDome();
    this.domeMat = dome.material as ShaderMaterial;
    this.group.add(dome);
    this.sunSprite = makeSunSprite(sunDirection);
    this.group.add(this.sunSprite);
    this.cloudSea = makeCloudSea();
    this.group.add(this.cloudSea.group);
  }

  /** Re-tint the dome gradient, cloud sea, puff clouds, and sun glow for the time
   *  of day (S7). Colors are copied into the live uniforms/materials — no per-frame
   *  allocation. `night` (0 day … 1 night) darkens the cloud sea + clouds so the
   *  whole frame reads as dusk/night, not just the island. */
  setSky(top: Color, horizon: Color, cream: Color, sunOpacity: number, night: number): void {
    (this.domeMat.uniforms['topColor']!.value as Color).copy(top);
    (this.domeMat.uniforms['horizonColor']!.value as Color).copy(horizon);
    (this.domeMat.uniforms['creamColor']!.value as Color).copy(cream);
    this.sunSprite.material.opacity = sunOpacity;

    for (const m of this.cloudSea.mats) {
      (m.uniforms['uCloud']!.value as Color).copy(SEA_CLOUD_DAY).lerp(SEA_CLOUD_NIGHT, night);
      (m.uniforms['uShade']!.value as Color).copy(SEA_SHADE_DAY).lerp(SEA_SHADE_NIGHT, night);
      (m.uniforms['uCream']!.value as Color).copy(SEA_CREAM_DAY).lerp(SEA_CREAM_NIGHT, night);
    }
    if (this.puffMat) {
      this.puffMat.emissiveIntensity = 0.62 * (1 - 0.72 * night);
      this.puffMat.emissive.copy(this.scratch.setHex(0xffffff)).lerp(SEA_CLOUD_NIGHT, night);
    }
  }

  /** Puffball clouds around the island; count is quality-gated (re-callable). */
  buildClouds(count: number): void {
    for (const c of this.clouds) this.group.remove(c.object);
    this.clouds = [];
    const rng = mulberry32(20260711);
    // Self-lit soft white: real shading would give clouds dark rock-like undersides.
    const puffMat = new MeshStandardMaterial({
      color: palette.cloudShadow,
      emissive: palette.cloud,
      emissiveIntensity: 0.62,
      flatShading: true,
      roughness: 1,
      metalness: 0,
    });
    this.puffMat = puffMat; // day-night dims this at dusk
    for (let i = 0; i < count; i++) {
      const mesh = new Mesh(makePuffGeometry(rng), puffMat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const holder = new Group();
      holder.add(mesh);
      const scale = 1.4 + rng() * 1.8;
      mesh.scale.setScalar(scale);
      const layerBelow = rng() < 0.45; // some clouds BELOW the island — the altitude cue
      const drifter: Drifter = {
        object: holder,
        angle: rng() * TAU,
        radius: 34 + rng() * 46,
        height: layerBelow ? -11 + rng() * 5 : 9 + rng() * 11,
        angularSpeed: (0.008 + rng() * 0.012) * (rng() < 0.5 ? 1 : -1),
        bobPhase: rng() * TAU,
      };
      this.clouds.push(drifter);
      this.group.add(holder);
    }
  }

  /** Distant parallax islets — tiny rock+tree silhouettes orbiting far away. */
  addIslet(object: Group, index: number): void {
    const rng = mulberry32(555 + index * 97);
    const drifter: Drifter = {
      object,
      angle: (index / 3) * TAU + rng() * 0.8,
      radius: 76 + rng() * 28,
      height: -5 + rng() * 12,
      angularSpeed: 0.0035 * (index % 2 === 0 ? 1 : -1),
      bobPhase: rng() * TAU,
    };
    this.drifters.push(drifter);
    this.group.add(object);
  }

  setCenter(x: number, z: number): void {
    this.center.set(x, 0, z);
    this.cloudSea.group.position.set(x, 0, z);
    this.cloudSea.group.traverse((o) => {
      const mat = (o as Mesh).material as ShaderMaterial | undefined;
      const u = mat?.uniforms?.['uCenter'];
      if (u) (u.value as Vector3).set(x, 0, z);
    });
  }

  update(dt: number): void {
    this.time += dt;
    this.cloudSea.update(dt);
    for (const d of [...this.clouds, ...this.drifters]) {
      d.angle += d.angularSpeed * dt;
      const bob = Math.sin(this.time * 0.25 + d.bobPhase) * 0.6;
      d.object.position.set(
        this.center.x + Math.cos(d.angle) * d.radius,
        d.height + bob,
        this.center.z + Math.sin(d.angle) * d.radius,
      );
      d.object.rotation.y = -d.angle;
    }
  }
}
