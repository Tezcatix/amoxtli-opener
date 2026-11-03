// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { defaultLabels } from '../src/render/labels';
import { createLabelBinder } from '../src/render/label-binder';
import { DEFAULT_TIMING, resolveTiming } from '../src/render/timing';
import { definedOnly } from '../src/render/util';
import { coverRect, PACK_TEMPLATE } from '../src/render/pack-size';
import { composedKey, resolvePackTexture } from '../src/render/pack-texture';

describe('definedOnly', () => {
  it('quita las claves undefined y conserva el resto', () => {
    expect(definedOnly({ a: 1, b: undefined, c: 0, d: '' })).toEqual({ a: 1, c: 0, d: '' });
  });

  it('acepta undefined', () => {
    expect(definedOnly(undefined)).toEqual({});
  });
});

describe('resolveTiming', () => {
  it('sin opciones valen los de siempre', () => {
    expect(resolveTiming()).toEqual(DEFAULT_TIMING);
  });

  it('mezcla lo que se pasa con los de siempre e ignora lo undefined', () => {
    const timing = resolveTiming({ flipMs: 350, packDropMs: undefined });
    expect(timing.flipMs).toBe(350);
    expect(timing.packDropMs).toBe(DEFAULT_TIMING.packDropMs);
  });

  it('limita pace a 0.25–4', () => {
    expect(resolveTiming({ pace: 100 }).pace).toBe(4);
    expect(resolveTiming({ pace: 0 }).pace).toBe(0.25);
    expect(resolveTiming({ pace: 1.5 }).pace).toBe(1.5);
  });

  it('holdArmMs no baja de 350 ms (se confundiría con un clic corto)', () => {
    expect(resolveTiming({ holdArmMs: 100 }).holdArmMs).toBe(350);
    expect(resolveTiming({ holdArmMs: 600 }).holdArmMs).toBe(600);
  });
});

describe('createLabelBinder', () => {
  it('pone el texto y lo repinta al cambiar las etiquetas', () => {
    const labels = { ...defaultLabels };
    const binder = createLabelBinder(labels);
    const button = document.createElement('button');
    document.body.appendChild(button);
    binder.bindText(button, 'skip');
    expect(button.textContent).toBe(defaultLabels.skip);

    labels.skip = 'Saltar';
    binder.refresh();
    expect(button.textContent).toBe('Saltar');
  });

  it('bindText admite un formato y bindAttr liga atributos', () => {
    const labels = { ...defaultLabels };
    const binder = createLabelBinder(labels);
    const info = document.createElement('div');
    const pack = document.createElement('div');
    document.body.append(info, pack);
    binder.bindText(info, 'bestPull', (text) => `${text}: Alpha`);
    binder.bindAttr(pack, 'aria-label', 'tapToOpen');
    expect(info.textContent).toBe(`${defaultLabels.bestPull}: Alpha`);
    expect(pack.getAttribute('aria-label')).toBe(defaultLabels.tapToOpen);

    labels.bestPull = 'Mejor';
    labels.tapToOpen = 'Toca';
    binder.refresh();
    expect(info.textContent).toBe('Mejor: Alpha');
    expect(pack.getAttribute('aria-label')).toBe('Toca');
  });

  it('olvida los nodos que ya se quitaron del documento', () => {
    const labels = { ...defaultLabels };
    const binder = createLabelBinder(labels);
    const gone = document.createElement('span');
    document.body.appendChild(gone);
    binder.bindText(gone, 'close');
    gone.remove();
    labels.close = 'Cerrar';
    binder.refresh();
    expect(gone.textContent).toBe(defaultLabels.close);
  });
});

describe('resolvePackTexture', () => {
  it('sin textura no se aplica nada (apagada por defecto)', () => {
    expect(resolvePackTexture(undefined)).toBeNull();
    expect(resolvePackTexture(false)).toBeNull();
  });

  it('sin src o desactivada tampoco', () => {
    expect(resolvePackTexture({ src: '' })).toBeNull();
    expect(resolvePackTexture({ src: 'foil.jpg', enabled: false })).toBeNull();
  });

  it('con src completa los valores por defecto', () => {
    expect(resolvePackTexture({ src: 'foil.jpg' })).toEqual({ src: 'foil.jpg', blend: 'overlay', opacity: 0.5, repeat: 1 });
  });

  it('limita los valores a su rango', () => {
    const texture = resolvePackTexture({ src: 'g.png', opacity: 4, repeat: 1000 })!;
    expect(texture.opacity).toBe(1);
    expect(texture.repeat).toBe(32);
  });

  it('el mismo arte con otra textura o ajustes tiene otra clave', () => {
    const a = resolvePackTexture({ src: 'g.png' })!;
    const b = resolvePackTexture({ src: 'g.png', opacity: 0.8 })!;
    expect(composedKey('art.png', a)).not.toBe(composedKey('art.png', b));
    expect(composedKey('art.png', a)).toBe(composedKey('art.png', resolvePackTexture({ src: 'g.png' })!));
  });
});

describe('PACK_TEMPLATE y coverRect (el sobre siempre tiene la misma forma)', () => {
  it('la plantilla es coherente: el tamaño recomendado cumple la proporción', () => {
    expect(PACK_TEMPLATE.art.width / PACK_TEMPLATE.art.height).toBeCloseTo(PACK_TEMPLATE.ratio, 3);
    expect(PACK_TEMPLATE.art.width).toBeGreaterThanOrEqual(PACK_TEMPLATE.art.minWidthPx);
    expect(PACK_TEMPLATE.strip).toBeGreaterThan(0.1);
    expect(PACK_TEMPLATE.strip).toBeLessThan(0.3);
  });

  it('una imagen con la proporción de la plantilla no se recorta', () => {
    const { sx, sy, sw, sh } = coverRect(800, 1266, PACK_TEMPLATE.ratio);
    expect(sx).toBe(0);
    expect(sy).toBeLessThan(1);
    expect(sw / sh).toBeCloseTo(PACK_TEMPLATE.ratio, 3);
    expect(sw).toBeCloseTo(800, 0);
  });

  it('una imagen más ancha se recorta a los lados, centrada', () => {
    const crop = coverRect(1000, 1000, 0.5);
    expect(crop.sh).toBe(1000);
    expect(crop.sw).toBe(500);
    expect(crop.sx).toBe(250);
    expect(crop.sy).toBe(0);
  });

  it('una imagen más alta se recorta arriba y abajo, centrada', () => {
    const crop = coverRect(500, 2000, 0.5);
    expect(crop.sw).toBe(500);
    expect(crop.sh).toBe(1000);
    expect(crop.sx).toBe(0);
    expect(crop.sy).toBe(500);
  });

  it('el recorte siempre tiene la proporción pedida, sea cual sea el tamaño de la imagen (chica o grande)', () => {
    [[40, 70], [403, 638], [4000, 3000], [3000, 4000]].forEach(([w, h]) => {
      const { sw, sh } = coverRect(w!, h!, PACK_TEMPLATE.ratio);
      expect(sw / sh).toBeCloseTo(PACK_TEMPLATE.ratio, 3);
    });
  });
});
