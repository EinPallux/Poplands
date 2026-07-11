/**
 * WebAudio SFX (S22, v0.2 stub): fully synthesized — no asset files yet.
 * The signature "plop" pitch-ladders on repeated placements and resets after
 * a beat (ART §6.2 placement feel). Context unlocks lazily on first gesture.
 */
import { volumeSignal } from '@/core/settingsStore';
import { effect } from '@/core/signals';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ladder = 0;
  private lastPlopAt = 0;

  constructor() {
    effect(() => {
      const v = volumeSignal.get();
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.05);
      }
    });
  }

  /** Create/resume the context — call from user-gesture handlers only. */
  private ensure(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      const v = volumeSignal.get();
      this.master.gain.value = v * v;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Soft placement plop; consecutive placements climb a happy little ladder. */
  plop(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    if (performance.now() - this.lastPlopAt > 2000) this.ladder = 0;
    this.lastPlopAt = performance.now();
    const step = this.ladder++ % 8;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 300 * Math.pow(2, step / 12);
    osc.frequency.setValueAtTime(base * 1.7, now);
    osc.frequency.exponentialRampToValueAtTime(base, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Dull "uh-uh" for an invalid placement attempt. */
  thock(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** Bright two-note chime when Pops are collected. */
  chime(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    for (const [i, freq] of [880, 1318.5].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.28);
    }
  }

  /**
   * The chunk-arrival signature (S22, GDD §13): a rising whoosh as the chunk
   * lifts, a low thunk as it docks, then a bright ascending fanfare. Scheduled on
   * the WebAudio clock (offsets from `now`) so it stays synced to the ~1.9 s
   * choreography regardless of frame timing.
   */
  chunkArrival(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const master = this.master;
    const now = ctx.currentTime;

    // — whoosh: bandpassed noise sweeping upward as the chunk rises (0.3→1.55 s)
    const wDur = 1.25;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * wDur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    const wStart = now + 0.3;
    bp.frequency.setValueAtTime(180, wStart);
    bp.frequency.exponentialRampToValueAtTime(1500, wStart + wDur);
    const wGain = ctx.createGain();
    wGain.gain.setValueAtTime(0.0001, wStart);
    wGain.gain.exponentialRampToValueAtTime(0.22, wStart + wDur * 0.6);
    wGain.gain.exponentialRampToValueAtTime(0.0001, wStart + wDur);
    src.connect(bp).connect(wGain).connect(master);
    src.start(wStart);
    src.stop(wStart + wDur);

    // — thunk: a low pitch-dropping body as it docks (~1.5 s)
    const tAt = now + 1.5;
    const tOsc = ctx.createOscillator();
    const tGain = ctx.createGain();
    tOsc.type = 'triangle';
    tOsc.frequency.setValueAtTime(150, tAt);
    tOsc.frequency.exponentialRampToValueAtTime(55, tAt + 0.18);
    tGain.gain.setValueAtTime(0.0001, tAt);
    tGain.gain.exponentialRampToValueAtTime(0.55, tAt + 0.012);
    tGain.gain.exponentialRampToValueAtTime(0.0001, tAt + 0.3);
    tOsc.connect(tGain).connect(master);
    tOsc.start(tAt);
    tOsc.stop(tAt + 0.32);

    // — fanfare: a bright ascending major arpeggio + sparkle top (~1.62 s)
    const fAt = now + 1.62;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = fAt + i * 0.085;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  /** Cute "talking" blips when an Islander greets you (Animal-Crossing-ish babble). */
  chatter(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const blips = 3 + Math.floor(Math.random() * 2); // 3–4 little syllables
    for (let i = 0; i < blips; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const at = now + i * 0.092;
      const freq = 360 + Math.random() * 300; // wobbly pitch = friendly babble
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.14, at + 0.06);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
      osc.connect(gain).connect(this.master);
      osc.start(at);
      osc.stop(at + 0.1);
    }
  }

  /** Happy little rising chirp when a Pal is petted (S18). */
  pet(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.34, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** Airy poof for removals — filtered noise burst. */
  poof(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const duration = 0.22;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(350, now + duration);
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(now);
  }
}
