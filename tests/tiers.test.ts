import { describe, expect, it } from 'vitest';
import { generic5, hitFromOf, resolveTier } from '../src';
import type { CardInput, TierSystem } from '../src';

const card = (rarity?: string, tier?: number) => ({
  id: 'c1',
  image: 'x.png',
  ...(rarity !== undefined ? { rarity } : {}),
  ...(tier !== undefined ? { tier } : {}),
});

describe('resolveTier (generic5)', () => {
  it.each([
    ['common', 0],
    ['Uncommon', 1],
    ['RARE', 2],
    ['epic', 3],
    ['Legendary', 4],
  ])('%s → tier %i', (rarity, tier) => {
    expect(resolveTier(card(rarity), generic5)).toEqual({ tier });
  });

  it('la palabra clave más específica gana (uncommon antes que common)', () => {
    expect(resolveTier(card('Uncommon'), generic5).tier).toBe(1);
  });

  it('prefiere card.tier sobre la rareza', () => {
    expect(resolveTier(card('common', 3), generic5).tier).toBe(3);
  });

  it('avisa de una rareza desconocida en lugar de caer en silencio', () => {
    const { tier, warning } = resolveTier(card('Mythic'), generic5);
    expect(tier).toBe(0);
    expect(warning?.code).toBe('UNKNOWN_RARITY');
  });

  it('sin rareza es tier 0 sin warning', () => {
    expect(resolveTier(card(), generic5)).toEqual({ tier: 0 });
  });

  it('limita un tier fuera de rango y avisa', () => {
    const { tier, warning } = resolveTier(card(undefined, 99), generic5);
    expect(tier).toBe(4);
    expect(warning?.code).toBe('TIER_OUT_OF_RANGE');
  });

  it('usa un resolvedor propio si existe', () => {
    const system = { ...generic5, resolve: () => 3 };
    expect(resolveTier(card('common'), system).tier).toBe(3);
  });
});

/** Un sistema declarado por quien usa la librería: qué valor lleva qué efecto, sin depender de cómo escribe la librería las rarezas. */
const pokemon: TierSystem = {
  field: 'meta.rarity',
  levels: [
    { key: 'common', label: 'Común', color: '#999', values: ['Common', 'Uncommon'], vfx: 'matte' },
    { key: 'holo', label: 'Holo', color: '#4ade80', values: ['Rare Holo', 'Rare Holo EX'], vfx: 'holo' },
    { key: 'ultra', label: 'Ultra', color: '#a78bfa', values: ['Rare Ultra', 'Rare Holo VMAX'], vfx: 'rainbow', hit: { burst: 40, flash: 0.5, rays: 0.5, anticipationMs: 500 } },
    { key: 'secret', label: 'Secreta', color: '#f2b53a', values: ['Rare Rainbow'], vfx: 'cross', hit: { burst: 70, flash: 0.8, rays: 0.9, anticipationMs: 800 } },
  ],
};
const pk = (rarity: string, extra: Partial<CardInput> = {}): CardInput => ({ id: 'p1', image: 'x.png', meta: { rarity }, ...extra });

describe('resolveTier con una clasificación propia', () => {
  it('values: cada tipo exacto lleva su nivel, tal como lo declaró el host', () => {
    expect(resolveTier(pk('Common'), pokemon)).toEqual({ tier: 0 });
    expect(resolveTier(pk('Rare Holo EX'), pokemon)).toEqual({ tier: 1 });
    expect(resolveTier(pk('Rare Holo VMAX'), pokemon)).toEqual({ tier: 2 });
    expect(resolveTier(pk('rare rainbow'), pokemon)).toEqual({ tier: 3 });
  });

  it('values es exacto: «Rare Holo» no atrapa «Rare Holo VMAX» ni al revés', () => {
    expect(resolveTier(pk('Rare Holo'), pokemon).tier).toBe(1);
    expect(resolveTier(pk('Rare Holo VMAX'), pokemon).tier).toBe(2);
  });

  it('un valor que el host no declaró avisa y cae al nivel 0', () => {
    const { tier, warning } = resolveTier(pk('Amazing Rare'), pokemon);
    expect(tier).toBe(0);
    expect(warning?.code).toBe('UNKNOWN_RARITY');
  });

  it('field puede ser otra clasificación (la ruta entra en meta) y no solo la rareza', () => {
    const byType: TierSystem = {
      field: 'meta.type',
      levels: [
        { key: 'normal', label: 'Normal', color: '#aaa', values: ['Colorless'], vfx: 'matte' },
        { key: 'fire', label: 'Fuego', color: '#f97316', values: ['Fire'], vfx: 'holo', hit: { burst: 30, flash: 0.4, rays: 0.4, anticipationMs: 300 } },
      ],
    };
    expect(resolveTier({ id: 'a', image: 'x', meta: { type: 'Fire' } }, byType).tier).toBe(1);
  });

  it('field como función puede devolver una lista: basta con que un valor coincida', () => {
    const multi: TierSystem = {
      field: (card) => card.meta?.types,
      levels: [
        { key: 'base', label: 'Base', color: '#aaa', vfx: 'matte' },
        { key: 'water', label: 'Agua', color: '#38bdf8', values: ['Water'], vfx: 'shimmer' },
      ],
    };
    expect(resolveTier({ id: 'a', image: 'x', meta: { types: ['Fire', 'Water'] } }, multi).tier).toBe(1);
  });

  it('when permite una regla propia que combina varios datos y manda sobre el valor', () => {
    const rules: TierSystem = {
      ...pokemon,
      levels: [
        ...pokemon.levels,
        { key: 'promo', label: 'Promo', color: '#fff', when: (card) => card.foil === true && Number(card.meta?.number) >= 100, vfx: 'cross', hit: { burst: 80, flash: 0.9, rays: 1, anticipationMs: 900 } },
      ],
    };
    expect(resolveTier(pk('Common', { foil: true, meta: { rarity: 'Common', number: 120 } }), rules).tier).toBe(4);
    expect(resolveTier(pk('Common'), rules).tier).toBe(0);
  });

  it('keywords sigue funcionando junto a values', () => {
    const mixed: TierSystem = {
      levels: [
        { key: 'base', label: 'Base', color: '#aaa', vfx: 'matte' },
        { key: 'holo', label: 'Holo', color: '#4ade80', keywords: ['holo'], values: ['Radiant'], vfx: 'holo' },
      ],
    };
    expect(resolveTier({ id: 'a', image: 'x', rarity: 'Rare Holo GX' }, mixed).tier).toBe(1);
    expect(resolveTier({ id: 'a', image: 'x', rarity: 'radiant' }, mixed).tier).toBe(1);
  });
});

describe('hitFromOf', () => {
  it('por defecto es el primer nivel con un hit definido', () => {
    expect(hitFromOf(pokemon)).toBe(2);
  });

  it('un hitFrom explícito gana', () => {
    expect(hitFromOf({ ...pokemon, hitFrom: 3 })).toBe(3);
  });

  it('sin ningún hit, ninguna carta lo dispara', () => {
    expect(hitFromOf({ levels: [{ key: 'a', label: 'A', color: '#fff', vfx: 'matte' }] })).toBe(1);
  });
});
