// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpeningSession, createPackOpener, generic5 } from '../src';
import type { CardInput } from '../src';

const cards: CardInput[] = [{ id: 'a', image: 'a.png', name: 'Alpha', rarity: 'common' }];
const packs = [
  { code: 'P1', id: 'p1', caption: 'Uno', accent: '#111111' },
  { code: 'P2', id: 'p2', caption: 'Dos', accent: '#222222' },
  { code: 'P3', id: 'p3', caption: 'Tres' },
];

let mount: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="m"></div>';
  mount = document.getElementById('m') as HTMLElement;
});
afterEach(() => vi.useRealTimers());

const phase = () => mount.querySelector('.ao-root')?.getAttribute('data-ao-phase');
const choices = () => [...mount.querySelectorAll<HTMLElement>('.ao-choice')];

describe('sesión con selección', () => {
  it('antepone select y no necesita cartas para elegir', () => {
    const session = createOpeningSession({ tiers: generic5, selectable: true });
    session.start();
    expect(session.phase).toBe('select');
    session.choosePack('p2', 'P2');
    expect(session.phase).toBe('tear');
  });

  it('choosePack se ignora fuera de la selección', () => {
    const session = createOpeningSession({ tiers: generic5 });
    session.start();
    session.choosePack('x', 'X');
    expect(session.phase).toBe('tear');
  });
});

describe('createPackOpener con varios sobres', () => {
  it('muestra todos los sobres y canjea el código del elegido', async () => {
    const redeem = vi.fn(async () => cards);
    const selected: string[] = [];
    const opener = createPackOpener({ mount, packs, redeem, tiers: generic5, flow: { tearMode: 'tap' }, on: { select: (e) => selected.push(e.code) } });
    const done = opener.open();

    expect(phase()).toBe('select');
    expect(choices().map((b) => b.textContent)).toEqual(['Uno', 'Dos', 'Tres']);
    expect(redeem).not.toHaveBeenCalled();

    choices()[1]!.click();
    expect(choices()[1]!.classList.contains('ao-choice--picked')).toBe(true);
    expect(choices()[0]!.classList.contains('ao-choice--away')).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(phase()).toBe('tear');
    expect(selected).toEqual(['P2']);
    expect(mount.querySelector<HTMLElement>('.ao-root')!.style.getPropertyValue('--ao-accent')).toBe('#222222');

    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(600);
    expect(redeem).toHaveBeenCalledTimes(1);
    expect((redeem.mock.calls as unknown as string[][])[0]![0]).toBe('P2');

    opener.skip();
    opener.destroy();
    expect((await done).packId).toBe('p2');
  });

  it('un segundo toque durante la animación no cambia la elección', async () => {
    const opener = createPackOpener({ mount, packs, redeem: async () => cards, tiers: generic5 });
    void opener.open();
    choices()[0]!.click();
    choices()[2]!.click();
    await vi.advanceTimersByTimeAsync(700);
    expect(phase()).toBe('tear');
    opener.destroy();
  });

  it('las flechas mueven el foco entre sobres', () => {
    const opener = createPackOpener({ mount, packs, redeem: async () => cards, tiers: generic5 });
    void opener.open();
    const list = choices();
    list[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(list[2]);
    opener.destroy();
  });

  it('cerrar en la selección termina como aborted y sin llamar a redeem', async () => {
    const redeem = vi.fn(async () => cards);
    const opener = createPackOpener({ mount, packs, redeem, tiers: generic5 });
    const done = opener.open();
    opener.destroy();
    expect((await done).outcome).toBe('aborted');
    expect(redeem).not.toHaveBeenCalled();
  });

  it('sin perfil bajo hay partículas y con perfil bajo no', () => {
    const high = createPackOpener({ mount, packs, redeem: async () => cards, tiers: generic5 });
    expect(mount.querySelectorAll('.ao-sparks span').length).toBeGreaterThan(0);
    high.destroy();
    const low = createPackOpener({ mount, packs, redeem: async () => cards, tiers: generic5, effects: { profile: 'low' } });
    expect(mount.querySelectorAll('.ao-sparks span')).toHaveLength(0);
    low.destroy();
  });
});

describe('rasgado en dos piezas', () => {
  it('un trazo libre completo parte el sobre en dos piezas, una vuela', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const m = document.getElementById('m') as HTMLElement;
    const opener = createPackOpener({ mount: m, code: 'C', redeem: async () => cards, tiers: generic5, effects: { profile: 'low' } });
    void opener.open();
    const packEl = m.querySelector('.ao-pack') as HTMLElement;
    packEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 300, right: 200, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    const fire = (type: string, x: number, y: number) =>
      packEl.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { clientX: x, clientY: y, pointerId: 1 }));
    fire('pointerdown', 2, 40);
    for (let x = 10; x <= 198; x += 12) {
      fire('pointermove', x, 42 + (x % 5));
    }
    await vi.advanceTimersByTimeAsync(10);
    expect(packEl.classList.contains('ao-pack--split')).toBe(true);
    expect(m.querySelectorAll('.ao-pack__piece')).toHaveLength(2);
    expect(m.querySelectorAll('.ao-pack__piece--mover')).toHaveLength(1);
    expect(m.querySelector<HTMLElement>('.ao-pack__piece--mover')!.style.clipPath).toContain('polygon(');
    opener.destroy();
  });

  it('un trazo que se dobra sobre sí mismo se anula y no abre', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const m = document.getElementById('m') as HTMLElement;
    const opener = createPackOpener({ mount: m, code: 'C', redeem: async () => cards, tiers: generic5, effects: { profile: 'low' } });
    void opener.open();
    const packEl = m.querySelector('.ao-pack') as HTMLElement;
    packEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 300, right: 200, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    const fire = (type: string, x: number, y: number) =>
      packEl.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { clientX: x, clientY: y, pointerId: 1 }));
    fire('pointerdown', 150, 40);
    for (let x = 140; x >= 60; x -= 8) fire('pointermove', x, 40);
    for (let x = 70; x <= 198; x += 8) fire('pointermove', x, 42);
    await vi.advanceTimersByTimeAsync(10);
    expect(packEl.classList.contains('ao-pack--split')).toBe(false);
    expect(m.querySelector('.ao-root')?.getAttribute('data-ao-phase')).toBe('tear');
    opener.destroy();
  });
});

