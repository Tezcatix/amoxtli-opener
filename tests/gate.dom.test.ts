// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPackOpener, generic5 } from '../src';
import type { CardInput, GateOptions, RedeemContext } from '../src';

const cards: CardInput[] = [{ id: 'a', image: 'a.png', name: 'Alpha', rarity: 'common' }];

let mount: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="m"></div>';
  mount = document.getElementById('m') as HTMLElement;
});

afterEach(() => {
  vi.useRealTimers();
});

const root = () => mount.querySelector('.ao-root') as HTMLElement;
const phase = () => mount.querySelector('.ao-root')?.getAttribute('data-ao-phase');
const form = () => mount.querySelector('.ao-gate') as HTMLFormElement | null;
const input = (name: string) => mount.querySelector(`.ao-gate input[name="${name}"]`) as HTMLInputElement;
const submit = () => form()?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
const error = () => mount.querySelector('.ao-gate__error') as HTMLElement;

const gate = (extra: Partial<GateOptions> = {}): GateOptions => ({
  title: 'Access code',
  fields: [{ name: 'code', label: 'Code', transform: 'uppercase' }, { name: 'name', label: 'Name', required: false }],
  ...extra,
});

const make = (options: { gate?: GateOptions; redeem?: (code: string, context: RedeemContext) => Promise<CardInput[]> } = {}) =>
  createPackOpener({
    mount,
    code: 'C1',
    tiers: generic5,
    flow: { tearMode: 'tap' },
    redeem: options.redeem ?? (async () => cards),
    ...(options.gate ? { gate: options.gate } : {}),
  });

describe('gate (puerta de entrada)', () => {
  it('muestra el formulario antes de la experiencia, sin sobre ni fase, y oculta «Saltar»', () => {
    const opener = make({ gate: gate() });
    void opener.open();

    expect(form()).not.toBeNull();
    expect(root().hasAttribute('data-ao-gate')).toBe(true);
    expect(root().getAttribute('data-ao-phase')).toBe('idle');
    expect(mount.querySelector('.ao-pack')).toBeNull();
    expect(mount.querySelector('.ao-gate__title')?.textContent).toBe('Access code');
    expect(mount.querySelector('label[for]')?.textContent).toBe('Code *');
    expect(input('code').getAttribute('aria-required')).toBe('true');
    expect(input('name').getAttribute('aria-required')).toBeNull();
    opener.destroy();
  });

  it('un campo obligatorio vacío no deja continuar y avisa con el texto configurado', () => {
    const opener = make({ gate: gate({ requiredMessage: 'Falta: {label}' }) });
    void opener.open();

    submit();

    expect(error().hidden).toBe(false);
    expect(error().textContent).toBe('Falta: Code');
    expect(form()).not.toBeNull();
    opener.destroy();
  });

  it('con los datos completos arranca la experiencia y manda los valores (en mayúsculas) a redeem', async () => {
    const seen: RedeemContext[] = [];
    const opener = make({
      gate: gate(),
      redeem: async (_code, context) => {
        seen.push(context);
        return cards;
      },
    });
    void opener.open();

    input('code').value = '  ab-12 ';
    input('name').value = 'Ana';
    submit();
    await vi.advanceTimersByTimeAsync(10);

    expect(form()).toBeNull();
    expect(root().hasAttribute('data-ao-gate')).toBe(false);
    expect(root().getAttribute('data-ao-phase')).toBe('tear');

    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.gate).toEqual({ code: 'AB-12', name: 'Ana' });
    opener.destroy();
  });

  it('validate rechazado muestra su mensaje, deja corregir y no empieza hasta que acepta', async () => {
    const validate = vi.fn(async (values: Record<string, string>) => {
      if (values.code !== 'GOOD') {
        throw new Error('That code does not work.');
      }
    });
    const opener = make({ gate: gate({ validate, busyLabel: 'Checking…' }) });
    void opener.open();

    input('code').value = 'bad';
    submit();
    expect((mount.querySelector('.ao-gate .ao-btn--primary') as HTMLButtonElement).textContent).toBe('Checking…');
    await vi.advanceTimersByTimeAsync(10);

    expect(error().hidden).toBe(false);
    expect(error().textContent).toBe('That code does not work.');
    expect(form()).not.toBeNull();
    expect((mount.querySelector('.ao-gate .ao-btn--primary') as HTMLButtonElement).disabled).toBe(false);
    expect(root().getAttribute('data-ao-phase')).toBe('idle');

    input('code').value = 'good';
    submit();
    await vi.advanceTimersByTimeAsync(10);

    expect(validate).toHaveBeenCalledTimes(2);
    expect(form()).toBeNull();
    expect(root().getAttribute('data-ao-phase')).toBe('tear');
    opener.destroy();
  });

  it('retirarse (Cancelar o Escape) termina con aborted, sin cartas y sin llamar a redeem', async () => {
    const redeem = vi.fn(async () => cards);
    const opener = make({ gate: gate(), redeem });
    const done = opener.open();

    (mount.querySelector('.ao-gate .ao-btn:not(.ao-btn--primary)') as HTMLButtonElement).click();
    const result = await done;

    expect(result.outcome).toBe('aborted');
    expect(result.cards).toHaveLength(0);
    expect(redeem).not.toHaveBeenCalled();
    expect(form()).toBeNull();

    const second = make({ gate: gate() });
    const doneEscape = second.open();
    form()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect((await doneEscape).outcome).toBe('aborted');
  });

  it('destruir con la puerta abierta termina con aborted y limpia el DOM', async () => {
    const opener = make({ gate: gate() });
    const done = opener.open();

    opener.destroy();

    expect((await done).outcome).toBe('aborted');
    expect(mount.querySelector('.ao-root')).toBeNull();
  });

  it('una casilla obligatoria hay que marcarla, muestra sus enlaces y su valor llega como "true"', async () => {
    const seen: RedeemContext[] = [];
    const opener = make({
      gate: {
        fields: [
          { name: 'code', label: 'Code' },
          {
            name: 'terms',
            label: 'I accept the terms',
            type: 'checkbox',
            requiredMessage: 'Accept the terms to continue.',
            links: [{ label: 'Terms', href: '/terms' }, { label: 'Privacy', href: '/privacy' }],
          },
        ],
      },
      redeem: async (_code, context) => {
        seen.push(context);
        return cards;
      },
    });
    void opener.open();

    const links = Array.from(mount.querySelectorAll('.ao-gate__links a')) as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/terms', '/privacy']);
    expect(links.every((link) => link.target === '_blank' && link.rel.includes('noopener'))).toBe(true);
    expect(mount.querySelector('label[for$="terms"]')?.textContent).toBe('I accept the terms');

    input('code').value = 'x1';
    submit();
    expect(error().textContent).toBe('Accept the terms to continue.');
    expect(form()).not.toBeNull();

    input('terms').checked = true;
    submit();
    await vi.advanceTimersByTimeAsync(10);
    expect(form()).toBeNull();

    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(seen[0]?.gate).toEqual({ code: 'x1', terms: 'true' });
    opener.destroy();
  });

  it('una casilla opcional sin marcar llega como cadena vacía', async () => {
    const seen: RedeemContext[] = [];
    const opener = make({
      gate: { fields: [{ name: 'news', label: 'Send me news', type: 'checkbox', required: false }] },
      redeem: async (_code, context) => {
        seen.push(context);
        return cards;
      },
    });
    void opener.open();

    submit();
    await vi.advanceTimersByTimeAsync(10);
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);

    expect(seen[0]?.gate).toEqual({ news: '' });
    opener.destroy();
  });
  it('ui.exitButton agrega «Salir» arriba a la izquierda en todas las fases y termina con aborted', async () => {
    const withGate = createPackOpener({
      mount, code: 'C1', redeem: async () => cards, tiers: generic5, ui: { exitButton: true },
      labels: { exit: 'Salir' },
      gate: { fields: [{ name: 'code', label: 'Code' }] },
    });
    const gateDone = withGate.open();
    const button = mount.querySelector('.ao-exit') as HTMLButtonElement;

    expect(button.textContent).toBe('Salir');
    expect(button.hidden).toBe(false);
    button.click();
    expect((await gateDone).outcome).toBe('aborted');
    mount.innerHTML = '';

    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5, flow: { tearMode: 'tap' }, ui: { exitButton: true } });
    const done = opener.open();
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(phase()).toBe('stack');

    (mount.querySelector('.ao-exit') as HTMLButtonElement).click();
    const result = await done;

    expect(result.outcome).toBe('aborted');
    expect(result.actionId).toBeNull();
  });

  it('sin ui.exitButton no hay botón «Salir», pero opener.exit() sale igual', async () => {
    const opener = createPackOpener({ mount, code: 'C1', redeem: async () => cards, tiers: generic5 });
    const done = opener.open();

    expect(mount.querySelector('.ao-exit')).toBeNull();
    opener.exit();

    expect((await done).outcome).toBe('aborted');
  });
  it('sin gate la experiencia empieza directo y redeem recibe un gate vacío', async () => {
    const seen: RedeemContext[] = [];
    const opener = make({
      redeem: async (_code, context) => {
        seen.push(context);
        return cards;
      },
    });
    void opener.open();

    expect(form()).toBeNull();
    expect(root().getAttribute('data-ao-phase')).toBe('tear');
    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);

    expect(seen[0]?.gate).toEqual({});
    opener.destroy();
  });
});

