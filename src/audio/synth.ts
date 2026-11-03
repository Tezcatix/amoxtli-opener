import type { AudioProvider, SoundKey } from '../types';

export interface SynthOptions {
  volume?: number;
  enabled?: boolean;
  /** Inyectable para tests o para compartir un AudioContext del host. */
  contextFactory?: () => AudioContext | null;
}

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
  wet?: number;
}

interface NoiseOptions {
  frequency: number;
  q?: number;
  gain?: number;
  filter?: BiquadFilterType;
  delay?: number;
  sweepTo?: number;
  wet?: number;
}

const defaultFactory = (): AudioContext | null => {
  const scope = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  return Ctor ? new Ctor({ latencyHint: 'interactive' }) : null;
};

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/**
 * Sonidos sintetizados con WebAudio (sin archivos de audio), sobre un bus maestro ajustado a bocinas
 * de teléfono: dos pasa-altos (sin subgraves inaudibles), limitador suave y reverberación acotada en
 * banda. Las recetas están adaptadas de OpenPack (Luango, `sfx.js`); ver NOTICE.md.
 *
 * `tier` llega como índice de nivel de la escala del host: el "golpe" crece desde el nivel 3 (0) hasta
 * el 7 (1), que coincide con la escala de Amoxtli.
 */
export class SynthAudio implements AudioProvider {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: GainNode | null = null;
  private volume: number;
  private enabled: boolean;
  private readonly factory: () => AudioContext | null;
  private lastHover = 0;

  constructor(options: SynthOptions = {}) {
    this.volume = clamp01(options.volume ?? 0.7);
    this.enabled = options.enabled ?? true;
    this.factory = options.contextFactory ?? defaultFactory;
  }

