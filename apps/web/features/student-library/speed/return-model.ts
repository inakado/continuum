import { bounded } from './speed-model';

export const RETURN_DURATION = 12;
export const RETURN_DISTANCE = 5;
export function returnFrame(time: number) {
  const t = bounded(time, 0, RETURN_DURATION), phase = Math.PI * t / RETURN_DURATION;
  const x = t === RETURN_DURATION ? 0 : RETURN_DISTANCE * Math.sin(phase) ** 2;
  const velocity = t === 0 || t === RETURN_DURATION / 2 || t === RETURN_DURATION ? 0 : RETURN_DISTANCE * Math.PI / RETURN_DURATION * Math.sin(2 * phase);
  const path = t <= RETURN_DURATION / 2 ? x : 2 * RETURN_DISTANCE - x;
  return { t, x, velocity, path, displacement: x, average: t ? x / t : 0, pathAverage: t ? path / t : 0, reached: t < RETURN_DURATION / 2 ? x : RETURN_DISTANCE };
}
