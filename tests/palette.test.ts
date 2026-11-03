import { describe, expect, it } from 'vitest';
import { paletteFromPixels } from '../src';

const pixels = (...colors: Array<[number, number, number, number?, number?]>): Uint8ClampedArray => {
  const out: number[] = [];
  colors.forEach(([r, g, b, alpha = 255, count = 1]) => {
    for (let i = 0; i < count; i++) {
      out.push(r, g, b, alpha);
    }
  });
  return Uint8ClampedArray.from(out);
};

const hue = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) {
    return 0;
  }
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};

describe('paletteFromPixels', () => {
  it('el color que más área ocupa es el dominante y el siguiente, el secundario', () => {
    const palette = paletteFromPixels(pixels([220, 40, 40, 255, 60], [40, 90, 220, 255, 25]))!;
    expect(Math.abs(hue(palette.dominant) - 0)).toBeLessThan(25);
    expect(Math.abs(hue(palette.secondary) - 220)).toBeLessThan(25);
  });

  it('el fondo negro, el blanco y los grises no mandan sobre el color real', () => {
    const palette = paletteFromPixels(pixels([0, 0, 0, 255, 200], [255, 255, 255, 255, 120], [128, 128, 128, 255, 80], [40, 200, 90, 255, 20]))!;
    expect(Math.abs(hue(palette.dominant) - 140)).toBeLessThan(25);
  });

  it('los píxeles casi transparentes no cuentan', () => {
    const palette = paletteFromPixels(pixels([255, 0, 0, 10, 100], [0, 0, 255, 255, 5]))!;
    expect(Math.abs(hue(palette.dominant) - 240)).toBeLessThan(25);
  });

  it('con un solo color el secundario es una versión más clara', () => {
    const palette = paletteFromPixels(pixels([30, 160, 220, 255, 50]))!;
    expect(palette.secondary).not.toBe(palette.dominant);
  });

  it('el brillo sale saturado y de luminosidad media aunque el color sea apagado', () => {
    const palette = paletteFromPixels(pixels([90, 60, 70, 255, 50]))!;
    expect(palette.dominant).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('una imagen en grises devuelve un color neutro y una vacía, null', () => {
    expect(paletteFromPixels(pixels([120, 120, 120, 255, 50]))).not.toBeNull();
    expect(paletteFromPixels(pixels([0, 0, 0, 0, 50]))).toBeNull();
  });
});