describe('seguridad de la puerta', () => {
  it('descarta enlaces con esquemas peligrosos y deja los seguros', () => {
    const opener = make({
      gate: {
        fields: [
          {
            name: 'terms',
            label: 'Terms',
            type: 'checkbox',
            links: [
              { label: 'xss', href: 'javascript:alert(1)' },
              { label: 'xss2', href: ' JaVaScRiPt:alert(1)' },
              { label: 'data', href: 'data:text/html,<script>1</script>' },
              { label: 'ok', href: 'https://example.com/t' },
              { label: 'rel', href: '/privacy' },
            ],
          },
        ],
      },
    });
    void opener.open();
    const hrefs = Array.from(mount.querySelectorAll('.ao-gate__links a')).map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['https://example.com/t', '/privacy']);
    opener.destroy();
  });

  it('no pinta la lista de enlaces si todos son peligrosos', () => {
    const opener = make({
      gate: { fields: [{ name: 'terms', label: 'Terms', type: 'checkbox', links: [{ label: 'x', href: 'javascript:alert(1)' }] }] },
    });
    void opener.open();
    expect(mount.querySelector('.ao-gate__links')).toBeNull();
    opener.destroy();
  });

  it('un campo llamado __proto__ no cambia el prototipo de los valores', async () => {
    const seen: Array<Record<string, string>> = [];
    const opener = make({
      gate: {
        fields: [{ name: '__proto__', label: 'Raro' }],
        validate: (values) => {
          seen.push(values);
        },
      },
    });
    void opener.open();
    (mount.querySelector('.ao-gate input') as HTMLInputElement).value = 'polluted';
    submit();
    await vi.advanceTimersByTimeAsync(0);
    const values = seen[0] ?? {};
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
    expect(Object.keys(values)).toEqual(['__proto__']);
    opener.destroy();
  });
});
