import type { Labels } from '../types';

/**
 * Textos de reserva (en inglés) para las etiquetas que el host no pase. Los textos propios se pasan en `options.labels` (en el idioma que se
 * quiera) y se pueden cambiar después con `opener.update({ labels })`. No es una lista de idiomas: hay una sola entrada.
 */
export const defaultLabels: Labels = {
  skip: 'Skip',
  exit: 'Exit',
  swipeToOpen: 'Swipe across the top to open',
  tapToOpen: 'Tap to open',
  choosePack: 'Choose a pack',
  browseHaul: 'Drag to browse your cards',
  liftToInspect: 'Swipe a card up to see it up close',
  selectPack: 'Click to select · Hold to open',
  swipeOrHold: 'Swipe along the dotted line, or hold below it, to open',
  seeAllPacks: 'Click the box to see all packs',
  tapToReveal: 'Tap to reveal',
  continue: 'Continue',
  collect: 'Collect',
  bestPull: 'Best pull',
  newBadge: 'New',
  opening: 'Opening…',
  openFailed: 'We could not open the pack.',
  retry: 'Retry',
  close: 'Close',
  announce: (position, total, name, tierLabel) => `Card ${position} of ${total}: ${name}, ${tierLabel}`,
};
