/**
 * La plantilla del sobre: la forma con la que **siempre** se dibuja, sea cual sea la imagen que se cargue. Es de la librería (no una opción) para
 * que el sobre mida lo mismo en todas partes y el corte caiga siempre en el mismo sitio: la forma del sobre, la tira que se arranca y las zonas de
 * corte y de apertura dependen de ella. La imagen se ajusta a esta forma (`coverRect`), no al revés.
 *
 *  - `ratio`: ancho / alto. Un sobre real mide ~64 × 119 mm (0.54); las cartas miden 0.716. Con 0.632 el sobre se ve proporcionado junto a ellas.
 *  - `strip`: fracción del alto, desde arriba, donde está la línea punteada: lo que se arranca al rasgar.
 *  - `art`: tamaño recomendado de la imagen (cumple `ratio`); `minWidthPx` es el ancho mínimo para que no se vea borrosa en el carrusel 3D.
 */
export const PACK_TEMPLATE = {
  ratio: 0.632,
  strip: 0.185,
  art: { width: 800, height: 1266, minWidthPx: 512 },
} as const;

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Zona de una imagen `sourceWidth × sourceHeight` que llena un rectángulo de proporción `ratio` (ancho / alto) sin deformarse: se recorta lo que
 * sobra, centrado. Una imagen que ya tiene esa proporción no se recorta.
 */
export function coverRect(sourceWidth: number, sourceHeight: number, ratio: number): CropRect {
  const sourceRatio = sourceWidth / sourceHeight;
  if (sourceRatio > ratio) {
    const sw = sourceHeight * ratio;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  const sh = sourceWidth / ratio;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}
