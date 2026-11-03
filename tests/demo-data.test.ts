import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveTier } from '../src';
import { amoxtliTiers } from '../examples/amoxtli';

interface DemoCard { id: string; name: string; rarity: string; image: string }
const { packs } = JSON.parse(readFileSync(resolve(process.cwd(), 'demo/data/packs.json'), 'utf8')) as {
  packs: Record<string, { label: string; cards: DemoCard[] }>;
};

describe('datos falsos de la demo', () => {
  it('hay 20 sobres con códigos únicos y 6 cartas cada uno', () => {
    expect(Object.keys(packs)).toHaveLength(20);
    Object.values(packs).forEach((pack) => expect(pack.cards).toHaveLength(6));
  });

  it('los ids de carta no se repiten entre sobres', () => {
    const ids = Object.values(packs).flatMap((pack) => pack.cards.map((card) => card.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada carta tiene su imagen y una rareza que el preset de Amoxtli reconoce', () => {
    Object.values(packs).flatMap((pack) => pack.cards).forEach((card) => {
      expect(existsSync(resolve(process.cwd(), 'demo', card.image)), card.image).toBe(true);
      expect(resolveTier({ id: card.id, image: card.image, rarity: card.rarity }, amoxtliTiers).warning).toBeUndefined();
    });
  });

  it('los sobres cubren de común a hiper rara', () => {
    const tiers = new Set(
      Object.values(packs).flatMap((pack) => pack.cards.map((card) => resolveTier({ id: card.id, image: '', rarity: card.rarity }, amoxtliTiers).tier)),
    );
    expect(tiers.has(0)).toBe(true);
    expect(tiers.has(amoxtliTiers.levels.length - 1)).toBe(true);
  });
});
