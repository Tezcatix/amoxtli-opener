import type { CardInput } from '../types';

/** Tope de cartas por apertura: una respuesta mayor es un error del servidor (o un intento de agotar la memoria del dispositivo), no un sobre. */
export const MAX_CARDS_PER_OPENING = 500;

/** Comprueba la forma de lo que devuelve `redeem` antes de tocar el DOM; si no cuadra lanza, y la persona ve el error de canje en lugar de una pantalla rota. */
export function assertValidCards(cards: unknown): asserts cards is CardInput[] {
  if (!Array.isArray(cards)) {
    throw new Error('redeem must return an array of cards (or { cards }).');
  }
  if (cards.length > MAX_CARDS_PER_OPENING) {
    throw new Error(`redeem returned ${cards.length} cards; the limit is ${MAX_CARDS_PER_OPENING}.`);
  }
  cards.forEach((card: unknown, index) => {
    const candidate = card as Partial<CardInput> | null;
    if (candidate === null || typeof candidate !== 'object' || typeof candidate.id !== 'string' || typeof candidate.image !== 'string') {
      throw new Error(`Card ${index} is invalid: it needs a string "id" and a string "image".`);
    }
  });
}
