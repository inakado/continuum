export const MOTION_DURATION = 6;
export const MOTION_START = 2;

// Demonstration: uniform motion from 2 m to 7 m along the fixed ruler in 6 s.
export function motionAt(seconds: number) {
  const time = Math.min(MOTION_DURATION, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  return { time, position: MOTION_START + 5 * time / MOTION_DURATION, finished: time === MOTION_DURATION };
}

export function motionNumber(value: number) {
  return value.toFixed(1).replace('.', ',');
}
