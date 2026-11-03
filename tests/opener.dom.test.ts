// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPackOpener, generic5 } from '../src';
import type { CardInput } from '../src';

const cards: CardInput[] = [
  { id: 'a', image: 'a.png', name: 'Alpha', rarity: 'legendary', meta: { slot: 1 } },
  { id: 'b', image: 'b.png', name: 'Beta', rarity: 'common', isNew: true },
];

let mount: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="m"></div>';
  mount = document.getElementById('m') as HTMLElement;
});

afterEach(() => {
  vi.useRealTimers();
});

const phase = () => mount.querySelector('.ao-root')?.getAttribute('data-ao-phase');

describe('createPackOpener (DOM)', () => {
  it('abre con un toque, revela y entrega el resultado con la acción elegida', async () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { tearMode: 'tap' } });
    const actions: string[] = [];
    mount.addEventListener('amoxtli-opener:action', (e) => actions.push((e as CustomEvent).detail.id));
    const done = opener.open();

    expect(phase()).toBe('tear');
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(phase()).toBe('stack');
    expect(mount.querySelectorAll('.ao-card')).toHaveLength(2);

    const stack = mount.querySelector('.ao-stack') as HTMLElement;
    stack.click();
    await vi.advanceTimersByTimeAsync(200);
    stack.click();
    await vi.advanceTimersByTimeAsync(3600);
    expect(phase()).toBe('fan');

    (mount.querySelector('.ao-btn--primary') as HTMLElement).click();
    expect(phase()).toBe('summary');
    expect(mount.querySelectorAll('.ao-tile')).toHaveLength(2);

    (mount.querySelector('[data-ao-action="collect"]') as HTMLElement).click();
    const result = await done;

    expect(result.outcome).toBe('completed');
    expect(result.actionId).toBe('collect');
    expect(result.bestPull?.card.meta).toEqual({ slot: 1 });
    expect(actions).toEqual(['collect']);
  });

  it('ui.hints y ui.counter en false marcan la raíz para ocultar ayudas y contador', () => {
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, ui: { hints: false, counter: false } }).open();
    const root = mount.querySelector('.ao-root') as HTMLElement;
    expect(root.hasAttribute('data-ao-no-hints')).toBe(true);
    expect(root.hasAttribute('data-ao-no-counter')).toBe(true);
  });

  it('por defecto muestra ayudas y contador', () => {
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5 }).open();
    const root = mount.querySelector('.ao-root') as HTMLElement;
    expect(root.hasAttribute('data-ao-no-hints')).toBe(false);
    expect(root.hasAttribute('data-ao-no-counter')).toBe(false);
  });

  it('labels es la única entrada de textos y update({ labels }) cambia los que ya están en pantalla', () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { tearMode: 'tap' }, labels: { skip: 'Saltar', tapToOpen: 'Toca para abrir' } });
    void opener.open();
    const skip = mount.querySelector('.ao-skip') as HTMLElement;
    const hint = mount.querySelector('.ao-hint') as HTMLElement;
    expect(skip.textContent).toBe('Saltar');
    expect(hint.textContent).toBe('Toca para abrir');
    expect(mount.querySelector('.ao-pack')?.getAttribute('aria-label')).toBe('Toca para abrir');

    opener.update({ labels: { skip: 'Skip', tapToOpen: 'Tap to open' } });
    expect(skip.textContent).toBe('Skip');
    expect(hint.textContent).toBe('Tap to open');
    expect(mount.querySelector('.ao-pack')?.getAttribute('aria-label')).toBe('Tap to open');

    opener.update({ labels: { skip: undefined } });
    expect(skip.textContent).toBe('Skip');
  });

  it('el texto cambiado también aplica a las pantallas que aparecen después', async () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { tearMode: 'tap' } });
    void opener.open();
    opener.update({ labels: { tapToReveal: 'Toca la carta' } });
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(mount.querySelector('.ao-stack')?.getAttribute('aria-label')).toBe('Toca la carta');
  });

  it('timing: sin opciones valen los de siempre y las que se pasan llegan al contenedor', () => {
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5 }).open();
    const root = mount.querySelector('.ao-root') as HTMLElement;
    expect(root.style.getPropertyValue('--ao-flip')).toBe('700ms');
    expect(root.style.getPropertyValue('--ao-stagger')).toBe('70ms');
    expect(root.style.getPropertyValue('--ao-drop')).toBe('900ms');
    expect(root.style.getPropertyValue('--ao-pace')).toBe('1');
    mount.innerHTML = '';
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, timing: { flipMs: 350, summaryStaggerMs: 30, packDropMs: 500, pace: 2 } }).open();
    const custom = mount.querySelector('.ao-root') as HTMLElement;
    expect(custom.style.getPropertyValue('--ao-flip')).toBe('350ms');
    expect(custom.style.getPropertyValue('--ao-stagger')).toBe('30ms');
    expect(custom.style.getPropertyValue('--ao-drop')).toBe('500ms');
    expect(custom.style.getPropertyValue('--ao-pace')).toBe('2');
  });

  it('timing.pace se limita a 0.25–4', () => {
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, timing: { pace: 50 } }).open();
    expect((mount.querySelector('.ao-root') as HTMLElement).style.getPropertyValue('--ao-pace')).toBe('4');
    mount.innerHTML = '';
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, timing: { pace: 0 } }).open();
    expect((mount.querySelector('.ao-root') as HTMLElement).style.getPropertyValue('--ao-pace')).toBe('0.25');
  });

  it('timing.lastCardHoldMs cambia la pausa antes del abanico', async () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => [cards[1]!], tiers: generic5, flow: { tearMode: 'tap' }, timing: { lastCardHoldMs: 300 } });
    void opener.open();
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    (mount.querySelector('.ao-stack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(700);
    expect(phase()).toBe('fan');
  });

  it('sin texture no hay ninguna capa extra ni se retrasa el inicio', () => {
    void createPackOpener({ mount, code: 'C0', redeem: async () => cards, tiers: generic5 }).open();
    expect(phase()).toBe('tear');
    expect(mount.querySelector('.ao-grain')).toBeNull();
  });

  it('pack.texture desactivada no retrasa el inicio', () => {
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, pack: { texture: { src: 'grain.png', enabled: false } } }).open();
    expect(phase()).toBe('tear');
  });

  it('pack.texture activada espera a mezclarla, con un tope, y el sobre sigue funcionando aunque la imagen no cargue', async () => {
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, pack: { art: 'pack.png', texture: { src: 'grain.png' } } }).open();
    await vi.advanceTimersByTimeAsync(1700);
    expect(phase()).toBe('tear');
    expect((mount.querySelector('.ao-pack__body') as HTMLImageElement).getAttribute('src')).toBe('pack.png');
  });

  it('el sobre siempre se dibuja con la forma de la plantilla, sea cual sea la imagen', () => {
    void createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, pack: { art: 'sobre-enorme.png' } }).open();
    const pack = mount.querySelector('.ao-pack') as HTMLElement;
    expect(pack.style.getPropertyValue('--ao-pack-ratio')).toBe('0.632');
    expect(pack.style.getPropertyValue('--ao-strip')).toBe('18.50%');
  });

  it('el sobre rasgado queda detrás de las cartas, también en el abanico, y se quita en el resumen', async () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { tearMode: 'tap' } });
    void opener.open();
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);

    expect(phase()).toBe('stack');
    const pack = mount.querySelector('.ao-pack') as HTMLElement;
    expect(pack.classList.contains('ao-pack--behind')).toBe(true);
    expect(pack.nextElementSibling).toBe(mount.querySelector('.ao-stack'));

    const stack = mount.querySelector('.ao-stack') as HTMLElement;
    stack.click();
    await vi.advanceTimersByTimeAsync(200);
    stack.click();
    await vi.advanceTimersByTimeAsync(3600);
    expect(phase()).toBe('fan');
    expect(mount.querySelector('.ao-pack--behind')).not.toBeNull();
  });

  it('tocar una carta del abanico la lleva al centro', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { tearMode: 'tap', revealMode: 'all-at-once' } });
    void opener.open();
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(4500);
    expect(phase()).toBe('fan');

    const slots = Array.from(mount.querySelectorAll<HTMLElement>('.ao-haul__slot'));
    const side = slots.find((slot) => !slot.classList.contains('ao-haul__slot--hero')) as HTMLElement;
    side.querySelector('.ao-card')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    mount.querySelector('.ao-stage')!.dispatchEvent(new Event('pointerup', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2500);

    expect(side.classList.contains('ao-haul__slot--hero')).toBe(true);
  });

  it('arrastrar una carta hacia arriba la muestra aparte y se cierra', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { tearMode: 'tap', revealMode: 'all-at-once' } });
    void opener.open();
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(4500);
    expect(phase()).toBe('fan');

    const stage = mount.querySelector('.ao-stage') as HTMLElement;
    const card = mount.querySelector('.ao-haul__slot .ao-card') as HTMLElement;
    const pointer = (type: string, x: number, y: number) => stage.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    const dragUp = (distance: number) => {
      card.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 400 }));
      pointer('pointermove', 100, 400 - distance);
      pointer('pointerup', 100, 400 - distance);
    };

    dragUp(30);
    expect(mount.querySelector('.ao-inspect')).toBeNull();

    dragUp(200);
    expect(mount.querySelector('.ao-inspect')).not.toBeNull();
    expect(mount.querySelector('.ao-inspect .ao-card--shown')).not.toBeNull();

    mount.querySelector('.ao-root')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
    expect(mount.querySelector('.ao-inspect')).toBeNull();
  });

  it('skip lleva al resumen aunque haya una fase pendiente', async () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { tearMode: 'auto' } });
    void opener.open();
    await vi.advanceTimersByTimeAsync(1800);
    expect(phase()).toBe('stack');
    (mount.querySelector('.ao-skip') as HTMLElement).click();
    expect(phase()).toBe('summary');
  });

  it('destroy resuelve como aborted y limpia el DOM', async () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5 });
    const done = opener.open();
    opener.destroy();
    expect((await done).outcome).toBe('aborted');
    expect(mount.querySelector('.ao-root')).toBeNull();
  });

  it('startPaused espera a start()', () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { startPaused: true } });
    void opener.open();
    expect(opener.getState().phase).toBe('idle');
    opener.start();
    expect(opener.getState().phase).toBe('tear');
  });

  it('flow.steps sin tear arranca directo en la pila (tras obtener las cartas)', async () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { steps: ['stack', 'summary'] } });
    void opener.open();
    await vi.advanceTimersByTimeAsync(10);
    expect(phase()).toBe('stack');
  });
});

