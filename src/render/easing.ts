/** Funciones de suavizado: reciben el avance `t` (0..1) de una animación y devuelven el avance ya curvado. */

/** Limita un valor a 0..1. */
export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export const easeIn = (t: number): number => t * t * t;
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Pasa de largo el final y vuelve (rebote suave de llegada). */
export const easeOutBack = (t: number): number => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