  play(key: SoundKey, options: { tier?: number } = {}): void {
    if (!this.enabled || this.volume <= 0) {
      return;
    }
    const ctx = this.context();
    if (!ctx || !this.master) {
      return;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    this.recipe(key, ctx, ctx.currentTime, options.tier ?? 0);
  }

  unlock(): void {
    const ctx = this.context();
    if (ctx?.state === 'suspended') {
      void ctx.resume();
    }
  }

  setVolume(volume: number): void {
    this.volume = clamp01(volume);
    if (this.master) {
      this.master.gain.value = this.volume;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  dispose(): void {
    void this.ctx?.close?.();
    this.ctx = null;
    this.master = null;
    this.reverb = null;
  }

  private context(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = this.factory();
      } catch {
        this.ctx = null;
      }
      if (this.ctx) {
        this.buildBus(this.ctx);
      }
    }
    return this.ctx;
  }

  /** master → 2× pasa-altos 45 Hz → limitador suave → ganancia de compensación → salida; reverb en paralelo. */
  private buildBus(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = this.volume;
    this.master = master;
    if (!ctx.createBiquadFilter || !ctx.createDynamicsCompressor) {
      master.connect(ctx.destination);
      return;
    }
    const highpass = (): BiquadFilterNode => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 45;
      filter.Q.value = 0.7;
      return filter;
    };
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 3;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.2;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.2;
    master.connect(highpass()).connect(highpass()).connect(limiter).connect(makeup).connect(ctx.destination);

    if (!ctx.createConvolver) {
      return;
    }
    const seconds = 2;
    const length = Math.ceil(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    const revHigh = ctx.createBiquadFilter();
    revHigh.type = 'highpass';
    revHigh.frequency.value = 240;
    const revLow = ctx.createBiquadFilter();
    revLow.type = 'lowpass';
    revLow.frequency.value = 10000;
    const input = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    input.connect(convolver).connect(revHigh).connect(revLow).connect(wet).connect(master);
    this.reverb = input;
  }

  /** Envía una copia del nodo a la reverberación con `amount` de humedad. */
  private send(ctx: AudioContext, node: AudioNode, amount: number): void {
    if (!this.reverb || amount <= 0) {
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = amount;
    node.connect(gain).connect(this.reverb);
  }

  private recipe(key: SoundKey, ctx: AudioContext, t: number, tier: number): void {
    const p = clamp01((tier - 3) / 4);
    switch (key) {
      case 'crinkle':
        this.crinkle(ctx, t, 4, 0.022, 1400, 3600, 0.06);
        break;
      case 'rip': {
        this.noise(ctx, t, 0.4, { frequency: 1800, q: 0.6, gain: 0.3, sweepTo: 4200, wet: 0.1 });
        this.crinkle(ctx, t, 6, 0.03, 1600, 4200, 0.08);
        this.noise(ctx, t, 0.02, { frequency: 2200, filter: 'highpass', gain: 0.16 });
        break;
      }
      case 'open':
        this.openBurst(ctx, t, 0.7, p);
        break;
      case 'flick':
        this.noise(ctx, t, 0.18, {
          frequency: 900 + (Math.random() - 0.5) * 200,
          sweepTo: 5200 + (Math.random() - 0.5) * 800,
          q: 0.8,
          gain: 0.09 * (0.85 + Math.random() * 0.3),
          wet: 0.15,
        });
        break;
      case 'riser':
        this.riser(ctx, t, tier);
        break;
      case 'impact':
        this.revealImpact(ctx, t, p, tier);
        break;
      case 'chime':
        this.chime(ctx, t, tier);
        break;
      case 'sparkle':
        this.sparkle(ctx, t, Math.round(12 + Math.max(0, tier) * 3), 0.4 + Math.max(0, tier) * 0.06);
        break;
      case 'conclude':
        this.conclude(ctx, t);
        break;
      case 'hover': {
        const now = Date.now();
        if (now - this.lastHover < 45) {
          return;
        }
        this.lastHover = now;
        const base = 720 + (Math.random() - 0.5) * 40;
        this.tone(ctx, t, base, 0.12, { type: 'triangle', gain: 0.07, slideTo: base * 1.44 });
        break;
      }
      case 'slide':
        this.noise(ctx, t, 0.16, { frequency: 700, sweepTo: 2600, q: 0.7, gain: 0.07, wet: 0.08 });
        break;
      case 'snap':
        this.noise(ctx, t, 0.03, { frequency: 2600, filter: 'highpass', gain: 0.1 });
        this.tone(ctx, t, 190, 0.06, { type: 'triangle', gain: 0.1, slideTo: 120 });
        break;
      case 'reject':
        this.tone(ctx, t, 420, 0.16, { type: 'sawtooth', gain: 0.11, slideTo: 150 });
        break;
      case 'collect':
        this.tone(ctx, t, 520, 0.22, { type: 'triangle', gain: 0.2, slideTo: 980, wet: 0.1 });
        break;
    }
  }

  /** Granitos de ruido brillante: el crujido metálico del foil al agarrarlo o cortarlo. */
  private crinkle(ctx: AudioContext, t: number, grains: number, gain: number, low: number, high: number, wet: number): void {
    for (let i = 0; i < grains; i++) {
      const start = t + i * (0.01 + Math.random() * 0.018);
      const duration = 0.03 + Math.random() * 0.03;
      const length = Math.max(1, Math.ceil(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let k = 0; k < length; k++) {
        data[k] = (Math.random() * 2 - 1) * (1 - k / length);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = low + Math.random() * (high - low);
      band.Q.value = 0.8 + Math.random() * 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain * (0.7 + Math.random() * 0.6), start + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(band).connect(g).connect(this.master as GainNode);
      this.send(ctx, g, wet);
      source.start(start);
    }
  }

  /** Apertura del sobre: golpe de cuerpo, crujido del foil con destello metálico y caída de subgrave audible en teléfono. */
  private openBurst(ctx: AudioContext, t: number, power: number, tg: number): void {
    const duration = 0.22 + tg * 0.1;
    this.noise(ctx, t, duration, {
      frequency: 900,
      sweepTo: 180,
      filter: 'lowpass',
      q: 0.7,
      gain: 0.18 + power * 0.22 + tg * 0.06,
      wet: 0.4,
    });
    this.noise(ctx, t, 0.02, { frequency: 2200, filter: 'highpass', gain: 0.12 + power * 0.16 });
    this.tone(ctx, t, 2400 + tg * 1400, 0.12, { type: 'sine', gain: 0.05 + tg * 0.04, slideTo: 5200, wet: 0.25 });
    this.tone(ctx, t, 90 - tg * 6, 0.55, { type: 'sine', gain: 0.22 + power * 0.12 + tg * 0.08, slideTo: 55 - tg * 6 });
  }

  /** "Algo viene": diente de sierra subiendo por un filtro que se abre, más una cama de aire; sostiene el pico hasta el golpe. */
  private riser(ctx: AudioContext, t: number, tier: number): void {
    const duration = 0.6;
    const top = 660 + Math.max(0, tier - 5) * 90;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(top, t + duration);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(300, t);
    lowpass.frequency.exponentialRampToValueAtTime(5200, t + duration);
    lowpass.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + duration * 0.82);
    g.gain.setValueAtTime(0.14, t + duration);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.12);
    osc.connect(lowpass).connect(g).connect(this.master as GainNode);
    this.send(ctx, g, 0.22);
    osc.start(t);
    osc.stop(t + duration + 0.14);
    this.noise(ctx, t, duration + 0.1, { frequency: 800, sweepTo: 6000, q: 0.7, gain: 0.06 });
  }

  /** El golpe de la carta rara: BOOM audible en teléfono, CRASH de aire que florece y un crujido inicial; sub extra en lo más alto. */
  private revealImpact(ctx: AudioContext, t: number, p: number, tier: number): void {
    this.tone(ctx, t, 165 - p * 35, 0.26 + p * 0.12, { type: 'sine', gain: 0.3 + p * 0.25, slideTo: 70 - p * 12, wet: 0.3 });
    this.noise(ctx, t, 0.5 + p * 0.55, { frequency: 3400, filter: 'highpass', gain: 0.05 + p * 0.08, wet: 0.5 });
    this.noise(ctx, t, 0.03, { frequency: 2400, filter: 'highpass', gain: 0.1 + p * 0.14 });
    if (tier >= 7) {
      this.tone(ctx, t, 92, 0.5, { type: 'sine', gain: 0.15 + p * 0.12, slideTo: 56 });
    }
  }

  /** Arpegio de campana: más notas y octava brillante en las raras, colchón de sierra y "ding" final en las más altas. */
  private chime(ctx: AudioContext, t: number, tier: number): void {
    const lift = Math.max(0, Math.min(4, tier - 3));
    const root = 523.25 * Math.pow(2, lift / 12);
    const steps = tier >= 4 ? [0, 4, 7, 12, 16, 19] : [0, 4, 7, 12, 16];
    const octave = tier >= 4;
    const gap = 0.07;
    const wet = 0.18 + lift * 0.02;
    steps.forEach((semitones, i) => {
      const frequency = root * Math.pow(2, semitones / 12);
      const start = t + i * gap;
      const note = ctx.createGain();
      note.gain.setValueAtTime(0.0001, start);
      note.gain.exponentialRampToValueAtTime(0.1, start + 0.012);
      note.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      note.connect(this.master as GainNode);
      this.send(ctx, note, wet);
      (
        [
          ['sine', 7],
          ['triangle', -7],
        ] as Array<[OscillatorType, number]>
      ).forEach(([type, detune]) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = frequency;
        osc.detune.value = detune;
        osc.connect(note);
        osc.start(start);
        osc.stop(start + 0.92);
      });
      if (octave) {
        this.tone(ctx, start, frequency * 2, 0.4, { type: 'sine', gain: 0.04, wet: wet + 0.06 });
      }
    });
    if (tier >= 6) {
      const pad = ctx.createGain();
      pad.gain.setValueAtTime(0.0001, t);
      pad.gain.exponentialRampToValueAtTime(0.05, t + 0.18);
      pad.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1800;
      pad.connect(lowpass).connect(this.master as GainNode);
      this.send(ctx, lowpass, wet + 0.12);
      [0, 4, 7].forEach((semitones) => {
        [-8, 8].forEach((detune) => {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = (root * Math.pow(2, semitones / 12)) / 2;
          osc.detune.value = detune;
          osc.connect(pad);
          osc.start(t);
          osc.stop(t + 1.32);
        });
      });
      this.tone(ctx, t + steps.length * gap + 0.05, root * 4, 1, { type: 'sine', gain: 0.09, wet: wet + 0.2 });
    }
  }

  /** Polvo de brillo: granos de campana agudos en escala pentatónica, repartidos en el tiempo. */
  private sparkle(ctx: AudioContext, t: number, count: number, spread: number): void {
    const notes = [2093, 2349, 2793, 3136, 3520, 4186];
    const n = Math.min(40, Math.max(1, count));
    for (let i = 0; i < n; i++) {
      const start = t + Math.random() * spread;
      const frequency = (notes[(Math.random() * notes.length) | 0] ?? 2093) * (Math.random() < 0.4 ? 1.5 : 1);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      osc.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain();
      const decay = 0.16 + Math.random() * 0.04;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.03, start + 0.004 + Math.random() * 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      osc.connect(g).connect(this.master as GainNode);
      this.send(ctx, g, 0.3);
      osc.start(start);
      osc.stop(start + decay + 0.02);
    }
  }

  /** Cadencia descendente suave al terminar el botín: dos notas y un colchón grave. */
  private conclude(ctx: AudioContext, t: number): void {
    [659.25, 523.25].forEach((frequency, i) => {
      this.tone(ctx, t + i * 0.14, frequency, 0.7, { type: 'sine', gain: 0.06, wet: 0.3 });
    });
    [130.81, 196].forEach((frequency) => this.tone(ctx, t, frequency, 1, { type: 'triangle', gain: 0.02, wet: 0.3 }));
  }

  private tone(ctx: AudioContext, t: number, frequency: number, duration: number, options: ToneOptions = {}): void {
    const start = t + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(frequency, start);
    if (options.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(options.slideTo, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.2, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master as GainNode);
    this.send(ctx, gain, options.wet ?? 0);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(ctx: AudioContext, t: number, duration: number, options: NoiseOptions): void {
    const start = t + (options.delay ?? 0);
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = options.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(options.frequency, start);
    if (options.sweepTo) {
      filter.frequency.exponentialRampToValueAtTime(options.sweepTo, start + duration);
    }
    filter.Q.value = options.q ?? 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.2, start + Math.min(0.02, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master as GainNode);
    this.send(ctx, gain, options.wet ?? 0);
    source.start(start);
  }
}
