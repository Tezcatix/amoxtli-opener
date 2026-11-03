/**
 * Motor de resortes: cada cantidad se acerca a su objetivo con un integrador de velocidad
 * (`vel = (vel + (target - cur) * rigidez) * amortiguación`) sobre requestAnimationFrame.
 * No conoce el DOM: quien lo usa lee `cur` en `onTick` y escribe sus propias transformaciones.
 *
 * Adaptado de OpenPack (Luango, `src/motion.js`) con permiso del autor. Ver NOTICE.md.
 */
export interface SpringOptions<K extends string> {
  rest: Record<K, number>;
  stiffness?: number;
  damping?: number;
  stiffnessByKey?: Partial<Record<K, number>>;
  onTick: (current: Record<K, number>) => void;
}

export interface Spring<K extends string> {
  cur: Record<K, number>;
  target: Record<K, number>;
  start(): void;
  set(targets: Partial<Record<K, number>>): void;
  reset(values?: Partial<Record<K, number>>): void;
  tune(stiffness?: number, damping?: number): void;
  stop(): void;
}

export function createSpring<K extends string>(options: SpringOptions<K>): Spring<K> {
  const keys = Object.keys(options.rest) as K[];
  const cur = { ...options.rest };
  const target = { ...options.rest };
  const vel = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  let stiffness = options.stiffness ?? 0.12;
  let damping = options.damping ?? 0.82;
  let raf: number | null = null;

  const step = (): void => {
    let moving = false;
    for (const key of keys) {
      const k = options.stiffnessByKey?.[key] ?? stiffness;
      vel[key] = (vel[key] + (target[key] - cur[key]) * k) * damping;
      cur[key] += vel[key];
      if (Math.abs(vel[key]) > 0.02 || Math.abs(target[key] - cur[key]) > 0.02) {
        moving = true;
      }
    }
    if (!moving) {
      for (const key of keys) {
        cur[key] = target[key];
        vel[key] = 0;
      }
    }
    options.onTick(cur);
    raf = moving ? requestAnimationFrame(step) : null;
  };

  const kick = (): void => {
    if (raf === null) {
      raf = requestAnimationFrame(step);
    }
  };

  return {
    cur,
    target,
    start: kick,
    set(targets) {
      Object.assign(target, targets);
      kick();
    },
    reset(values) {
      for (const key of keys) {
        cur[key] = values?.[key] ?? options.rest[key];
        target[key] = cur[key];
        vel[key] = 0;
      }
      options.onTick(cur);
    },
    tune(nextStiffness, nextDamping) {
      stiffness = nextStiffness ?? stiffness;
      damping = nextDamping ?? damping;
    },
    stop() {
      if (raf !== null) {
        cancelAnimationFrame(raf);
      }
      raf = null;
    },
  };
}
