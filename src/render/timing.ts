import type { TimingOptions } from '../types';
import { definedOnly } from './util';

/** Los tiempos ya resueltos: todos presentes y dentro de sus límites. */
export type ResolvedTiming = Required<TimingOptions>;

/** Valores de siempre: lo que vale cada tiempo si el host no pasa `timing`. */
export const DEFAULT_TIMING: ResolvedTiming = {
  holdToOpenMs: 6000,
  holdArmMs: 400,
  lastCardHoldMs: 1800,
  summaryStaggerMs: 70,
  packDropMs: 900,
  flipMs: 700,
  pace: 1,
};

/** Menos que esto, un clic corto (que dura ~350 ms) se confundiría con mantener presionado. */
export const MIN_HOLD_ARM_MS = 350;
export const MIN_PACE = 0.25;
export const MAX_PACE = 4;

/** Mezcla los tiempos del host con los de siempre y limita los que tienen un rango válido. */
export function resolveTiming(options?: TimingOptions): ResolvedTiming {
  const timing = { ...DEFAULT_TIMING, ...definedOnly(options) };
  return {
    ...timing,
    pace: Math.min(MAX_PACE, Math.max(MIN_PACE, timing.pace)),
    holdArmMs: Math.max(MIN_HOLD_ARM_MS, timing.holdArmMs),
  };
}
