import { projectPoint, type Point2, type Point3, type PointView } from './point-position-model';
import { ribbonAt, ribbonGeometry, svgVector, unitProgress } from './curve-ribbon';

export const TRAJECTORY_DURATION = 12;
const SAMPLES = 240;

// The rising turn follows the construction in KIN-01, in the existing anatomy camera.
export function trajectoryAt(progress: number): Point3 {
  const degrees = -40 + 390 * unitProgress(progress);
  const angle = degrees * Math.PI / 180;
  return [1.2 + 1.05 * Math.cos(angle), 2.65 + .95 * Math.sin(angle), .3 + .012 * (degrees + 40)];
}

export function trajectoryGeometry(view: PointView) {
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => projectPoint(trajectoryAt(i / SAMPLES), view));
  return ribbonGeometry(points, (progress) => 4.2 - 3.1 * progress);
}

export function trajectoryFrame(time: number, view: PointView, geometry: ReturnType<typeof trajectoryGeometry>) {
  const { point, trail } = ribbonAt(time / TRAJECTORY_DURATION, geometry);
  return { point, trail, ...svgVector(view.origin, point), pointLabel: [16, -16] as Point2 };
}
