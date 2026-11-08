import { expect, it } from 'vitest';
import { returnFrame, RETURN_DISTANCE, RETURN_DURATION } from './return-model';

it('возвращается с нулевым перемещением, положительным путём и путевой средней', () => {
  const f = returnFrame(RETURN_DURATION);
  expect(f.displacement).toBe(0);
  expect(f.average).toBe(0);
  expect(f.path).toBe(2 * RETURN_DISTANCE);
  expect(f.pathAverage).toBeCloseTo(2 * RETURN_DISTANCE / RETURN_DURATION);
});
it('разворачивается гладко без скачка мгновенной скорости', () => {
  const turn = RETURN_DURATION / 2;
  expect(returnFrame(turn).velocity).toBe(0);
  expect(returnFrame(turn - .01).velocity).toBeGreaterThan(0);
  expect(returnFrame(turn + .01).velocity).toBeLessThan(0);
  for (const t of [1, 3, 6, 9, 11]) {
    const h = .00001, numerical = (returnFrame(t + h).x - returnFrame(t - h).x) / (2 * h);
    expect(returnFrame(t).velocity).toBeCloseTo(numerical, 8);
  }
});
it('путь возрастает и превосходит модуль перемещения; нулевое время конечно', () => {
  expect(returnFrame(0).average).toBe(0);
  expect(returnFrame(0).pathAverage).toBe(0);
  let previous = 0;
  for (let i = 0; i <= 1200; i++) {
    const f = returnFrame(i / 100);
    expect(f.path).toBeGreaterThanOrEqual(previous);
    expect(f.path).toBeGreaterThanOrEqual(Math.abs(f.displacement));
    expect(f.pathAverage).toBeGreaterThanOrEqual(Math.abs(f.average));
    previous = f.path;
  }
});
