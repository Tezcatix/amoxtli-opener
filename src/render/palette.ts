/** Los dos colores que mejor representan una imagen, ya ajustados para usarse como brillo (saturados y de luminosidad media). */
export interface Palette {
  /** El que más área ocupa. */
  dominant: string;
  /** El siguiente que más ocupa y se distingue del dominante (si no hay otro, una versión más clara del dominante). */
  secondary: string;
}

/** Lado mayor (px) al que se reduce la imagen para muestrearla: pocos píxeles bastan y es barato. */
const SAMPLE_SIZE = 40;
const HUE_BINS = 24;
/** Distancia mínima de tono (en casillas de `HUE_BINS`) entre el dominante y el secundario. */
const MIN_HUE_GAP = 3;

const cache = new Map<string, Palette | null>();
const pending = new Map<string, Promise<Palette | null>>();

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`;

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return [h * 60, s, l];
};

const hslToHex = (h: number, s: number, l: number): string => {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): number => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return toHex(channel(0), channel(8), channel(4));
};

/** Un color de brillo: se conserva el tono, pero se sube la saturación y se lleva la luminosidad a un rango que se vea sobre fondo oscuro. */
const asGlow = (r: number, g: number, b: number): string => {
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToHex(h, Math.max(s, 0.55), Math.min(0.62, Math.max(0.5, l)));
};

const lighten = (hex: string, amount: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (channel: number): number => channel + (255 - channel) * amount;
  return toHex(mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255));
};

/**
 * Saca los dos colores principales de unos píxeles RGBA. Cada píxel pesa por su croma y por cuán lejos está de negro o blanco, así que
 * el fondo oscuro, el blanco y los grises no dominan; los píxeles casi transparentes no cuentan. Los tonos se agrupan en casillas.
 * Devuelve null si no hay ningún píxel utilizable.
 */
export function paletteFromPixels(data: ArrayLike<number>): Palette | null {
  const weight = new Array<number>(HUE_BINS).fill(0);
  const sum = Array.from({ length: HUE_BINS }, () => [0, 0, 0]);
  let grayWeight = 0;
  const gray = [0, 0, 0];
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    if (alpha < 0.5) {
      continue;
    }
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const [h, s, l] = rgbToHsl(r, g, b);
    const body = 1 - Math.abs(2 * l - 1);
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const w = chroma * chroma * body * alpha;
    if (w > 0.002) {
      const bin = Math.floor(h / (360 / HUE_BINS)) % HUE_BINS;
      weight[bin]! += w;
      sum[bin]![0]! += r * w;
      sum[bin]![1]! += g * w;
      sum[bin]![2]! += b * w;
    } else if (s < 0.2 && body > 0.05) {
      gray[0]! += r;
      gray[1]! += g;
      gray[2]! += b;
      grayWeight += 1;
    }
  }
  const total = weight.reduce((acc, value) => acc + value, 0);
  if (total <= 0) {
    if (grayWeight === 0) {
      return null;
    }
    const base = asGlow(gray[0]! / grayWeight, gray[1]! / grayWeight, gray[2]! / grayWeight);
    return { dominant: base, secondary: lighten(base, 0.35) };
  }
  const colorOf = (bin: number): string => asGlow(sum[bin]![0]! / weight[bin]!, sum[bin]![1]! / weight[bin]!, sum[bin]![2]! / weight[bin]!);
  let first = 0;
  weight.forEach((value, bin) => {
    if (value > weight[first]!) {
      first = bin;
    }
  });
  let second = -1;
  weight.forEach((value, bin) => {
    const gap = Math.min(Math.abs(bin - first), HUE_BINS - Math.abs(bin - first));
    if (gap >= MIN_HUE_GAP && value > weight[first]! * 0.2 && (second === -1 || value > weight[second]!)) {
      second = bin;
    }
  });
  const dominant = colorOf(first);
  return { dominant, secondary: second === -1 ? lighten(dominant, 0.35) : colorOf(second) };
}

/** La paleta ya calculada de esa imagen, si existe (sin esperar nada). */
export function peekPalette(src: string): Palette | null {
  return cache.get(src) ?? null;
}

/**
 * Carga la imagen, la reduce y devuelve sus dos colores principales (null si no se puede leer: otra procedencia sin permiso CORS,
 * imagen rota o sin canvas). El resultado se guarda por URL.
 */
export function extractPalette(src: string, doc: Document = document): Promise<Palette | null> {
  if (cache.has(src)) {
    return Promise.resolve(cache.get(src) ?? null);
  }
  const running = pending.get(src);
  if (running) {
    return running;
  }
  const task = new Promise<Palette | null>((resolve) => {
    const view = doc.defaultView;
    if (!view || typeof view.Image === 'undefined') {
      resolve(null);
      return;
    }
    const image = new view.Image();
    image.crossOrigin = 'anonymous';
    image.onload = (): void => {
      try {
        const scale = SAMPLE_SIZE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1);
        const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const canvas = doc.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(paletteFromPixels(context.getImageData(0, 0, width, height).data));
      } catch {
        resolve(null);
      }
    };
    image.onerror = (): void => resolve(null);
    image.src = src;
  }).then((palette) => {
    cache.set(src, palette);
    pending.delete(src);
    return palette;
  });
  pending.set(src, task);
  return task;
}
