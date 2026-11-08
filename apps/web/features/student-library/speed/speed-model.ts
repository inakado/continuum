import { projectPoint, type Point2, type Point3, type PointView } from '../point-position-model';

export const SPEED_DURATION = 12;
export const MIN_INTERVAL = .01;
export const MAX_INTERVAL = 8;
export const TANGENT_DURATION = 8;
const angularRate = 390 / SPEED_DURATION * Math.PI / 180;
export const speedView: PointView = { origin: [130, 326], axes: [[-39, 34], [61, 0], [0, -45]] };
export const bounded = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : lo));
export const tangentInterval = (time: number) => 6 * Math.exp(-Math.log(600) * bounded(time, 0, TANGENT_DURATION) / TANGENT_DURATION);
export const magnitude = (v: Point3) => Math.hypot(...v);
export const difference = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scaled = (v: Point3, k: number): Point3 => [v[0] * k, v[1] * k, v[2] * k];

// Та же восходящая кривая, что в трёх TikZ-рисунках KIN-02.
// Координаты и скорости физические; камера применяется только после расчётов.
export function positionAt(time: number): Point3 {
  const t = bounded(time, 0, SPEED_DURATION), degrees = -40 + 390 * t / SPEED_DURATION;
  const angle = degrees * Math.PI / 180;
  return [1.2 + 1.05 * Math.cos(angle), 2.65 + .95 * Math.sin(angle), .3 + .012 * (degrees + 40)];
}

export function velocityAt(time: number): Point3 {
  const angle = (-40 + 390 * bounded(time, 0, SPEED_DURATION) / SPEED_DURATION) * Math.PI / 180;
  return [-1.05 * angularRate * Math.sin(angle), .95 * angularRate * Math.cos(angle), .39];
}

export function intervalAt(start: number, interval: number) {
  const dt = bounded(interval, MIN_INTERVAL, SPEED_DURATION);
  const t = bounded(start, 0, SPEED_DURATION - dt);
  const a = positionAt(t), b = positionAt(t + dt);
  const displacement = difference(b, a);
  const average = scaled(displacement, 1 / dt);
  return { t, dt, a, b, displacement, average, instantaneous: velocityAt(t) };
}

export const screenPoint = (p: Point3) => projectPoint(p, speedView);
export const screenVector = (v: Point3): Point2 => {
  const p = screenPoint(v);
  return [p[0] - speedView.origin[0], p[1] - speedView.origin[1]];
};
export function velocityTip(base: Point2, velocity: Point3, seconds = 2): Point2 {
  const p = screenVector(velocity);
  return [base[0] + seconds * p[0], base[1] + seconds * p[1]];
}
export const speedNumber = (value: number, digits = 2) => (Math.abs(value) < .5 * 10 ** -digits ? 0 : value).toFixed(digits).replace('.', ',');
