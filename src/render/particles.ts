/**
 * Sistema de partículas en canvas pensado para leerse como LUZ, no como confeti:
 * composición aditiva, sprites radiales suaves (núcleo blanco → color → transparente) horneados una
 * sola vez, destellos de 4 puntas, estelas en las rápidas y halo en las grandes.
 *
 * Adaptado de OpenPack (Luango, `src/particles.js`) con permiso del autor. Ver NOTICE.md.
 */
export type ParticleShape = 'round' | 'star' | 'chip';

export interface EmitOptions {
  count?: number;
  speed?: number;
  /** Ángulo central (rad). */
  dir?: number;
  /** Apertura del cono (rad). Def. círculo completo. */
  spread?: number;
  colors?: string[];
  gravity?: number;
  life?: number;
  size?: number;
  shape?: ParticleShape;
  trail?: boolean;
  bloom?: boolean;
}

export interface Particles {
  emit(x: number, y: number, options?: EmitOptions): void;
  resize(): void;
  dispose(): void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  color: string;
  spr: HTMLCanvasElement | null;
  additive: boolean;
  trail: boolean;
  bloom: boolean;
  tw: number;
  rot: number;
  vr: number;
}

const NOOP: Particles = { emit: () => undefined, resize: () => undefined, dispose: () => undefined };

/** Más claro, hacia blanco (`amount` 0→1). Devuelve `rgb()`; si no es #rrggbb lo deja igual. */
export function lighten(hex: string, amount = 0.5): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) {
    return hex;
  }
  const n = parseInt(match[1]!, 16);
  const mix = (c: number): number => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

export function createParticles(canvas: HTMLCanvasElement, reduced = false): Particles {
  const view = canvas.ownerDocument.defaultView;
  const ctx = canvas.getContext?.('2d') ?? null;
  if (!view || !ctx) {
    return NOOP;
  }
  const coarse = view.matchMedia?.('(pointer: coarse)').matches ?? false;
  const maxParts = coarse ? 150 : 260;
  let parts: Particle[] = [];
  let raf: number | null = null;
  const sprites = new Map<string, HTMLCanvasElement>();

  const resize = (): void => {
    const dpr = coarse ? 1 : Math.min(2, view.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const sprite = (shape: ParticleShape, color: string): HTMLCanvasElement | null => {
    const key = `${shape}|${color}`;
    const cached = sprites.get(key);
    if (cached) {
      return cached;
    }
    const R = 32;
    const c = canvas.ownerDocument.createElement('canvas');
    c.width = c.height = R * 2;
    const g = c.getContext('2d');
    if (!g) {
      return null;
    }
    const core = g.createRadialGradient(R, R, 0, R, R, R);
    core.addColorStop(0, 'rgba(255,255,255,0.95)');
    core.addColorStop(0.22, color);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = core;
    g.beginPath();
    g.arc(R, R, R, 0, Math.PI * 2);
    g.fill();
    if (shape === 'star') {
      g.globalCompositeOperation = 'lighter';
      for (const horizontal of [true, false]) {
        const grad = horizontal ? g.createLinearGradient(0, R, R * 2, R) : g.createLinearGradient(R, 0, R, R * 2);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        if (horizontal) {
          g.fillRect(0, R - 1.1, R * 2, 2.2);
        } else {
          g.fillRect(R - 1.1, 0, 2.2, R * 2);
        }
      }
    }
    sprites.set(key, c);
    return c;
  };

  const step = (): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.life--;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.tw += 0.5;
      const t = Math.max(0, p.life / p.max);

      if (!p.additive || !p.spr) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.7);
        ctx.restore();
        continue;
      }

      ctx.globalCompositeOperation = 'lighter';
      const twinkle = 0.78 + 0.22 * Math.sin(p.tw);
      const alpha = Math.pow(t, 1.6) * twinkle;
      const size = p.size * (0.55 + 0.45 * t);
      const half = size * 1.7;
      const speed = Math.hypot(p.vx, p.vy);

      if (p.trail && speed > 3) {
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = alpha * (0.34 / i);
          ctx.drawImage(p.spr, p.x - p.vx * i * 0.6 - half, p.y - p.vy * i * 0.6 - half, half * 2, half * 2);
        }
      }
      if (p.bloom && size >= 2.6 && alpha > 0.4) {
        ctx.globalAlpha = alpha * 0.28;
        const bh = half * 2.3;
        ctx.drawImage(p.spr, p.x - bh, p.y - bh, bh * 2, bh * 2);
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(p.spr, p.x - half, p.y - half, half * 2, half * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(step) : null;
  };

  const emit = (x: number, y: number, options: EmitOptions = {}): void => {
    const {
      count = 8,
      speed = 3,
      dir = 0,
      spread = Math.PI * 2,
      colors = ['#ffffff'],
      gravity = 0.16,
      life = 42,
      size = 2.4,
      shape = 'round',
      trail = false,
      bloom = false,
    } = options;
    const additive = shape !== 'chip';
    const n = reduced ? Math.max(1, Math.round(count * 0.4)) : count;
    for (let k = 0; k < n; k++) {
      const angle = dir + (Math.random() - 0.5) * spread;
      const velocity = speed * (0.4 + Math.random() * 0.9);
      const color = colors[(Math.random() * colors.length) | 0] ?? '#ffffff';
      parts.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        g: gravity,
        life: life * (0.7 + Math.random() * 0.6),
        max: life,
        size: size * (0.6 + Math.random() * 0.9),
        color,
        spr: additive ? sprite(shape, color) : null,
        additive,
        trail: trail && !reduced,
        bloom: bloom && !reduced,
        tw: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.5,
      });
    }
    if (parts.length > maxParts) {
      parts = parts.slice(parts.length - maxParts);
    }
    if (raf === null) {
      raf = requestAnimationFrame(step);
    }
  };

  resize();
  view.addEventListener('resize', resize);
  return {
    emit,
    resize,
    dispose() {
      view.removeEventListener('resize', resize);
      if (raf !== null) {
        cancelAnimationFrame(raf);
      }
      raf = null;
      parts = [];
    },
  };
}
