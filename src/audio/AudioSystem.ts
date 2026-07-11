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
