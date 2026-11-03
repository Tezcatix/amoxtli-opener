/** Geometría del abanico del botín. La comparten la pila (donde las cartas ya vistas van formando el abanico) y el propio abanico. */

export interface FanPose {
  tx: number;
  ty: number;
  scale: number;
  /** Grados. */
  rotate: number;
  tz: number;
  z: number;
}

/**
 * Orden de las cartas en el abanico: la más rara (la última de la pila, `>=` para que gane el empate) al
 * centro y el resto repartido a sus lados. `order[slot]` es el índice de la carta que ocupa ese lugar.
 */
export function fanOrder(tiers: readonly number[]): { order: number[]; hero: number } {
  let hero = 0;
  tiers.forEach((tier, i) => {
    if (tier >= tiers[hero]!) {
      hero = i;
    }
  });
  const rest = tiers.map((_, i) => i).filter((i) => i !== hero);
  const order = rest.slice();
  order.splice(Math.floor(rest.length / 2), 0, hero);
  return { order, hero };
}

/** Cuánto (px) se adelanta la carta enfocada; mayor que lo que sube un borde al inclinarla. */
const FOCUS_LIFT = 70;

/** Pose de la carta a `off` lugares del centro del abanico (`cardWidth` en px). */
export function fanPose(off: number, cardWidth: number): FanPose {
  const distance = Math.abs(off);
  const focus = Math.max(0, 1 - distance);
  return {
    tx: off * cardWidth * 0.33,
    ty: distance * (cardWidth * 0.085) - focus * (cardWidth * 0.12),
    scale: 0.54 + 0.14 * focus - Math.max(0, distance - 1) * 0.02,
    rotate: off * 8,
    // La carta enfocada sobresale hacia la pantalla: al inclinarse con el puntero no atraviesa a las vecinas.
    tz: -distance * 16 - off * 2 + focus * FOCUS_LIFT,
    z: Math.round(200 - distance * 10),
  };
}

/**
 * Pose de una carta ya vista mientras se sigue abriendo la pila: el abanico se va armando abajo, más chico y
 * separado, sin tapar la carta que se acaba de revelar. La de arriba de la pila (`isTop`, la última) sigue grande al centro.
 */
export function stowedPose(off: number, cardWidth: number, isTop: boolean): FanPose {
  if (isTop) {
    return { tx: 0, ty: 0, scale: 1, rotate: 0, tz: 0, z: 200 };
  }
  const distance = Math.abs(off);
  return {
    tx: off * cardWidth * 0.24,
    ty: cardWidth * 1.02 + distance * cardWidth * 0.03,
    scale: 0.4,
    rotate: off * 6,
    tz: -distance * 16 - off * 2,
    z: Math.round(200 - distance * 10),
  };
}

/** Mezcla dos poses: `k` = 0 es `from`, 1 es `to`. */
export function mixPose(from: FanPose, to: FanPose, k: number): FanPose {
  const mix = (a: number, b: number): number => a + (b - a) * k;
  return {
    tx: mix(from.tx, to.tx),
    ty: mix(from.ty, to.ty),
    scale: mix(from.scale, to.scale),
    rotate: mix(from.rotate, to.rotate),
    tz: mix(from.tz, to.tz),
    z: Math.round(mix(from.z, to.z)),
  };
}

export function poseTransform(pose: FanPose): string {
  return `translateZ(${pose.tz.toFixed(2)}px) translate(${pose.tx.toFixed(0)}px, ${pose.ty.toFixed(0)}px) rotate(${pose.rotate.toFixed(2)}deg) scale(${pose.scale.toFixed(3)})`;
}
