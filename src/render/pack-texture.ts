import type { PackTexture } from '../types';
import { coverRect } from './pack-size';

/** La textura propia ya con todos sus valores y lista para usarse. */
export interface ResolvedPackTexture {
  src: string;
  blend: NonNullable<PackTexture['blend']>;
  opacity: number;
  repeat: number;
}

/** Lo que resulta de poner la textura sobre un arte. */
export interface ComposedArt {
  /** El arte con la textura ya mezclada (data URI): se usa en lugar del original en el 2D y en el 3D. */
  art: string;
}

/** Lado mayor (px) del arte compuesto: suficiente para verse nítido en el sobre sin gastar memoria. */
const MAX_SIDE = 1024;

const COMPOSITE: Record<ResolvedPackTexture['blend'], GlobalCompositeOperation> = {
  overlay: 'overlay',
  'soft-light': 'soft-light',
  multiply: 'multiply',
  screen: 'screen',
  normal: 'source-over',
};

const cache = new Map<string, ComposedArt | null>();
const pending = new Map<string, Promise<ComposedArt | null>>();

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Completa la textura con sus valores por defecto. Devuelve null si no hay textura (el modo por defecto: el sobre se ve exactamente como su
 * arte), si no trae `src` o si está desactivada (`enabled: false` o `texture: false`).
 */
export function resolvePackTexture(texture: PackTexture | false | undefined): ResolvedPackTexture | null {
  if (!texture || texture.enabled === false || !texture.src) {
    return null;
  }
  return {
    src: texture.src,
    blend: texture.blend ?? 'overlay',
    opacity: clamp(texture.opacity ?? 0.5, 0, 1),
    repeat: clamp(texture.repeat ?? 1, 0.25, 32),
  };
}

/** Clave con la que se guarda el arte compuesto: el mismo arte con otra textura (o ajustes) es otro resultado. */
export function composedKey(art: string, texture: ResolvedPackTexture): string {
  return `${art}|${texture.src}|${texture.blend}|${texture.opacity}|${texture.repeat}`;
}

/** El arte compuesto ya calculado, si existe (sin esperar nada). */
export function peekComposedArt(art: string, texture: ResolvedPackTexture): ComposedArt | null {
  return cache.get(composedKey(art, texture)) ?? null;
}

const loadImage = (doc: Document, src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const view = doc.defaultView;
    if (!view || typeof view.Image === 'undefined') {
      resolve(null);
      return;
    }
    const image = new view.Image();
    image.crossOrigin = 'anonymous';
    image.onload = (): void => resolve(image);
    image.onerror = (): void => resolve(null);
    image.src = src;
  });

/** Dibuja la textura repetida `repeat` veces a lo ancho (con repeat 1 cubre todo el sobre), sin deformarla. */
function drawTiled(context: CanvasRenderingContext2D, texture: HTMLImageElement, width: number, height: number, repeat: number): void {
  const tileW = width / repeat;
  const tileH = tileW * ((texture.naturalHeight || 1) / (texture.naturalWidth || 1));
  for (let y = 0; y < height; y += tileH) {
    for (let x = 0; x < width; x += tileW) {
      context.drawImage(texture, x, y, tileW, tileH);
    }
  }
}

/**
 * Mezcla la textura sobre el arte del sobre y devuelve el resultado como imagen. La forma del arte se conserva (las zonas transparentes siguen
 * transparentes). Devuelve null si algo no se puede leer (imagen rota o de otro origen sin permiso CORS, o sin canvas): el sobre sigue con su arte.
 */
export function composePackArt(art: string, texture: ResolvedPackTexture, ratio: number, doc: Document = document): Promise<ComposedArt | null> {
  const key = composedKey(art, texture);
  if (cache.has(key)) {
    return Promise.resolve(cache.get(key) ?? null);
  }
  const running = pending.get(key);
  if (running) {
    return running;
  }
  const task = Promise.all([loadImage(doc, art), loadImage(doc, texture.src)])
    .then(([base, overlay]): ComposedArt | null => {
      if (!base || !overlay) {
        return null;
      }
      try {
        // El resultado ya tiene la forma del sobre (`ratio`): la imagen se ajusta recortando lo que sobre.
        const naturalW = base.naturalWidth || 512;
        const width = Math.max(1, Math.round(Math.min(naturalW, MAX_SIDE * ratio)));
        const height = Math.max(1, Math.round(width / ratio));
        const crop = base.naturalWidth > 0 && base.naturalHeight > 0 ? coverRect(base.naturalWidth, base.naturalHeight, ratio) : null;
        const canvas = doc.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          return null;
        }
        const drawBase = (): void => {
          if (crop) {
            context.drawImage(base, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
          } else {
            context.drawImage(base, 0, 0, width, height);
          }
        };
        drawBase();
        context.globalCompositeOperation = COMPOSITE[texture.blend];
        context.globalAlpha = texture.opacity;
        drawTiled(context, overlay, width, height, texture.repeat);
        // La textura no puede salirse de la silueta del arte.
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'destination-in';
        drawBase();
        return { art: canvas.toDataURL('image/png') };
      } catch {
        return null;
      }
    })
    .then((result) => {
      cache.set(key, result);
      pending.delete(key);
      return result;
    });
  pending.set(key, task);
  return task;
}
