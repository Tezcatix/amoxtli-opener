import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Emitter } from '../src/core/emitter';
import { MAX_CARDS_PER_OPENING, assertValidCards } from '../src/render/cards-guard';

describe('Emitter: un oyente que lanza no frena a los demás', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('sigue avisando a los oyentes siguientes y relanza el error aparte', () => {
    const emitter = new Emitter<{ done: number }>();
    const after = vi.fn();
    emitter.on('done', () => {
      throw new Error('oyente roto');
    });
    emitter.on('done', after);

    expect(() => emitter.emit('done', 1)).not.toThrow();
    expect(after).toHaveBeenCalledWith(1);
    expect(() => vi.runAllTimers()).toThrow('oyente roto');
  });

  it('un oyente que se quita a sí mismo no altera la ronda en curso', () => {
    const emitter = new Emitter<{ done: number }>();
    const second = vi.fn();
    const off = emitter.on('done', () => off());
    emitter.on('done', second);
    emitter.emit('done', 1);
    emitter.emit('done', 2);
    expect(second).toHaveBeenCalledTimes(2);
  });
});

describe('assertValidCards: la respuesta de redeem se comprueba antes de pintar', () => {
  it('acepta cartas con id e image de texto', () => {
    expect(() => assertValidCards([{ id: 'a', image: 'a.png' }])).not.toThrow();
    expect(() => assertValidCards([])).not.toThrow();
  });

  it.each([
    ['no es un arreglo', { id: 'a' }],
    ['es null', null],
    ['una carta es null', [null]],
    ['falta image', [{ id: 'a' }]],
    ['falta id', [{ image: 'a.png' }]],
    ['image no es texto', [{ id: 'a', image: 5 }]],
  ])('rechaza si %s', (_name, value) => {
    expect(() => assertValidCards(value)).toThrow();
  });

  it('rechaza una respuesta con demasiadas cartas', () => {
    const many = Array.from({ length: MAX_CARDS_PER_OPENING + 1 }, (_, i) => ({ id: String(i), image: 'x.png' }));
    expect(() => assertValidCards(many)).toThrow(/limit/);
  });
});
