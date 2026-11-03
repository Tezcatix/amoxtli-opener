// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SynthAudio, createFeedback, createPackOpener, generic5 } from '../src';
import type { AudioProvider, CardInput, SoundKey } from '../src';

function fakeContext() {
  const node = () => ({ connect: vi.fn(function (this: unknown, next: unknown) { return next ?? this; }), start: vi.fn(), stop: vi.fn() });
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const created: string[] = [];
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    createGain: () => (created.push('gain'), { ...node(), gain: param() }),
    createOscillator: () => (created.push('osc'), { ...node(), type: '', frequency: param(), detune: { value: 0 } }),
    createBiquadFilter: () => (created.push('filter'), { ...node(), type: '', frequency: param(), Q: { value: 0 } }),
    createBufferSource: () => (created.push('noise'), { ...node(), buffer: null }),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { ctx: ctx as unknown as AudioContext, created, raw: ctx };
}

describe('SynthAudio', () => {
  it('crea nodos al reproducir y reanuda un contexto suspendido', () => {
    const { ctx, created, raw } = fakeContext();
    const synth = new SynthAudio({ contextFactory: () => ctx });
    synth.play('impact', { tier: 5 });
    expect(created).toContain('osc');
    expect(created).toContain('noise');
    expect(raw.resume).toHaveBeenCalled();
  });

  it('no suena si está desactivado o sin volumen', () => {
    const { ctx, created } = fakeContext();
    const synth = new SynthAudio({ contextFactory: () => ctx, enabled: false });
    synth.play('chime');
    synth.setEnabled(true);
    synth.setVolume(0);
    synth.play('chime');
    expect(created).toEqual([]);
  });

  it.each(['crinkle','rip','open','flick','riser','impact','chime','sparkle','conclude','hover','reject','collect','slide','snap'] as SoundKey[])('la receta %s se genera en cualquier nivel', (key) => {
    const { ctx, created } = fakeContext();
    const synth = new SynthAudio({ contextFactory: () => ctx });
    [0, 3, 7].forEach((tier) => expect(() => synth.play(key, { tier })).not.toThrow());
    expect(created.length).toBeGreaterThan(0);
  });

  it('con bus completo conecta limitador y reverb sin fallar', () => {
    const { ctx, raw } = fakeContext();
    const extra = ctx as unknown as Record<string, unknown>;
    const nodeLike = () => ({ connect: (next: unknown) => next, gain: { value: 0 }, frequency: { value: 0 }, Q: { value: 0 }, threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, buffer: null, type: '' });
    extra.createDynamicsCompressor = nodeLike;
    extra.createConvolver = nodeLike;
    void raw;
    const synth = new SynthAudio({ contextFactory: () => ctx });
    expect(() => synth.play('chime', { tier: 6 })).not.toThrow();
  });

  it('sin AudioContext no falla', () => {
    const synth = new SynthAudio({ contextFactory: () => null });
    expect(() => synth.play('rip')).not.toThrow();
  });
});

describe('createFeedback', () => {
  it('usa un proveedor propio y respeta enabled/update', () => {
    const play = vi.fn();
    const provider: AudioProvider = { play, setEnabled: vi.fn(), setVolume: vi.fn() };
    const feedback = createFeedback({ provider });
    feedback.sound('flick', 3);
    expect(play).toHaveBeenCalledWith('flick', { tier: 3 });
    feedback.update({ enabled: false });
    feedback.sound('flick');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('sounds personalizados reemplazan al proveedor', () => {
    const play = vi.fn();
    const custom = vi.fn();
    const feedback = createFeedback({ provider: { play }, sounds: { rip: custom } });
    feedback.sound('rip');
    expect(custom).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('háptica: adaptador propio, desactivada y navigator.vibrate', () => {
    const vibrate = vi.fn();
    createFeedback({ provider: 'none' }, { vibrate }).buzz([1, 2]);
    expect(vibrate).toHaveBeenCalledWith([1, 2]);

    createFeedback({ provider: 'none' }, false).buzz(5);
    expect(vibrate).toHaveBeenCalledTimes(1);

    const nav = vi.fn();
    vi.stubGlobal('navigator', { vibrate: nav });
    createFeedback({ provider: 'none' }).buzz(9);
    expect(nav).toHaveBeenCalledWith(9);
    vi.unstubAllGlobals();
  });
});

describe('opener + feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="m"></div>';
  });
  afterEach(() => vi.useRealTimers());

  it('reproduce rip, open, flick y la secuencia del hit', async () => {
    const played: SoundKey[] = [];
    const cards: CardInput[] = [{ id: 'a', image: 'a.png', rarity: 'legendary' }];
    const opener = createPackOpener({
      mount: document.getElementById('m') as HTMLElement,
      code: 'C1',
      redeem: async () => cards,
      tiers: generic5,
      flow: { tearMode: 'tap' },
      audio: { provider: { play: (key) => void played.push(key) } },
      haptics: false,
    });
    void opener.open();
    (document.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    (document.querySelector('.ao-stack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(2600);

    expect(played).toEqual(['rip', 'open', 'flick', 'riser', 'impact', 'chime', 'sparkle', 'conclude']);
    opener.destroy();
  });
});
