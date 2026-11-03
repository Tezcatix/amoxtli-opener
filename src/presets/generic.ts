import type { TierSystem } from '../types';

/** Cinco niveles genéricos, sin vocabulario de ningún juego. */
export const generic5: TierSystem = {
  hitFrom: 3,
  levels: [
    { key: 'common', label: 'Common', color: '#9aa0a6', keywords: ['common'], vfx: 'matte' },
    { key: 'uncommon', label: 'Uncommon', color: '#5fb878', keywords: ['uncommon'], vfx: 'shimmer' },
    { key: 'rare', label: 'Rare', color: '#4a90d9', keywords: ['rare'], vfx: 'holo' },
    {
      key: 'epic',
      label: 'Epic',
      color: '#a463d6',
      keywords: ['epic'],
      vfx: 'rainbow',
      hit: { burst: 30, flash: 0.4, rays: 0.4, anticipationMs: 400 },
    },
    {
      key: 'legendary',
      label: 'Legendary',
      color: '#f2b53a',
      keywords: ['legendary'],
      vfx: 'cross',
      hit: { burst: 60, flash: 0.7, rays: 0.8, anticipationMs: 700 },
    },
  ],
};
