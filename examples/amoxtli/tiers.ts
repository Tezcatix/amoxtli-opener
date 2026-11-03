import type { HitProfile, TierSystem } from '../../src/types';

const hit = (burst: number, flash: number, rays: number, anticipationMs: number): HitProfile => ({
  burst,
  flash,
  rays,
  anticipationMs,
});

/**
 * Rarezas de Amoxtli. Las palabras clave cubren las 45 rarezas del catálogo (CardRarity) y se evalúan
 * del nivel más alto al más bajo, por eso "Special Illustration Rare" cae en `special` y no en
 * `illustration`, y "Rare Holo VMAX" en `ultra` y no en `holo`.
 *
 * Los `vfx` siguen la escala de efectos de la app (config/installation.php → card_rarities.effects):
 *   none → 'matte' · shine → 'shimmer' · foil → 'holo' · prism → 'rainbow' · prism-gold → 'cross'
 *
 * Colores: paleta de rarezas del brand (azul = rara, verde = holo, violeta = ultra) y dorado para las
 * ilustraciones, igual que los íconos de rareza. El violeta de marca queda para la interacción.
 */
export const amoxtliTiers: TierSystem = {
  hitFrom: 4,
  levels: [
    {
      key: 'common',
      label: 'Común',
      color: '#9ca3af',
      keywords: ['common', 'promo', 'unknown', 'classic'],
      vfx: 'matte',
    },
    { key: 'uncommon', label: 'Poco común', color: '#cbd5e1', keywords: ['uncommon'], vfx: 'matte' },
    { key: 'rare', label: 'Rara', color: '#60a5fa', keywords: ['rare'], vfx: 'shimmer' },
    {
      key: 'holo',
      label: 'Holo',
      color: '#4ade80',
      keywords: ['holo', 'shiny', 'shining', 'prism', 'break', 'prime', 'legend', 'star', 'lv.x'],
      vfx: 'shimmer',
    },
    {
      key: 'ultra',
      label: 'Ultra Rara',
      color: '#a78bfa',
      keywords: ['double', 'ultra', 'ace', 'amazing', 'radiant', 'vmax', 'vstar', 'gx', ' ex'],
      vfx: 'holo',
      hit: hit(20, 0.25, 0.3, 300),
    },
    {
      key: 'illustration',
      label: 'Ilustración Rara',
      color: '#ffc83d',
      keywords: ['illustration', 'gallery', 'futuristic', 'black white'],
      vfx: 'rainbow',
      hit: hit(40, 0.4, 0.5, 450),
    },
    {
      key: 'special',
      label: 'Ilustración Especial',
      color: '#ffd466',
      keywords: ['special illustration'],
      vfx: 'rainbow',
      hit: hit(60, 0.55, 0.65, 600),
    },
    {
      key: 'hyper',
      label: 'Hiper Rara',
      color: '#fff3c4',
      keywords: ['hyper', 'secret', 'rainbow'],
      vfx: 'cross',
      hit: hit(90, 0.75, 0.85, 750),
    },
  ],
};
