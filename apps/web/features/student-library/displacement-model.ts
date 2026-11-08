import { projectPoint, type Point2, type Point3, type PointView } from './point-position-model';
import { ribbonAt, ribbonGeometry, svgPath, svgVector, unitProgress } from './curve-ribbon';

export const DISPLACEMENT_DURATION = 10;
export const DISPLACEMENT_START: Point3 = [.7, 4.8, 1];
export const DISPLACEMENT_END: Point3 = [4, 1.1, 4];
export const DISPLACEMENT_ROUTES = ['line', 'arc', 'return'] as const;
export type DisplacementRoute = typeof DISPLACEMENT_ROUTES[number];
const SAMPLES = 360;
// Perpendicular to END - START, so bending changes the path without changing endpoints.
const normal: Point3 = [0, 3 / Math.hypot(3, 3.7), 3.7 / Math.hypot(3, 3.7)];

export function displacementAt(route: DisplacementRoute, value: number): Point3 {
  const u = unitProgress(value), a = DISPLACEMENT_START, b = DISPLACEMENT_END;
  if (u === 0 || (route === 'return' && u === 1)) return a;
  if (u === 1) return b;
  return a.map((start, i) => route === 'return'
    ? (start + b[i]) / 2 + (start - b[i]) / 2 * Math.cos(2 * Math.PI * u) + 2 * normal[i] * Math.sin(2 * Math.PI * u)
    : start + (b[i] - start) * u + (route === 'arc' ? 12 * u * (1 - u) * normal[i] : 0)) as [number, number, number];
}

export function displacementGeometry(route: DisplacementRoute, view: PointView) {
  const world = Array.from({ length: SAMPLES + 1 }, (_, i) => displacementAt(route, i / SAMPLES));
  const lengths = [0];
  for (let i = 1; i <= SAMPLES; i++) lengths.push(lengths[i - 1] + Math.hypot(...world[i].map((v, axis) => v - world[i - 1][axis])));
  const ribbon = ribbonGeometry(world.map((p) => projectPoint(p, view)), (u) => 3.8 - 5.8 * u + 4.5 * u * u);
  return { ...ribbon, world, lengths, guide: svgPath(ribbon.points) };
}

export function displacementFrame(time: number, view: PointView, geometry: ReturnType<typeof displacementGeometry>) {
  const { point, trail, index, mix } = ribbonAt(time / DISPLACEMENT_DURATION, geometry);
  const world = geometry.world[index].map((v, axis) => v + (geometry.world[index + 1][axis] - v) * mix) as [number, number, number];
  const start = geometry.points[0];
  const distance = Math.hypot(...world.map((v, axis) => v - DISPLACEMENT_START[axis]));
  const radiusOpacity = unitProgress((Math.hypot(point[0] - start[0], point[1] - start[1]) - 28) / 24);
  const separate = radiusOpacity > 0;
  const displacement = svgVector(start, point, -30), radius = svgVector(view.origin, point, -26);
  return {
    point, trail, world,
    pointLabel: [-20, -30] as Point2,
    pointAnchor: 'start' as const,
    startLabel: [start[0] + 12, start[1] + 5] as Point2,
    initialRadiusLabel: svgVector(view.origin, start, 52).label,
    path: geometry.lengths[index] + (geometry.lengths[index + 1] - geometry.lengths[index]) * mix,
    distance,
    displacement: { ...displacement, visible: separate },
    radius,
    separate, radiusOpacity,
  };
}

export const displacementNumber = (value: number) => (Math.abs(value) < .005 ? 0 : value).toFixed(2).replace('.', ',');
