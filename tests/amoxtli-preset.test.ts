// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PACK_TEMPLATE, createPackOpener, resolveTier } from '../src';
import { defaultLabels } from '../src/render/labels';
import {
  AMOXTLI_CARD_RATIO,
  amoxtliPreset,
  amoxtliTheme,
  amoxtliTiers,
} from '../examples/amoxtli';

/** Las 45 rarezas de resources/backups/card/CardRarity.json de Amoxtli, con el nivel esperado. */
const RARITIES: Record<string, string[]> = {
  common: ['Common', 'Unknown', 'Promo', 'Classic Collection'],
  uncommon: ['Uncommon'],
  rare: ['Rare', 'Pikachu Rare', 'MEGA_ATTACK_RARE'],
  holo: [
    'Rare Holo', 'Rare Shining', 'Rare Holo Star', 'Rare Holo LV.X', 'Rare Prime', 'LEGEND', 'Rare BREAK',
    'Rare Prism Star', 'Rare Shiny', 'Rare Holo V', 'Holo Rare V', 'Shiny Rare',
  ],
  ultra: [
    'Rare Holo EX', 'Rare Holo ex', 'Rare Ultra', 'Rare ACE', 'Rare Holo GX', 'Rare Shiny GX', 'Rare Holo VMAX',
    'Holo Rare VMAX', 'Rare Holo VSTAR', 'Holo Rare VSTAR', 'Amazing Rare', 'Radiant Rare', 'Double Rare',
    'Ultra Rare', 'Shiny Ultra Rare', 'ACE SPEC Rare',
  ],
  illustration: ['Illustration Rare', 'Trainer Gallery Rare Holo', 'Black White Rare', 'Futuristic Rare'],
  special: ['Special Illustration Rare'],
  hyper: ['Rare Secret', 'Rare Rainbow', 'Hyper Rare', 'Mega Hyper Rare'],
};

describe('amoxtliTiers', () => {
  const cases = Object.entries(RARITIES).flatMap(([key, names]) => names.map((name) => [name, key] as const));

  it('cubre las 45 rarezas del catálogo', () => {
    expect(cases).toHaveLength(45);
  });

  it.each(cases)('%s → %s', (rarity, key) => {
    const { tier, warning } = resolveTier({ id: 'x', image: 'x.png', rarity }, amoxtliTiers);
    expect(amoxtliTiers.levels[tier]?.key).toBe(key);
    expect(warning).toBeUndefined();
  });

  it('el golpe empieza en Ultra Rara y hay perfil de hit desde ahí', () => {
    expect(amoxtliTiers.hitFrom).toBe(4);
    amoxtliTiers.levels.forEach((level, index) => {
      expect(Boolean(level.hit)).toBe(index >= 4);
    });
  });

  it('la intensidad del hit crece con la rareza', () => {
    const hits = amoxtliTiers.levels.flatMap((level) => (level.hit ? [level.hit] : []));
    hits.slice(1).forEach((hit, i) => {
      expect(hit.burst).toBeGreaterThan(hits[i]!.burst);
      expect(hit.anticipationMs).toBeGreaterThan(hits[i]!.anticipationMs);
    });
  });
});

describe('recursos gráficos', () => {
  const read = (name: string) => readFileSync(resolve(process.cwd(), 'examples/amoxtli/assets', name), 'utf8');

  it.each([
    ['card-back.svg', AMOXTLI_CARD_RATIO],
  ])('%s es XML válido, autocontenido y con la proporción correcta', (file, ratio) => {
    const xml = read(file);
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();

    const svg = doc.documentElement;
    const [, , w, h] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(w! / h!).toBeCloseTo(ratio, 2);

    expect(xml).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(xml).not.toMatch(/<image|<script|font-family|@import/);

    const ids = new Set([...doc.querySelectorAll('[id]')].map((node) => node.getAttribute('id')));
    const refs = [...xml.matchAll(/(?:href="#|url\(#)([\w-]+)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    refs.forEach((id) => expect(ids.has(id!)).toBe(true));
  });

  it('pack-front-crop.png tiene la proporción de la plantilla (si no, se recorta al ajustarlo)', () => {
    const png = readFileSync(resolve(process.cwd(), 'examples/amoxtli/assets/pack-front-crop.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16) / png.readUInt32BE(20)).toBeCloseTo(PACK_TEMPLATE.ratio, 2);
  });

  it('usa solo colores de la paleta de marca', () => {
    const allowed = new Set([
      '#241c52', '#1b1638', '#0f1026', '#604aff', '#8b7bff', '#4c3acc', '#ffffff', '#a78bfa', '#ffc83d', '#f4f5f6',
    ]);
    ['card-back.svg'].forEach((file) => {
      const colors = [...read(file).matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
      colors.forEach((color) => expect(allowed.has(color), `${file}: ${color}`).toBe(true));
    });
  });
});

describe('amoxtliPreset', () => {
  it('traduce todos los textos de la interfaz', () => {
    const { labels } = amoxtliPreset();
    expect(Object.keys(labels).sort()).toEqual(Object.keys(defaultLabels).sort());
  });

  it('usa los tokens de marca: violeta de acción y fuente Satoshi', () => {
    expect(amoxtliTheme['--ao-accent']).toBe('#604aff');
    expect(amoxtliTheme['--ao-font']).toContain('Satoshi');
  });

  it('apunta los recursos a assetsBase', () => {
    const preset = amoxtliPreset('/img');
    expect(preset.pack.art).toBe('/img/pack-front-crop.png');
    expect(preset.cardBack).toBe('/img/card-back.svg');
    expect(preset.box).toMatchObject({ front: '/img/box-front.svg', lid: '/img/box-lid.svg', side: '/img/box-side.svg' });
  });

  it('se aplica al render: sobre, dorso, tema y proporciones', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="m"></div>';
    const mount = document.getElementById('m') as HTMLElement;
    const opener = createPackOpener({
      mount,
      code: 'C1',
      redeem: async () => [{ id: 'a', image: 'a.png', name: 'Alfa', rarity: 'Special Illustration Rare' }],
      ...amoxtliPreset('/img'),
      flow: { tearMode: 'tap' },
    });
    void opener.open();

    const root = mount.querySelector('.ao-root') as HTMLElement;
    expect(root.style.getPropertyValue('--ao-accent')).toBe('#604aff');
    expect(root.style.getPropertyValue('--ao-card-ratio')).toBe(String(AMOXTLI_CARD_RATIO));
    expect(mount.querySelectorAll('.ao-pack img[src="/img/pack-front-crop.png"]')).toHaveLength(2);

    (mount.querySelector('.ao-pack') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(900);
    expect(mount.querySelector('.ao-card__face--back img')?.getAttribute('src')).toBe('/img/card-back.svg');
    expect(mount.querySelector('.ao-card')?.getAttribute('data-ao-vfx')).toBe('rainbow');

    opener.destroy();
    vi.useRealTimers();
  });
});

describe('recursos de la caja', () => {
  it.each(['box-front.svg', 'box-lid.svg', 'box-side.svg'])('%s existe y es un SVG con su proporción', (file) => {
    const svg = readFileSync(resolve(__dirname, '../examples/amoxtli/assets', file), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/viewBox="0 0 (640 440|640 120|440 440)"/);
  });
});
