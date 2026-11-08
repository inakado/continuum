import { projectPoint, type Point3, type PointView } from './point-position-model';

// NASA fact sheets: sidereal periods and mean orbital distances.
export const EARTH_YEAR = 365.256;
export const MOON_MONTH = 27.3217;
export const LUNAR_DISTANCE_RATIO = 384400 / 149598000;
export const ORBIT_EXAGGERATION = 20;
export type OrbitFrame = 'earth' | 'sun';
const TAU = 2 * Math.PI;
export const orbitTime = (days: number) => Math.max(0, Math.min(EARTH_YEAR, Number.isFinite(days) ? days : 0));

export function orbitAt(days: number) {
  const time = orbitTime(days), earthAngle = TAU * time / EARTH_YEAR + Math.PI / 6;
  const moonAngle = TAU * time / MOON_MONTH + 140 * Math.PI / 180;
  const earth: Point3 = [Math.cos(earthAngle), Math.sin(earthAngle), 0];
  const relativeMoon: Point3 = [Math.cos(moonAngle), Math.sin(moonAngle), 0];
  const scale = LUNAR_DISTANCE_RATIO * ORBIT_EXAGGERATION;
  const moon: Point3 = [earth[0] + scale * relativeMoon[0], earth[1] + scale * relativeMoon[1], 0];
  return { time, earth, relativeMoon, moon };
}

export function orbitPath(days: number, frame: OrbitFrame, view: PointView, body: 'earth' | 'moon' = 'moon') {
  const end = Math.min(orbitTime(days), frame === 'earth' ? MOON_MONTH : EARTH_YEAR);
  const step = (frame === 'earth' ? MOON_MONTH : EARTH_YEAR) / (frame === 'earth' ? 180 : 960);
  const times = Array.from({ length: Math.floor(end / step) + 1 }, (_, i) => i * step);
  if (times[times.length - 1] !== end) times.push(end);
  return times.map((time, i) => {
    const state = orbitAt(time);
    const p = projectPoint(frame === 'earth' ? state.relativeMoon : body === 'earth' ? state.earth : state.moon, view);
    return `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  }).join('');
}