describe('redeem (código + función)', () => {
  const tapTear = async () => {
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
  };

  it('no llama a redeem ni pinta cartas antes de abrir el sobre', async () => {
    const redeem = vi.fn(async () => cards);
    const opener = createPackOpener({ mount, code: 'SECRET-1', redeem, tiers: generic5, flow: { tearMode: 'tap' } });
    void opener.open();
    await vi.advanceTimersByTimeAsync(3600);

    expect(redeem).not.toHaveBeenCalled();
    expect(mount.querySelectorAll('img[src="a.png"], img[src="b.png"]')).toHaveLength(0);

    await tapTear();
    expect(redeem).toHaveBeenCalledTimes(1);
    expect(redeem).toHaveBeenCalledWith('SECRET-1', expect.objectContaining({ attempt: 1 }));
    expect(phase()).toBe('stack');
  });

  it('muestra "abriendo" mientras el servidor responde y sigue al llegar las cartas', async () => {
    let resolve!: (value: CardInput[]) => void;
    const redeem = vi.fn(() => new Promise<CardInput[]>((r) => (resolve = r)));
    const opener = createPackOpener({ mount, code: 'C1', redeem, tiers: generic5, flow: { tearMode: 'tap' } });
    void opener.open();
    await tapTear();

    expect(phase()).toBe('redeeming');
    expect(mount.querySelector('.ao-spinner')).not.toBeNull();

    resolve(cards);
    await vi.advanceTimersByTimeAsync(10);
    expect(phase()).toBe('stack');
  });

  it('acepta { cards, packId } y devuelve el packId del servidor', async () => {
    const redeem = async () => ({ cards, packId: 'server-pack-9' });
    const opener = createPackOpener({
      mount, code: 'C1', redeem, tiers: generic5, flow: { tearMode: 'tap', steps: ['tear', 'summary'] },
    });
    const done = opener.open();
    await tapTear();
    (mount.querySelector('[data-ao-action="collect"]') as HTMLElement).click();
    expect((await done).packId).toBe('server-pack-9');
  });

  it('si falla ofrece reintentar y el segundo intento recibe attempt = 2', async () => {
    const redeem = vi.fn<(code: string, ctx: { attempt: number }) => Promise<CardInput[]>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(cards);
    const errors: string[] = [];
    const opener = createPackOpener({
      mount, code: 'C1', redeem, tiers: generic5, flow: { tearMode: 'tap' },
      on: { error: (e) => errors.push(e.message) },
    });
    void opener.open();
    await tapTear();

    expect(errors).toEqual(['network']);
    expect(mount.querySelector('[role="alert"]')).not.toBeNull();

    (mount.querySelector('.ao-btn--primary') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(redeem).toHaveBeenCalledTimes(2);
    expect(redeem.mock.calls[1]?.[1].attempt).toBe(2);
    expect(phase()).toBe('stack');
  });

  it('cerrar tras un error resuelve con outcome failed y sin cartas', async () => {
    const opener = createPackOpener({
      mount, code: 'C1', redeem: async () => { throw new Error('boom'); }, tiers: generic5, flow: { tearMode: 'tap' },
    });
    const done = opener.open();
    await tapTear();
    (mount.querySelectorAll('.ao-actions .ao-btn')[1] as HTMLElement).click();
    const result = await done;

    expect(result.outcome).toBe('failed');
    expect(result.cards).toEqual([]);
    expect(result.error?.code).toBe('REDEEM_FAILED');
  });

  it('sin paso tear, redeem se llama al iniciar', async () => {
    const redeem = vi.fn(async () => cards);
    const opener = createPackOpener({ mount, code: 'C1', redeem, tiers: generic5, flow: { steps: ['stack', 'summary'] } });
    void opener.open();
    await vi.advanceTimersByTimeAsync(10);
    expect(redeem).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('stack');
  });

  it('destroy aborta la señal de la petición en curso', async () => {
    let signal!: AbortSignal;
    const redeem = vi.fn((_code: string, ctx: { signal: AbortSignal }) => {
      signal = ctx.signal;
      return new Promise<CardInput[]>(() => undefined);
    });
    const opener = createPackOpener({ mount, code: 'C1', redeem, tiers: generic5, flow: { tearMode: 'tap' } });
    void opener.open();
    await tapTear();
    opener.destroy();
    expect(signal.aborted).toBe(true);
  });
});
