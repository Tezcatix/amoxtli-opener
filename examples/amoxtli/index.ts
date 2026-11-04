import type { Labels, PackOpenerOptions } from '../../src/types';
import { amoxtliTiers } from './tiers';

export { amoxtliTiers } from './tiers';

/** Tokens de resources/css/app.css (@theme). Oscuro primero; el violeta solo marca interacción. */
export const amoxtliTheme: Record<string, string> = {
  '--ao-bg': 'radial-gradient(120% 90% at 50% 0%, #1d2137 0%, #121629 45%, #0f1026 100%)',
  '--ao-fg': '#f4f5f6',
  '--ao-accent': '#604aff',
  '--ao-on-accent': '#ffffff',
  '--ao-radius': '12px',
  '--ao-font': "'Satoshi', -apple-system, 'Segoe UI', Roboto, ui-sans-serif, system-ui, sans-serif",
};

/** Tono de marca: claro, conciso, sin exclamaciones ni jerga. */
export const amoxtliLabels: Labels = {
  skip: 'Saltar',
  exit: 'Salir',
  swipeToOpen: 'Desliza por la parte de arriba para abrir',
  tapToOpen: 'Toca para abrir',
  choosePack: 'Elige tu sobre',
  browseHaul: 'Desliza para ver tus cartas',
  liftToInspect: 'Desliza la carta hacia arriba para verla mejor',
  selectPack: 'Click para seleccionar · Mantén presionado para abrir',
  swipeOrHold: 'Desliza por la línea punteada, o mantén presionado debajo de ella, para abrir',
  seeAllPacks: 'Click en la caja para ver los sobres',
  tapToReveal: 'Toca para revelar',
  continue: 'Continuar',
  collect: 'Agregar a mi colección',
  bestPull: 'Mejor carta',
  newBadge: 'Nueva',
  opening: 'Abriendo sobre…',
  openFailed: 'No se pudo abrir el sobre.',
  retry: 'Reintentar',
  close: 'Cerrar',
  announce: (position, total, name, tierLabel) => `Carta ${position} de ${total}: ${name}, ${tierLabel}`,
};

/** Formato de carta del TCG (63 × 88 mm). */
export const AMOXTLI_CARD_RATIO = 63 / 88;

export type AmoxtliPreset = Required<
  Pick<PackOpenerOptions, 'tiers' | 'theme' | 'labels' | 'pack' | 'cardBack' | 'cardAspectRatio' | 'box'>
>;

/**
 * Todo lo visual de Amoxtli en un solo objeto, para repartir en `createPackOpener({ ...amoxtliPreset(), code, redeem, mount })`.
 * `assetsBase` es la URL (sin barra final) donde se sirven `pack-front-crop.png`, `card-back.svg` y los de la caja (`box-front.svg`, `box-lid.svg`, `box-side.svg`).
 */
export function amoxtliPreset(assetsBase = '/images/opener'): AmoxtliPreset {
  return {
    tiers: amoxtliTiers,
    theme: amoxtliTheme,
    labels: amoxtliLabels,
    cardAspectRatio: AMOXTLI_CARD_RATIO,
    cardBack: `${assetsBase}/card-back.svg`,
    box: { front: `${assetsBase}/box-front.svg`, lid: `${assetsBase}/box-lid.svg`, side: `${assetsBase}/box-side.svg`, accent: '#8b7bff' },
    pack: {
      art: `${assetsBase}/pack-front-crop.png`,
      accent: '#604aff',
      tear: { line: 'top', minLengthRatio: 0.8 },
    },
  };
}
