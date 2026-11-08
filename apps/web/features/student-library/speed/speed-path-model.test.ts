import { describe, expect, it } from 'vitest';
import { arcLength, pathInterval } from './speed-path-model';
import { magnitude, velocityAt } from './speed-model';

describe('KIN-02: путь и две средние скорости', () => {
  it('дуга не короче хорды на любом интервале', () => {
    for (let start = 0; start < 4.1; start += .5) for (const dt of [.01, .1, 1, 4, 8]) {
      const f = pathInterval(start, dt);
      expect(f.path).toBeGreaterThanOrEqual(magnitude(f.displacement) - 1e-10);
      expect(f.pathAverage).toBeGreaterThanOrEqual(magnitude(f.average) - 1e-10);
      expect(arcLength(0, f.t + f.dt) - arcLength(0, f.t)).toBeCloseTo(f.path, 7);
    }
  });
  it('интеграл аддитивен и согласован с независимой квадратурой по средним точкам', () => {
    expect(arcLength(0, 12)).toBeCloseTo(arcLength(0, 4) + arcLength(4, 12), 7);
    const steps = 10000, h = 12 / steps;
    let midpoint = 0;
    for (let i = 0; i < steps; i++) midpoint += magnitude(velocityAt((i + .5) * h)) * h;
    expect(arcLength(0, 12)).toBeCloseTo(midpoint, 7);
    expect(arcLength(1, 1)).toBe(0);
  });
  it('обе средние скорости сближаются с мгновенным модулем', () => {
    for (const t of [0, 1.5, 4]) {
      const f = pathInterval(t, .01), speed = magnitude(velocityAt(t));
      expect(f.pathAverage).toBeCloseTo(speed, 3);
      expect(magnitude(f.average)).toBeCloseTo(speed, 3);
      expect(f.pathAverage - magnitude(f.average)).toBeLessThan(.00001);
    }
  });
});
