import { el } from './dom';

/** Zonas del sobre: de arriba hasta un poco debajo de la línea punteada es la de corte (se desliza); el resto, el cuerpo, es la de mantener presionado. */
export const CUT_ZONE_BELOW_SEAM = 0.08;

export interface ZoneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ZonesEnvironment {
  doc: Document;
  stage: HTMLElement;
  /** Registra algo que se limpia al terminar la fase. */
  onCleanup: (fn: () => void) => void;
}

/**
 * Marca sobre el sobre las dos zonas: la de corte (arriba, se desliza) y la del cuerpo (se mantiene presionado). Sigue al sobre cada cuadro
 * (`rectOf` da dónde está en pantalla) y se ve solo mientras `visible()` sea verdadero. Con `withCut() === false` todo el sobre es una sola zona.
 */
export function trackZones(
  { doc, stage, onCleanup }: ZonesEnvironment,
  rectOf: () => ZoneRect | null,
  strip: () => number,
  visible: () => boolean,
  withCut: () => boolean = () => true,
): void {
  const cutZone = el(doc, 'div', 'ao-zone ao-zone--cut', { 'aria-hidden': 'true' });
  const holdZone = el(doc, 'div', 'ao-zone ao-zone--hold', { 'aria-hidden': 'true' });
  stage.append(cutZone, holdZone);
  const view = doc.defaultView;
  let frameId = 0;
  const update = (): void => {
    const rect = rectOf();
    const on = Boolean(rect && rect.width > 0 && visible());
    const cutShown = withCut();
    cutZone.classList.toggle('ao-zone--on', on && cutShown);
    holdZone.classList.toggle('ao-zone--on', on);
    holdZone.classList.toggle('ao-zone--full', !cutShown);
    if (rect && on) {
      const bounds = stage.getBoundingClientRect();
      const cutHeight = cutShown ? rect.height * Math.min(1, strip() + CUT_ZONE_BELOW_SEAM) : 0;
      const left = `${(rect.left - bounds.left).toFixed(0)}px`;
      const width = `${rect.width.toFixed(0)}px`;
      Object.assign(cutZone.style, { left, width, top: `${(rect.top - bounds.top).toFixed(0)}px`, height: `${cutHeight.toFixed(0)}px` });
      Object.assign(holdZone.style, { left, width, top: `${(rect.top - bounds.top + cutHeight).toFixed(0)}px`, height: `${(rect.height - cutHeight).toFixed(0)}px` });
    }
    frameId = view?.requestAnimationFrame(update) ?? 0;
  };
  update();
  onCleanup(() => view?.cancelAnimationFrame(frameId));
}
