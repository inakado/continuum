import { describe, expect, it } from 'vitest';
import { difference, intervalAt, magnitude, positionAt, scaled, SPEED_DURATION, velocityAt, tangentInterval, TANGENT_DURATION } from './speed-model';

describe('KIN-02: средняя скорость по перемещению', () => {
  it('равна перемещению / интервалу для разных начальных моментов', () => {
    for (const t of [0, 1.5, 4, 9]) for (const dt of [.01, .1, 2, 3]) {
      const f = intervalAt(t, dt);
      f.average.forEach((v, i) => expect(v * f.dt).toBeCloseTo(f.displacement[i], 12));
      expect(f.average.reduce((s, v, i) => s + v * f.displacement[i], 0)).toBeGreaterThan(0);
    }
  });
  it('аналитическая скорость совпадает с независимой центральной разностью', () => {
    for (const t of [.01, 1, 3, 6, 9, 11.99]) {
      const h = .00001;
      const numerical = scaled(difference(positionAt(t + h), positionAt(t - h)), 1 / (2 * h));
      velocityAt(t).forEach((v, i) => expect(v).toBeCloseTo(numerical[i], 8));
    }
  });
  it('средняя скорость сходится к мгновенной без нормализации стрелок', () => {
    for (const t of [0, 2, 4]) {
      const errors = [1, .1, .01].map(dt => magnitude(difference(intervalAt(t, dt).average, velocityAt(t))));
      expect(errors[1]).toBeLessThan(errors[0] / 8);
      expect(errors[2]).toBeLessThan(errors[1] / 8);
      expect(magnitude(intervalAt(t, .01).average)).toBeGreaterThan(.6);
    }
  });
  it('не допускает деления на ноль и выхода за временной диапазон', () => {
    for (const [t, dt] of [[-1, 0], [Infinity, NaN], [20, 100], [11.9, 5]]) {
      const f = intervalAt(t, dt);
      expect(f.t).toBeGreaterThanOrEqual(0);
      expect(f.t + f.dt).toBeLessThanOrEqual(SPEED_DURATION);
      expect(f.average.every(Number.isFinite)).toBe(true);
    }
  });
  it('предел достигается плавным уменьшением положительного интервала', () => {
    expect(tangentInterval(0)).toBeCloseTo(6, 10);
    expect(tangentInterval(TANGENT_DURATION)).toBeCloseTo(.01, 10);
    let previous = 6;
    for (let i = 1; i <= 800; i++) {
      const dt = tangentInterval(i / 100);
      expect(dt).toBeLessThan(previous);
      expect(dt / previous).toBeGreaterThan(.99);
      previous = dt;
    }
  });
});
