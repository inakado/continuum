import { bounded, intervalAt, magnitude, SPEED_DURATION, velocityAt } from './speed-model';

// Simpson в физическом 3D, а не длина экранной проекции/аппроксимации SVG.
export function arcLength(from: number, to: number, subdivisions = 128) {
  const a = bounded(from, 0, SPEED_DURATION), b = bounded(to, a, SPEED_DURATION);
  const n = Math.max(2, Math.ceil(subdivisions / 2) * 2), h = (b - a) / n;
  let total = magnitude(velocityAt(a)) + magnitude(velocityAt(b));
  for (let i = 1; i < n; i++) total += (i % 2 ? 4 : 2) * magnitude(velocityAt(a + h * i));
  return total * h / 3;
}

export function pathInterval(start: number, interval: number) {
  const frame = intervalAt(start, interval);
  const path = arcLength(frame.t, frame.t + frame.dt);
  return { ...frame, path, pathAverage: path / frame.dt };
}
