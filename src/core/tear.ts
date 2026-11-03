import type { TearConfig } from '../types';

export interface TearGeometry {
  width: number;
  height: number;
}

/** Fracción del alto que ocupa la banda de corte en el modo 'top' y alrededor de `{ y }`. */
export const TOP_BAND = 0.3;
const Y_BAND = 0.15;

/**
 * Acumula los puntos de un trazo y calcula qué parte del corte se ha completado.
 * Solo cuenta los puntos que caen en la banda válida de la línea configurada.
 */
export class TearTracker {
  private readonly line: NonNullable<TearConfig['line']>;
  private readonly ratio: number;
  private minX = Infinity;
  private maxX = -Infinity;
  private minY = Infinity;
  private maxY = -Infinity;

  constructor(
    private readonly geometry: TearGeometry,
    config: TearConfig = {},
  ) {
    this.line = config.line ?? 'top';
    this.ratio = Math.min(Math.max(config.minLengthRatio ?? 0.8, 0.1), 1);
  }

  /** Devuelve el progreso 0..1 tras añadir el punto (coordenadas locales en px). */
  add(x: number, y: number): number {
    if (this.inBand(y)) {
      this.minX = Math.min(this.minX, x);
      this.maxX = Math.max(this.maxX, x);
      this.minY = Math.min(this.minY, y);
      this.maxY = Math.max(this.maxY, y);
    }
    return this.progress;
  }

  get progress(): number {
    if (this.maxX < this.minX) {
      return 0;
    }
    const { width, height } = this.geometry;
    const horizontal = (this.maxX - this.minX) / width;
    const vertical = this.line === 'free' ? (this.maxY - this.minY) / height : 0;
    return Math.min(Math.max(horizontal, vertical) / this.ratio, 1);
  }

  reset(): void {
    this.minX = this.minY = Infinity;
    this.maxX = this.maxY = -Infinity;
  }

  private inBand(y: number): boolean {
    const fraction = y / this.geometry.height;
    if (this.line === 'free') {
      return true;
    }
    if (this.line === 'top') {
      return fraction <= TOP_BAND;
    }
    return Math.abs(fraction - this.line.y) <= Y_BAND;
  }
}

export interface Point {
  x: number;
  y: number;
}

/** Largo sobre el que se mide el rumbo del corte. */
const TURN_SEG = 14;
/** Giro máximo de un solo paso (90°): un quiebre más brusco anula el corte. */
const TURN_KINK_RAD = Math.PI / 2;
/** Giro neto acumulado máximo (~70°): atrapa una vuelta en U gradual antes de que cierre. */
const TURN_CUM_RAD = Math.PI * 0.39;

/**
 * Un rasgado real avanza hacia adelante: no puede doblarse sobre sí mismo. Mide el rumbo cada
 * `TURN_SEG` unidades y anula el trazo si un paso gira más de 90° o el giro neto acumulado pasa de
 * ~70° (la oscilación se cancela porque el giro lleva signo). Un trazo anulado no se puede abrir.
 * Adaptado de OpenPack (Luango). Ver NOTICE.md.
 */
export class TurnGuard {
  private heading: Point | null = null;
  private anchor: Point | null = null;
  private cumulative = 0;
  private voided = false;

  get isVoid(): boolean {
    return this.voided;
  }

  /** Añade un punto; devuelve true si el trazo sigue siendo válido. */
  add(x: number, y: number): boolean {
    if (this.voided) {
      return false;
    }
    if (!this.anchor) {
      this.anchor = { x, y };
      return true;
    }
    const dx = x - this.anchor.x;
    const dy = y - this.anchor.y;
    const length = Math.hypot(dx, dy);
    if (length < TURN_SEG) {
      return true;
    }
    const next = { x: dx / length, y: dy / length };
    if (this.heading) {
      const turn = Math.atan2(this.heading.x * next.y - this.heading.y * next.x, this.heading.x * next.x + this.heading.y * next.y);
      this.cumulative += turn;
      if (Math.abs(turn) > TURN_KINK_RAD || Math.abs(this.cumulative) > TURN_CUM_RAD) {
        this.voided = true;
        return false;
      }
    }
    this.heading = next;
    this.anchor = { x, y };
    return true;
  }

  reset(): void {
    this.heading = null;
    this.anchor = null;
    this.cumulative = 0;
    this.voided = false;
  }
}