describe('abanico del botín', () => {
  it('empieza con la carta más rara al centro y un toque lateral la cambia', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    document.body.innerHTML = '<div id="m"></div>';
    const m = document.getElementById('m') as HTMLElement;
    const many: CardInput[] = [
      { id: 'a', image: 'a.png', name: 'Alfa', rarity: 'common' },
      { id: 'b', image: 'b.png', name: 'Beta', rarity: 'rare' },
      { id: 'c', image: 'c.png', name: 'Gama', rarity: 'legendary' },
    ];
    const opener = createPackOpener({
      mount: m, code: 'C', redeem: async () => many, tiers: generic5, flow: { tearMode: 'tap', revealMode: 'all-at-once' }, effects: { profile: 'low' },
    });
    void opener.open();
    (m.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(3000);
    expect(m.querySelector('.ao-root')?.getAttribute('data-ao-phase')).toBe('fan');
    expect(m.querySelectorAll('.ao-haul__slot')).toHaveLength(3);
    expect(m.querySelector('.ao-haul__name')?.textContent).toBe('Gama');
    const slots = [...m.querySelectorAll<HTMLElement>('.ao-haul__slot')];
    const rareSlot = slots.find((s) => s.querySelector('img')?.getAttribute('src') === 'b.png')!;
    const haul = m.querySelector('.ao-haul') as HTMLElement;
    const fire = (el: Element, type: string, x: number) =>
      el.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { clientX: x, pointerId: 1 }));
    fire(rareSlot.querySelector('.ao-card')!, 'pointerdown', 100);
    fire(haul, 'pointerup', 100);
    await vi.advanceTimersByTimeAsync(1500);
    expect(m.querySelector('.ao-haul__name')?.textContent).toBe('Beta');
    opener.destroy();
    vi.unstubAllGlobals();
  });
});

describe('carrusel 3D', () => {
  it('sin WebGL (el constructor falla) cae al estante 2D', () => {
    document.body.innerHTML = '<div id="m"></div>';
    const m = document.getElementById('m') as HTMLElement;
    const THREE = {
      WebGLRenderer: function () {
        throw new Error('no WebGL');
      },
    };
    const opener = createPackOpener({ mount: m, packs, redeem: async () => cards, tiers: generic5, three: THREE });
    void opener.open();
    expect(m.querySelector('.ao-carousel')).toBeNull();
    expect(m.querySelectorAll('.ao-choice')).toHaveLength(3);
    opener.destroy();
  });

  it('sin three usa el estante 2D', () => {
    document.body.innerHTML = '<div id="m"></div>';
    const m = document.getElementById('m') as HTMLElement;
    const opener = createPackOpener({ mount: m, packs, redeem: async () => cards, tiers: generic5 });
    void opener.open();
    expect(m.querySelector('.ao-carousel')).toBeNull();
    expect(m.querySelectorAll('.ao-choice')).toHaveLength(3);
    opener.destroy();
  });
});
