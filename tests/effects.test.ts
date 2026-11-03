// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPackOpener, generic5 } from '../src';
import type { CardInput } from '../src';
import { createFlowLight } from '../src/render/flowlight';
import { createParticles, lighten } from '../src/render/particles';
import { createSpring } from '../src/render/spring';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('spring', () => {
  it('converge al objetivo y se detiene', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    const ticks: number[] = [];
    const spring = createSpring({ rest: { x: 0 }, onTick: (c) => ticks.push(c.x) });
    spring.set({ x: 10 });
    await vi.advanceTimersByTimeAsync(3600);
    expect(spring.cur.x).toBe(10);
    const count = ticks.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(ticks.length).toBe(count);
    vi.unstubAllGlobals();
  });

  it('reset salta al reposo sin animar', () => {
    const spring = createSpring({ rest: { x: 0, y: 5 }, onTick: () => undefined });
    spring.set({ x: 9 });
    spring.reset();
    expect(spring.cur).toEqual({ x: 0, y: 5 });
  });
});

describe('particles / flowlight sin canvas ni WebGL', () => {
  it('no fallan cuando no hay contexto (degradan a no-op)', () => {
    const canvas = document.createElement('canvas');
    const particles = createParticles(canvas);
    expect(() => particles.emit(0, 0, { count: 5 })).not.toThrow();
    particles.dispose();
    expect(createFlowLight(canvas)).toBeNull();
  });

  it('lighten mezcla hacia blanco y respeta lo que no es #rrggbb', () => {
    expect(lighten('#000000', 1)).toBe('rgb(255, 255, 255)');
    expect(lighten('#000000', 0)).toBe('rgb(0, 0, 0)');
    expect(lighten('rebeccapurple')).toBe('rebeccapurple');
  });
});

describe('efectos en el render', () => {
  const cards: CardInput[] = [
    { id: 'a', image: 'a.png', rarity: 'legendary' },
    { id: 'b', image: 'b.png', rarity: 'common' },
  ];

  const open = async (profile: 'high' | 'low') => {
    document.body.innerHTML = '<div id="m"></div>';
    const mount = document.getElementById('m') as HTMLElement;
    const opener = createPackOpener({
      mount,
      code: 'C',
      redeem: async () => cards,
      tiers: generic5,
      flow: { tearMode: 'tap' },
      effects: { profile },
    });
    void opener.open();
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    return { mount, opener };
  };

  it('las caras frontales traen foil, destello y brillo para la inclinación', async () => {
    const { mount, opener } = await open('high');
    const front = mount.querySelector('.ao-card__face--front')!;
    expect(front.querySelector('.ao-foil')).not.toBeNull();
    expect(front.querySelector('.ao-sparkle')).not.toBeNull();
    expect(front.querySelector('.ao-glare')).not.toBeNull();
    opener.destroy();
  });

  it('al revelar, el puntero inclina la carta y mueve el foil', async () => {
    const { mount, opener } = await open('high');
    (mount.querySelector('.ao-stack') as HTMLElement).click();
    const card = mount.querySelector('.ao-card--shown') as HTMLElement;
    expect(card).not.toBeNull();
    mount.querySelector('.ao-root')!.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 0, bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);
    expect(card.style.getPropertyValue('--hyp')).not.toBe('');
    opener.destroy();
  });

  it('el perfil bajo no crea partículas ambientales ni luz fluida', async () => {
    const { mount, opener } = await open('low');
    expect(mount.querySelectorAll('.ao-sparks span')).toHaveLength(0);
    expect(mount.querySelector('.ao-pack__flow')).toBeNull();
    opener.destroy();
  });
});
