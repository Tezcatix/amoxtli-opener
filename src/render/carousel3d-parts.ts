/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Piezas puras del carrusel 3D: carga del arte como textura, geometrías del sobre y de su borde rasgado, texturas de brillo y de reflejo, y los
 * shaders del borde luminoso. No guardan estado: reciben el espacio de nombres de three.js que pasa el host.
 */
import { clamp01 } from './easing';
import { TEAR_EDGE_STEPS } from './carousel3d-config';
import { coverRect } from './pack-size';

export type ThreeNamespace = any;

/** `fit: 'cover'` ajusta la imagen a la forma del sobre recortando lo que sobre (los SVG se estiran: deben venir ya con la proporción de la plantilla). */
export function loadArt(THREE: ThreeNamespace, src: string, ratio: number, maxAnisotropy: number, width = 512, fit: 'stretch' | 'cover' = 'stretch'): Promise<any> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      // Los SVG sin ancho/alto intrínsecos se rasterizan a un tamaño fijo con la proporción del sobre.
      const height = Math.round(width / ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      const isSvg = /^data:image\/svg|\.svg(\?|#|$)/i.test(src);
      if (fit === 'cover' && !isSvg && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const { sx, sy, sw, sh } = coverRect(image.naturalWidth, image.naturalHeight, ratio);
        context?.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
      } else {
        context?.drawImage(image, 0, 0, width, height);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;
      resolve(texture);
    };
    image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    image.src = src;
  });
}


/**
 * Borde rasgado: una cinta de ancho 1 que arranca en y = 0 y se mete hacia abajo con un filo irregular
 * (dientes al azar, determinista por `seed`). Hace de «interior» del sobre en el corte. Los tramos van en orden
 * de izquierda a derecha: con `setDrawRange` se muestra solo la parte ya rasgada, sin estirar los dientes.
 */
export function tornEdgeGeometry(THREE: ThreeNamespace, seed: number): any {
  const position: number[] = [];
  const index: number[] = [];
  let jag = 0.5;
  for (let i = 0; i <= TEAR_EDGE_STEPS; i++) {
    const noise = Math.abs((Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1);
    jag = jag * 0.15 + noise * 0.85;
    const x = -0.5 + i / TEAR_EDGE_STEPS;
    position.push(x, 0.004, 0, x, -(0.008 + jag * 0.045), 0);
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setIndex(index);
  return geometry;
}

/** Bolsa "almohada": dos hojas que abultan por el cuerpo y se aplanan en los sellos de arriba y abajo. */
export function packGeometry(THREE: ThreeNamespace, aspect: number, v0 = 0, v1 = 1): any {
  const W = 1;
  const H = aspect;
  const NX = 22;
  const NY = Math.max(4, Math.round(36 * (v1 - v0)));
  const PUFF = 0.034;
  const LIP = 0.014;
  const TOP_SEAL = 0.07;
  const BOT_SEAL = 0.1;
  const hx = (u: number): number => Math.pow(Math.sin(Math.PI * clamp01(u)), 0.6);
  const hy = (v: number): number => {
    const lo = BOT_SEAL;
    const hi = 1 - TOP_SEAL;
    if (v <= lo || v >= hi) {
      return 0;
    }
    return Math.pow(Math.sin((Math.PI * (v - lo)) / (hi - lo)), 0.55);
  };
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const perSide = NX * NY * 6;
  for (const side of [1, -1]) {
    const base = position.length / 3;
    for (let j = 0; j <= NY; j++) {
      for (let i = 0; i <= NX; i++) {
        const u = i / NX;
        const v = v0 + (v1 - v0) * (j / NY);
        position.push((u - 0.5) * W, (v - 0.5) * H, side * (LIP + PUFF * hx(u) * hy(v)));
        uv.push(side > 0 ? u : 1 - u, v);
      }
    }
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = base + j * (NX + 1) + i;
        const b = a + 1;
        const c = a + (NX + 1);
        const d = c + 1;
        if (side > 0) {
          index.push(a, c, b, b, c, d);
        } else {
          index.push(a, b, c, b, d, c);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.addGroup(0, perSide, 0);
  geometry.addGroup(perSide, perSide, 1);
  return geometry;
}

/** Entorno de reflejo: una banda ancha y brillante que da brillo de foil a cualquier pack a cualquier giro. */
export function environment(THREE: ThreeNamespace): any {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#20243a');
    g.addColorStop(0.3, '#8a8fc0');
    g.addColorStop(0.46, '#eef1ff');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(0.54, '#eef1ff');
    g.addColorStop(0.7, '#8a8fc0');
    g.addColorStop(1, '#10131f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Mancha de luz radial para el resplandor de la caja al abrirse. */
export function glowTexture(THREE: ThreeNamespace): any {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Resplandor que sigue el contorno de un rectángulo de `w × h` (con `margin` de más por cada lado), para bordear el sobre. */
export function outlineGlowTexture(THREE: ThreeNamespace, w: number, h: number, margin: number): any {
  const width = 256;
  const scale = width / (w + margin * 2);
  const height = Math.round((h + margin * 2) * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const inset = margin * scale;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = inset * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const r = Math.min(width, height) * 0.06;
    ctx.roundRect(inset, inset, width - inset * 2, height - inset * 2, r);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const STREAK_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * Cometas de luz sobre el contorno del sobre: una línea fina en el borde (siempre tenue), dos puntos brillantes con cola que lo recorren
 * y un resplandor hacia afuera. `uHalf` es la mitad del tamaño del sobre; el plano que lo dibuja sobresale `uMargin` por cada lado.
 */
export const STREAK_FRAGMENT = `
uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
uniform vec2 uHalf;
uniform float uMargin;
uniform float uReflect;
varying vec2 vUv;
float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 p = (vUv - 0.5) * (uHalf + vec2(uMargin)) * 2.0;
  float d = roundBox(p, uHalf, 0.055);
  float line = exp(-pow(abs(d) / 0.014, 2.0));
  float outer = d > 0.0 ? exp(-d / 0.045) : 0.0;
  float t = atan(p.y / uHalf.y, p.x / uHalf.x) / 6.2831853 + 0.5;
  float head = fract(uTime * 0.2);
  float comet = exp(-fract(head - t) * 9.0) + exp(-fract(head + 0.5 - t) * 9.0);
  float a = (line * (0.22 + comet * 1.3) + outer * (0.08 + comet * 0.55)) * uOpacity;
  if (uReflect > 0.5) {
    a *= pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.4);
  }
  vec3 color = mix(uColor, vec3(1.0), clamp(comet * line, 0.0, 1.0) * 0.8);
  gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
}`;

/** Máscara del reflejo: transparente lejos del sobre y más visible junto a su borde inferior (la fila de arriba del lienzo es el extremo lejano). */
export function reflectionMask(THREE: ThreeNamespace): any {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.4, '#000000');
    g.addColorStop(1, '#8c8c8c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
  }
  return new THREE.CanvasTexture(canvas);
}