export interface SplitResult {
  /** Los dos polígonos en que el trazo corta el sobre (coordenadas locales en px). */
  a: Point[];
  b: Point[];
  /** El trazo con sus extremos pegados a los bordes. */
  seam: Point[];
  /** Cuál es la mitad más chica (la que sale volando; la grande conserva las cartas). */
  smaller: 'a' | 'b';
  /** Dirección unitaria en la que se aleja la mitad chica (perpendicular al corte). */
  direction: Point;
}

/** Posición del punto a lo largo del perímetro, en sentido horario desde la esquina superior izquierda. */
function perimeter(p: Point, w: number, h: number): number {
  const top = Math.abs(p.y);
  const right = Math.abs(w - p.x);
  const bottom = Math.abs(h - p.y);
  const left = Math.abs(p.x);
  const min = Math.min(top, right, bottom, left);
  if (min === top) {
    return p.x;
  }
  if (min === right) {
    return w + p.y;
  }
  if (min === bottom) {
    return w + h + (w - p.x);
  }
  return 2 * w + h + (h - p.y);
}

function snapToBorder(p: Point, w: number, h: number): Point {
  const top = p.y;
  const right = w - p.x;
  const bottom = h - p.y;
  const left = p.x;
  const min = Math.min(top, right, bottom, left);
  if (min === top) {
    return { x: p.x, y: 0 };
  }
  if (min === right) {
    return { x: w, y: p.y };
  }
  if (min === bottom) {
    return { x: p.x, y: h };
  }
  return { x: 0, y: p.y };
}

/** Esquinas del sobre que quedan caminando en sentido horario de la posición `from` a `to`. */
function cornersClockwise(from: number, to: number, w: number, h: number): Point[] {
  const total = 2 * w + 2 * h;
  const corners: Array<[number, Point]> = [
    [w, { x: w, y: 0 }],
    [w + h, { x: w, y: h }],
    [2 * w + h, { x: 0, y: h }],
    [total, { x: 0, y: 0 }],
  ];
  const span = (((to - from) % total) + total) % total;
  return corners
    .map(([position, point]) => ({ distance: (((position - from) % total) + total) % total, point }))
    .filter(({ distance }) => distance > 0 && distance < span)
    .sort((one, two) => one.distance - two.distance)
    .map(({ point }) => point);
}

function area(points: Point[]): number {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]!;
    sum += p.x * q.y - q.x * p.y;
  });
  return sum / 2;
}

function centroid(points: Point[]): Point {
  const n = points.length || 1;
  return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
}

/** Rugosidad de papel rasgado: desplaza cada punto interior a lo largo de la normal, de forma determinista. */
export function roughen(path: Point[], amplitude = 1.6): Point[] {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)]!;
    const b = path[Math.min(path.length - 1, i + 1)]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const offset = Math.sin(i * 12.9898) * amplitude;
    return { x: p.x - ((b.y - a.y) / length) * offset, y: p.y + ((b.x - a.x) / length) * offset };
  });
}

/**
 * Divide el rectángulo `w × h` en dos polígonos complementarios a lo largo del trazo (sus extremos se
 * pegan al borde más cercano). La mitad más chica es la que se despega. Adaptado de OpenPack (`makePieces`).
 */
export function splitPack(path: Point[], w: number, h: number): SplitResult | null {
  if (path.length < 2) {
    return null;
  }
  const rough = roughen(path);
  const entry = snapToBorder(rough[0]!, w, h);
  const exit = snapToBorder(rough[rough.length - 1]!, w, h);
  const seam = [entry, ...rough, exit];
  const sIn = perimeter(entry, w, h);
  const sOut = perimeter(exit, w, h);
  const a = [...seam, ...cornersClockwise(sOut, sIn, w, h)];
  const b = [...seam, ...cornersClockwise(sIn, sOut, w, h).reverse()];

  const mid = { x: (entry.x + exit.x) / 2, y: (entry.y + exit.y) / 2 };
  const chord = { x: exit.x - entry.x, y: exit.y - entry.y };
  const length = Math.hypot(chord.x, chord.y) || 1;
  const normal = { x: -chord.y / length, y: chord.x / length };
  const centerA = centroid(a);
  const side = (centerA.x - mid.x) * normal.x + (centerA.y - mid.y) * normal.y >= 0 ? 1 : -1;
  const aSmaller = Math.abs(area(a)) < Math.abs(area(b));
  const dirA = { x: normal.x * side, y: normal.y * side };
  return {
    a,
    b,
    seam,
    smaller: aSmaller ? 'a' : 'b',
    direction: aSmaller ? dirA : { x: -dirA.x, y: -dirA.y },
  };
}
