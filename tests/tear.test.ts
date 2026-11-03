import { describe, expect, it } from 'vitest';
import { TearTracker } from '../src';

const geometry = { width: 200, height: 300 };

describe('TearTracker', () => {
  it('completa con un trazo horizontal en la banda superior', () => {
    const tracker = new TearTracker(geometry);
    expect(tracker.add(10, 40)).toBeLessThan(1);
    expect(tracker.add(100, 45)).toBeGreaterThan(0.4);
    expect(tracker.add(180, 50)).toBe(1);
  });

  it('ignora puntos fuera de la banda', () => {
    const tracker = new TearTracker(geometry);
    tracker.add(0, 200);
    expect(tracker.add(200, 250)).toBe(0);
  });

  it('un trazo corto no completa', () => {
    const tracker = new TearTracker(geometry);
    tracker.add(20, 30);
    expect(tracker.add(80, 30)).toBeLessThan(0.5);
  });

  it('respeta una línea {y} y minLengthRatio', () => {
    const tracker = new TearTracker(geometry, { line: { y: 0.5 }, minLengthRatio: 0.5 });
    tracker.add(0, 20);
    expect(tracker.progress).toBe(0);
    tracker.add(0, 150);
    expect(tracker.add(100, 150)).toBe(1);
  });

  it("en modo 'free' cuenta cualquier trazo, también vertical", () => {
    const tracker = new TearTracker(geometry, { line: 'free' });
    tracker.add(100, 0);
    expect(tracker.add(100, 290)).toBe(1);
  });

  it('reset reinicia el progreso', () => {
    const tracker = new TearTracker(geometry);
    tracker.add(0, 10);
    tracker.add(200, 10);
    tracker.reset();
    expect(tracker.progress).toBe(0);
  });
});

import { TurnGuard, splitPack } from '../src';

describe('TurnGuard', () => {
  it('acepta un trazo recto', () => {
    const guard = new TurnGuard();
    for (let x = 0; x <= 200; x += 5) {
      expect(guard.add(x, 20)).toBe(true);
    }
  });

  it('acepta una curva suave', () => {
    const guard = new TurnGuard();
    for (let x = 0; x <= 200; x += 5) {
      expect(guard.add(x, 20 + Math.sin(x / 40) * 6)).toBe(true);
    }
  });

  it('anula un quiebre brusco (>90°)', () => {
    const guard = new TurnGuard();
    for (let x = 0; x <= 60; x += 5) {
      guard.add(x, 20);
    }
    let alive = true;
    for (let x = 55; x >= 0 && alive; x -= 5) {
      alive = guard.add(x, 21);
    }
    expect(alive).toBe(false);
    expect(guard.isVoid).toBe(true);
    expect(guard.add(500, 500)).toBe(false);
  });

  it('anula una vuelta en U gradual por el giro acumulado', () => {
    const guard = new TurnGuard();
    let alive = true;
    for (let a = 0; a < Math.PI && alive; a += 0.15) {
      alive = guard.add(60 * Math.sin(a), 60 - 60 * Math.cos(a));
    }
    expect(alive).toBe(false);
  });

  it('reset lo vuelve a habilitar', () => {
    const guard = new TurnGuard();
    guard.add(0, 0);
    guard.add(30, 0);
    guard.add(0, 1);
    guard.add(-30, 0);
    guard.reset();
    expect(guard.isVoid).toBe(false);
    expect(guard.add(0, 0)).toBe(true);
  });
});

describe('splitPack', () => {
  const w = 200;
  const h = 300;
  const stripPath = [
    { x: 4, y: 60 },
    { x: 60, y: 64 },
    { x: 120, y: 58 },
    { x: 196, y: 62 },
  ];

  it('un corte horizontal arriba despega la tira chica hacia arriba', () => {
    const result = splitPack(stripPath, w, h)!;
    const small = result.smaller === 'a' ? result.a : result.b;
    const big = result.smaller === 'a' ? result.b : result.a;
    const area = (pts: Array<{ x: number; y: number }>) =>
      Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * p.y, 0) / 2);
    expect(area(small)).toBeLessThan(area(big));
    expect(result.direction.y).toBeLessThan(-0.9);
  });

  it('los dos polígonos suman el área del sobre', () => {
    const result = splitPack(stripPath, w, h)!;
    const area = (pts: Array<{ x: number; y: number }>) =>
      Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * p.y, 0) / 2);
    expect(area(result.a) + area(result.b)).toBeCloseTo(w * h, -2);
  });

  it('un trazo de menos de dos puntos no parte nada', () => {
    expect(splitPack([{ x: 1, y: 1 }], w, h)).toBeNull();
  });

  it('un corte vertical de lado a lado también parte en dos', () => {
    const result = splitPack([{ x: 40, y: 2 }, { x: 44, y: 150 }, { x: 38, y: 298 }], w, h)!;
    expect(result.a.length).toBeGreaterThan(3);
    expect(result.b.length).toBeGreaterThan(3);
    expect(Math.abs(result.direction.x)).toBeGreaterThan(0.9);
  });
});
